import { useState, useEffect } from 'react';
import { ClipboardList, Plus, CheckCircle2, Clock, X, Trash2, Calendar, List, ChevronRight, ChevronLeft, User, Package, Euro, Search, Minus, Factory, Truck } from 'lucide-react';
import { getOrders, saveOrder, deleteOrder, getCustomers, getProducts, getCategories } from '../../db/indexedDB';
import './Orders.css';

const STATUS_LABELS = {
    en_attente: 'En attente',
    en_production: 'En production',
    pret: 'Prêt à retirer',
    recupere: 'Récupéré',
    // legacy compat
    pending: 'En attente',
    ready: 'Prêt',
    collected: 'Récupéré',
};
const STATUS_COLORS = {
    en_attente: '#f59e0b',
    en_production: '#6366f1',
    pret: '#10b981',
    recupere: '#9ca3af',
    pending: '#f59e0b',
    ready: '#10b981',
    collected: '#9ca3af',
};
const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const EMPTY_FORM = { customerName: '', customerPhone: '', items: [], freeText: '', totalPrice: '', deposit: '', pickupDate: '', pickupTime: '', productionStartDate: '', notes: '' };

/* ─────────── ORDER CREATION DRAWER ─────────── */
function OrderDrawer({ open, onClose, onSave, prefillDate = '' }) {
    const [step, setStep] = useState(1);
    const [form, setForm] = useState({ ...EMPTY_FORM, pickupDate: prefillDate });

    // Catalog state
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [activeCat, setActiveCat] = useState('all');
    const [productSearch, setProductSearch] = useState('');

    // Customer lookup
    const [customers, setCustomers] = useState([]);
    const [customerSearch, setCustomerSearch] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);

    useEffect(() => {
        if (open) {
            setStep(1);
            setForm({ ...EMPTY_FORM, pickupDate: prefillDate });
            setProductSearch('');
            setCustomerSearch('');
            getProducts().then(setProducts);
            getCategories().then(setCategories);
            getCustomers().then(setCustomers);
        }
    }, [open, prefillDate]);

    const suggestedCustomers = customerSearch.length >= 1
        ? customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()))
        : [];

    const filteredProducts = products.filter(p => {
        const matchCat = activeCat === 'all' || p.categoryId === activeCat;
        const matchSearch = p.name.toLowerCase().includes(productSearch.toLowerCase());
        return matchCat && matchSearch;
    });

    const addProduct = (product) => {
        setForm(f => {
            const existing = f.items.find(i => i.id === product.id);
            if (existing) {
                return { ...f, items: f.items.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i) };
            }
            return { ...f, items: [...f.items, { id: product.id, name: product.name, price: product.price, qty: 1 }] };
        });
    };

    const updateQty = (id, delta) => {
        setForm(f => {
            const updated = f.items.map(i => i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i).filter(i => i.qty > 0);
            return { ...f, items: updated };
        });
    };

    // We store raw price strings so typing '30' doesn't get parsed mid-keystroke
    const [priceEdits, setPriceEdits] = useState({});

    // Keep priceEdits in sync when items change (e.g. after adding from catalog)
    useEffect(() => {
        if (!open) return;
        setPriceEdits(prev => {
            const next = { ...prev };
            form.items.forEach(i => {
                if (!(i.id in next)) next[i.id] = i.price > 0 ? String(i.price) : '';
            });
            return next;
        });
    }, [form.items, open]);

    const commitPrice = (id) => {
        const raw = priceEdits[id] ?? '';
        const parsed = parseFloat(raw.replace(',', '.'));
        setForm(f => ({
            ...f,
            items: f.items.map(i => i.id === id ? { ...i, price: isNaN(parsed) ? 0 : parsed } : i)
        }));
    };

    const [customName, setCustomName] = useState('');
    const [customPrice, setCustomPrice] = useState('');

    const addCustomArticle = () => {
        if (!customName.trim()) return;
        const parsed = parseFloat(customPrice.replace(',', '.'));
        const customItem = {
            id: `custom_${Date.now()}`,
            name: customName.trim(),
            price: isNaN(parsed) ? 0 : parsed,
            qty: 1
        };
        setForm(f => ({ ...f, items: [...f.items, customItem] }));
        setCustomName('');
        setCustomPrice('');
    };

    const catalogTotal = form.items.reduce((sum, i) => sum + i.price * i.qty, 0);
    const effectiveTotal = parseFloat(form.totalPrice) || catalogTotal;
    const remaining = Math.max(0, effectiveTotal - (parseFloat(form.deposit) || 0));

    const handleSubmit = async () => {
        const itemsSummary = [
            ...form.items.map(i => `${i.qty}x ${i.name}${i.price > 0 ? ` (${(i.price * i.qty).toFixed(2)}€)` : ''}`),
            ...(form.freeText ? [form.freeText] : [])
        ].join('\n');

        await onSave({
            customerName: form.customerName,
            customerPhone: form.customerPhone,
            items: itemsSummary,
            totalPrice: effectiveTotal,
            deposit: parseFloat(form.deposit) || 0,
            pickupDate: form.pickupDate,
            pickupTime: form.pickupTime || '',
            productionStartDate: form.productionStartDate || '',
            notes: form.notes,
            status: 'en_attente',
        });
        onClose();
    };

    const canProceed1 = form.customerName.trim().length > 0;
    const canProceed2 = form.items.length > 0 || form.freeText.trim().length > 0;
    const canSubmit = canProceed1 && (canProceed2) && form.pickupDate;

    if (!open) return null;

    return (
        <>
            <div className="drawer-overlay" onClick={onClose} />
            <div className={`order-drawer ${open ? 'open' : ''}`}>
                {/* Header */}
                <div className="drawer-header">
                    <h2 className="drawer-title">
                        {step === 1 && <><User size={20} /> Client</>}
                        {step === 2 && <><Package size={20} /> Commande</>}
                        {step === 3 && <><Euro size={20} /> Récapitulatif</>}
                    </h2>
                    <button className="close-btn" onClick={onClose}><X size={22} /></button>
                </div>

                {/* Step Indicator */}
                <div className="drawer-steps">
                    {[1, 2, 3].map(s => (
                        <div key={s} className={`step-item ${step === s ? 'active' : ''} ${step > s ? 'done' : ''}`} onClick={() => step > s && setStep(s)}>
                            <div className="step-circle">{step > s ? '✓' : s}</div>
                            <span>{s === 1 ? 'Client' : s === 2 ? 'Articles' : 'Finaliser'}</span>
                        </div>
                    ))}
                </div>

                {/* Body */}
                <div className="drawer-body">

                    {/* ── Step 1: Client ── */}
                    {step === 1 && (
                        <div className="step-content">
                            <p className="step-hint">Recherchez un client existant ou créez-en un nouveau.</p>

                            <div className="form-group" style={{ position: 'relative' }}>
                                <label>Nom du client *</label>
                                <div className="input-icon-wrap">
                                    <Search size={16} className="input-icon" />
                                    <input
                                        autoFocus
                                        type="text"
                                        value={form.customerName}
                                        onChange={e => {
                                            setForm(f => ({ ...f, customerName: e.target.value }));
                                            setCustomerSearch(e.target.value);
                                            setShowSuggestions(true);
                                        }}
                                        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                                        placeholder="Marie Dupont"
                                    />
                                </div>
                                {showSuggestions && suggestedCustomers.length > 0 && (
                                    <div className="suggestions-dropdown">
                                        {suggestedCustomers.slice(0, 5).map(c => (
                                            <div key={c.id} className="suggestion-item" onMouseDown={() => {
                                                setForm(f => ({ ...f, customerName: c.name, customerPhone: c.phone || '' }));
                                                setShowSuggestions(false);
                                            }}>
                                                <span className="sug-name">{c.name}</span>
                                                {c.phone && <span className="sug-phone">📞 {c.phone}</span>}
                                                <span className="sug-visits">{c.visits || 0} visites</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="form-group">
                                <label>Téléphone (optionnel)</label>
                                <input
                                    type="tel"
                                    value={form.customerPhone}
                                    onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))}
                                    placeholder="06 12 34 56 78"
                                />
                            </div>
                        </div>
                    )}

                    {/* ── Step 2: Products ── */}
                    {step === 2 && (
                        <div className="step-content">
                            {/* Cart summary at top */}
                            {form.items.length > 0 && (
                                <div className="cart-mini">
                                    {form.items.map(item => (
                                        <div key={item.id} className="cart-mini-item">
                                            <span className="cart-mini-name">{item.name}</span>
                                            <div className="cart-mini-controls">
                                                <button className="qty-sm" onClick={() => updateQty(item.id, -1)}><Minus size={12} /></button>
                                                <span>{item.qty}</span>
                                                <button className="qty-sm" onClick={() => updateQty(item.id, 1)}><Plus size={12} /></button>
                                            </div>
                                            {/* Editable unit price — string-based to avoid mid-keystroke parsing bugs */}
                                            <div className="price-edit-wrap">
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={priceEdits[item.id] ?? (item.price > 0 ? String(item.price) : '')}
                                                    onChange={e => setPriceEdits(p => ({ ...p, [item.id]: e.target.value }))}
                                                    onBlur={() => commitPrice(item.id)}
                                                    placeholder="0.00"
                                                    className="price-edit-input"
                                                />
                                                <span className="price-edit-unit">€/u</span>
                                            </div>
                                            <span className="cart-mini-price">{item.price > 0 ? `= ${(item.price * item.qty).toFixed(2)}€` : '—'}</span>
                                        </div>
                                    ))}
                                    <div className="cart-mini-total">Sous-total : <strong>{catalogTotal.toFixed(2)} €</strong></div>
                                </div>
                            )}

                            {/* Category filters */}
                            <div className="cat-filter-row">
                                <button className={`cat-chip ${activeCat === 'all' ? 'active' : ''}`} onClick={() => setActiveCat('all')}>Tous</button>
                                {categories.map(c => (
                                    <button key={c.id} className={`cat-chip ${activeCat === c.id ? 'active' : ''}`} onClick={() => setActiveCat(c.id)}>
                                        {c.icon} {c.name}
                                    </button>
                                ))}
                            </div>

                            {/* Product search */}
                            <div className="input-icon-wrap" style={{ marginBottom: 12 }}>
                                <Search size={16} className="input-icon" />
                                <input type="text" placeholder="Rechercher un produit..." value={productSearch} onChange={e => setProductSearch(e.target.value)} />
                            </div>

                            {/* Product grid */}
                            <div className="products-picker-grid">
                                {filteredProducts.map(p => {
                                    const inCart = form.items.find(i => i.id === p.id);
                                    return (
                                        <div key={p.id} className={`product-chip ${inCart ? 'selected' : ''}`} style={{ backgroundColor: p.color + (inCart ? '' : '99'), borderColor: inCart ? 'var(--color-primary)' : 'transparent' }} onClick={() => addProduct(p)}>
                                            <span className="chip-name">{p.name}</span>
                                            <span className="chip-price">{p.price > 0 ? `${p.price.toFixed(2)}€` : 'prix libre'}</span>
                                            {inCart && <span className="chip-qty-badge">{inCart.qty}</span>}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Custom article */}
                            <div className="custom-article-box">
                                <p className="custom-article-label">➕ Ajouter un article hors catalogue</p>
                                <div className="custom-article-row">
                                    <input
                                        type="text"
                                        className="custom-article-name"
                                        placeholder="Nom de l'article..."
                                        value={customName}
                                        onChange={e => setCustomName(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && addCustomArticle()}
                                    />
                                    <div className="custom-article-price-wrap">
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="Prix"
                                            value={customPrice}
                                            onChange={e => setCustomPrice(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && addCustomArticle()}
                                            className="custom-article-price"
                                        />
                                        <span>€</span>
                                    </div>
                                    <button
                                        className="btn-primary custom-article-add"
                                        onClick={addCustomArticle}
                                        disabled={!customName.trim()}
                                        type="button"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Notes supplémentaires */}
                            <div className="form-group">
                                <label>Notes pour le labo (déco, allergies...)</label>
                                <textarea
                                    value={form.freeText}
                                    onChange={e => setForm(f => ({ ...f, freeText: e.target.value }))}
                                    placeholder={"Ex: bougie dorée, décor mariage, sans gluten"}
                                    rows={2}
                                    style={{ resize: 'none' }}
                                />
                            </div>
                        </div>
                    )}

                    {/* ── Step 3: Recap & Payment ── */}
                    {step === 3 && (
                        <div className="step-content">
                            <div className="recap-card">
                                <div className="recap-row"><span>Client</span><strong>{form.customerName}</strong></div>
                                {form.customerPhone && <div className="recap-row"><span>Téléphone</span><span>{form.customerPhone}</span></div>}
                                <div className="recap-row">
                                    <span>Articles</span>
                                    <div style={{ textAlign: 'right', fontSize: '0.9rem' }}>
                                        {form.items.map(i => <div key={i.id}>{i.qty}× {i.name}</div>)}
                                        {form.freeText && <div style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>{form.freeText}</div>}
                                    </div>
                                </div>
                            </div>

                            <div className="payment-row">
                                <div className="form-group">
                                    <label>📅 Date de retrait *</label>
                                    <input type="date" required value={form.pickupDate} onChange={e => setForm(f => ({ ...f, pickupDate: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label>⏰ Heure de retrait</label>
                                    <input type="time" value={form.pickupTime || ''} onChange={e => setForm(f => ({ ...f, pickupTime: e.target.value }))} />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>🏭 Début de production prévu</label>
                                <input type="date" value={form.productionStartDate || ''} onChange={e => setForm(f => ({ ...f, productionStartDate: e.target.value }))} />
                                <span className="field-hint">Quand faut-il commencer à préparer cette commande ? Cette date alimente le planning de production.</span>
                            </div>

                            <div className="payment-row">
                                <div className="form-group">
                                    <label>Prix total (€)</label>
                                    <div className="input-icon-wrap">
                                        <Euro size={15} className="input-icon" />
                                        <input
                                            type="number" step="0.01"
                                            value={form.totalPrice}
                                            onChange={e => setForm(f => ({ ...f, totalPrice: e.target.value }))}
                                            placeholder={catalogTotal > 0 ? catalogTotal.toFixed(2) : '0.00'}
                                        />
                                    </div>
                                    {catalogTotal > 0 && !form.totalPrice && (
                                        <span className="field-hint">Calculé depuis le catalogue : {catalogTotal.toFixed(2)} €</span>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label>Acompte versé (€)</label>
                                    <div className="input-icon-wrap">
                                        <Euro size={15} className="input-icon" />
                                        <input
                                            type="number" step="0.01"
                                            value={form.deposit}
                                            onChange={e => setForm(f => ({ ...f, deposit: e.target.value }))}
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                            </div>

                            {effectiveTotal > 0 && (
                                <div className="remaining-pill">
                                    Reste à percevoir le jour du retrait : <strong>{remaining.toFixed(2)} €</strong>
                                </div>
                            )}

                            <div className="form-group">
                                <label>Notes pour le labo</label>
                                <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Sans gluten, décor floral, bougie rose..." />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Navigation */}
                <div className="drawer-footer">
                    {step > 1 ? (
                        <button className="btn-secondary" onClick={() => setStep(s => s - 1)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <ChevronLeft size={18} /> Retour
                        </button>
                    ) : <div />}

                    {step < 3 ? (
                        <button
                            className="btn-primary"
                            disabled={step === 1 ? !canProceed1 : !canProceed2}
                            onClick={() => setStep(s => s + 1)}
                            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                            Suivant <ChevronRight size={18} />
                        </button>
                    ) : (
                        <button className="btn-primary" disabled={!canSubmit} onClick={handleSubmit} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <CheckCircle2 size={18} /> Enregistrer la commande
                        </button>
                    )}
                </div>
            </div>
        </>
    );
}

/* ─────────── ORDER CARD ─────────── */
function OrderCard({ order, onStatusChange, onDelete, onSendToPlanning }) {
    const status = order.status || 'en_attente';
    const color = STATUS_COLORS[status] || '#f59e0b';
    const [showPlanPanel, setShowPlanPanel] = useState(false);
    const [prodDate, setProdDate] = useState('');

    const fmt = (dateStr) => dateStr
        ? new Date(dateStr + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
        : null;

    const openPanel = () => {
        setProdDate(order.productionStartDate || '');
        setShowPlanPanel(true);
    };

    const suggestJMoins1 = () => {
        if (!order.pickupDate) return;
        const d = new Date(order.pickupDate + 'T12:00:00');
        d.setDate(d.getDate() - 1);
        setProdDate(d.toISOString().slice(0, 10));
    };

    const handleConfirm = () => {
        onSendToPlanning(order, prodDate);
        setShowPlanPanel(false);
    };

    return (
        <div className="order-card">
            <div className="order-card-header">
                <div>
                    <div className="order-customer">{order.customerName}</div>
                    {order.customerPhone && <div className="order-phone">📞 {order.customerPhone}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="order-status-badge" style={{ backgroundColor: color + '22', color, border: `1px solid ${color}` }}>
                        {STATUS_LABELS[status]}
                    </div>
                    <button className="btn-icon delete" onClick={() => onDelete(order.id)}><Trash2 size={16} /></button>
                </div>
            </div>

            <div className="order-items">{order.items}</div>

            <div className="order-footer">
                <div className="order-meta">
                    <Clock size={14} />
                    <span>Retrait : <strong>{fmt(order.pickupDate) || 'Non précisé'}</strong>
                        {order.pickupTime && <span style={{ marginLeft: 6, color: 'var(--color-primary)' }}> à {order.pickupTime}</span>}
                    </span>
                </div>
                {order.productionStartDate && (
                    <div className="order-meta" style={{ color: '#6366f1' }}>
                        <Factory size={14} />
                        <span>Production : <strong>{fmt(order.productionStartDate)}</strong></span>
                    </div>
                )}
                {order.deposit > 0 && (
                    <div className="order-deposit">Acompte : {parseFloat(order.deposit).toFixed(2)} €</div>
                )}
            </div>

            {
                order.totalPrice > 0 && (
                    <div className="order-total-row">
                        Reste à percevoir : <strong style={{ color: 'var(--color-primary-dark)' }}>{Math.max(0, order.totalPrice - (order.deposit || 0)).toFixed(2)} €</strong>
                        <span style={{ marginLeft: 8, color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>(Total : {parseFloat(order.totalPrice).toFixed(2)} €)</span>
                    </div>
                )
            }
            {order.notes && <div className="order-notes">📝 {order.notes}</div>}

            {/* ── Panel inline de planification ── */}
            {
                showPlanPanel && (
                    <div className="plan-inline-panel">
                        <div className="plan-inline-title"><Factory size={15} /> Planifier la production</div>
                        <p className="plan-inline-hint">
                            Quand commencer à préparer la commande de <strong>{order.customerName}</strong>
                            {order.pickupDate && <> (retrait le <strong>{fmt(order.pickupDate)}</strong>)</>} ?
                        </p>
                        <div className="plan-inline-row">
                            <input
                                type="date"
                                value={prodDate}
                                onChange={e => setProdDate(e.target.value)}
                                className="plan-inline-date"
                            />
                            {order.pickupDate && (
                                <button className="plan-suggest-btn" onClick={suggestJMoins1} title="La veille du retrait">
                                    Veille du retrait
                                </button>
                            )}
                        </div>
                        <div className="plan-inline-actions">
                            <button className="plan-inline-cancel" onClick={() => setShowPlanPanel(false)}>Annuler</button>
                            <button className="plan-inline-confirm" onClick={handleConfirm} disabled={!prodDate}>
                                <Factory size={14} /> Envoyer en planning
                            </button>
                        </div>
                    </div>
                )
            }

            <div className="order-actions">
                {(status === 'en_attente' || status === 'pending') && !showPlanPanel && (
                    <button className="btn-action" style={{ background: '#eef2ff', color: '#6366f1', border: '1px solid #c7d2fe' }}
                        onClick={openPanel}>
                        <Factory size={15} /> Envoyer en planning
                    </button>
                )}
                {status === 'en_production' && (
                    <button className="btn-action ready" onClick={() => onStatusChange(order, 'pret')}>
                        <CheckCircle2 size={15} /> Marquer Prêt
                    </button>
                )}
                {(status === 'pret' || status === 'ready') && (
                    <button className="btn-action collected" onClick={() => onStatusChange(order, 'recupere')}>
                        <Truck size={15} /> Marquer Récupéré
                    </button>
                )}
                {(status === 'recupere' || status === 'collected') && (
                    <span className="collected-badge">✅ Commande terminée</span>
                )}
            </div>
        </div >
    );
}

/* ─────────── CALENDAR VIEW ─────────── */
function CalendarView({ orders, onStatusChange, onDelete, onAddForDate }) {
    const today = new Date();
    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth());
    const [selectedDay, setSelectedDay] = useState(null);

    const ordersByDate = {};
    orders.forEach(order => {
        if (order.pickupDate && order.status !== 'collected') {
            if (!ordersByDate[order.pickupDate]) ordersByDate[order.pickupDate] = [];
            ordersByDate[order.pickupDate].push(order);
        }
    });

    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    let startOffset = firstDayOfMonth.getDay() - 1;
    if (startOffset < 0) startOffset = 6;

    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const prevMonth = () => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); } else setViewMonth(m => m - 1); setSelectedDay(null); };
    const nextMonth = () => { if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); } else setViewMonth(m => m + 1); setSelectedDay(null); };
    const formatDateKey = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const todayKey = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());
    const selectedKey = selectedDay ? formatDateKey(viewYear, viewMonth, selectedDay) : null;
    const selectedOrders = selectedKey ? (ordersByDate[selectedKey] || []) : [];

    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    return (
        <div className="calendar-wrapper">
            <div className="calendar-main">
                <div className="cal-nav">
                    <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
                    <h3 className="cal-title">{MONTHS_FR[viewMonth]} {viewYear}</h3>
                    <button className="cal-nav-btn" onClick={nextMonth}>›</button>
                </div>
                <div className="cal-grid">
                    {DAYS_FR.map(d => <div key={d} className="cal-day-header">{d}</div>)}
                    {cells.map((day, i) => {
                        if (!day) return <div key={`e${i}`} className="cal-cell empty" />;
                        const key = formatDateKey(viewYear, viewMonth, day);
                        const dayOrders = ordersByDate[key] || [];
                        const isToday = key === todayKey;
                        const isSelected = selectedDay === day;
                        const hasReady = dayOrders.some(o => o.status === 'ready');
                        const hasPending = dayOrders.some(o => o.status === 'pending');
                        return (
                            <div key={day} className={`cal-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${dayOrders.length > 0 ? 'has-orders' : ''}`} onClick={() => setSelectedDay(isSelected ? null : day)}>
                                <span className="cal-day-num">{day}</span>
                                {dayOrders.length > 0 && (
                                    <div className="cal-dots">
                                        {hasReady && <span className="cal-dot ready" />}
                                        {hasPending && <span className="cal-dot pending" />}
                                        <span className="cal-order-count">{dayOrders.length}</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                <div className="cal-legend">
                    <div className="legend-item"><span className="cal-dot ready" /> Prêt</div>
                    <div className="legend-item"><span className="cal-dot pending" /> En attente</div>
                </div>
            </div>

            <div className="cal-detail-panel">
                {selectedDay ? (
                    <>
                        <div className="cal-detail-header">
                            <h3>{new Date(viewYear, viewMonth, selectedDay).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
                            <button className="btn-primary" style={{ padding: '8px 16px', display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.85rem' }} onClick={() => onAddForDate(formatDateKey(viewYear, viewMonth, selectedDay))}>
                                <Plus size={14} /> Ajouter
                            </button>
                        </div>
                        {selectedOrders.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {selectedOrders.map(o => <OrderCard key={o.id} order={o} onStatusChange={onStatusChange} onDelete={onDelete} />)}
                            </div>
                        ) : (
                            <div className="cal-empty-day"><Calendar size={32} color="var(--color-border)" /><p>Aucune commande ce jour</p></div>
                        )}
                    </>
                ) : (
                    <div className="cal-empty-day"><Calendar size={40} color="var(--color-border)" /><p>Cliquez sur un jour<br />pour voir les commandes</p></div>
                )}
            </div>
        </div>
    );
}

/* ─────────── MAIN COMPONENT ─────────── */
export default function Orders() {
    const [orders, setOrders] = useState([]);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [filterStatus, setFilterStatus] = useState('pending');
    const [viewMode, setViewMode] = useState('list');
    const [prefillDate, setPrefillDate] = useState('');

    const loadOrders = async () => {
        const data = await getOrders();
        setOrders(data.sort((a, b) => new Date(a.pickupDate || '9999') - new Date(b.pickupDate || '9999')));
    };

    useEffect(() => { loadOrders(); }, []);
    useEffect(() => {
        const handler = () => loadOrders();
        window.addEventListener('devisConverted', handler);
        window.addEventListener('catalogUpdated', handler);
        return () => {
            window.removeEventListener('devisConverted', handler);
            window.removeEventListener('catalogUpdated', handler);
        };
    }, []);

    const handleStatusChange = async (order, nextStatus) => { await saveOrder({ ...order, status: nextStatus }); loadOrders(); };
    const handleDelete = async (id) => { if (confirm('Supprimer cette commande ?')) { await deleteOrder(id); loadOrders(); } };

    const handleSendToPlanning = async (order, prodDate) => {
        await saveOrder({ ...order, productionStartDate: prodDate, status: 'en_production' });
        loadOrders();
        window.dispatchEvent(new Event('planningUpdated'));
    };

    const openDrawer = (dateStr = '') => { setPrefillDate(dateStr); setIsDrawerOpen(true); };
    const handleSave = async (orderData) => { await saveOrder(orderData); loadOrders(); };

    const ALL_STATUSES = ['en_attente', 'en_production', 'pret', 'recupere'];
    const filtered = orders.filter(o => filterStatus === 'all' || (o.status || 'en_attente') === filterStatus);
    const counts = orders.reduce((acc, o) => {
        const s = o.status || 'en_attente';
        acc[s] = (acc[s] || 0) + 1;
        return acc;
    }, {});

    const urgentOrders = orders.filter(o => {
        if (o.status === 'collected' || !o.pickupDate) return false;
        const diff = (new Date(o.pickupDate + 'T12:00:00') - new Date()) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= 7;
    });

    return (
        <div className="admin-container" style={{ overflowY: 'auto', paddingBottom: 60 }}>
            <div className="admin-header">
                <h2><ClipboardList /> Commandes & Réservations</h2>
                <div style={{ display: 'flex', gap: 12 }}>
                    <div className="view-toggle">
                        <button className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}><List size={16} /></button>
                        <button className={`toggle-btn ${viewMode === 'calendar' ? 'active' : ''}`} onClick={() => setViewMode('calendar')}><Calendar size={16} /></button>
                    </div>
                    <button className="btn-primary" onClick={() => openDrawer()} style={{ padding: '0.8rem 1.5rem', display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Plus size={18} /> Nouvelle Commande
                    </button>
                </div>
            </div>

            {urgentOrders.length > 0 && (
                <div className="urgent-banner">
                    🔔 <strong>{urgentOrders.length} commande{urgentOrders.length > 1 ? 's' : ''}</strong> à honorer dans les 7 prochains jours
                    <div className="urgent-list">
                        {urgentOrders.map(o => {
                            const diff = Math.round((new Date(o.pickupDate + 'T12:00:00') - new Date()) / (1000 * 60 * 60 * 24));
                            return (
                                <span key={o.id} className="urgent-chip" style={{ backgroundColor: diff === 0 ? '#fee2e2' : diff === 1 ? '#fff7ed' : '#f0fdf4' }}>
                                    {diff === 0 ? '🚨 Aujourd\'hui' : diff === 1 ? '⚠️ Demain' : `📅 J+${diff}`} — {o.customerName}
                                </span>
                            );
                        })}
                    </div>
                </div>
            )}

            {viewMode === 'calendar' ? (
                <CalendarView orders={orders} onStatusChange={handleStatusChange} onDelete={handleDelete} onAddForDate={openDrawer} />
            ) : (
                <>
                    <div className="order-filter-tabs">
                        {['all', ...ALL_STATUSES].map(s => (
                            <button key={s} className={`filter-tab ${filterStatus === s ? 'active' : ''}`} onClick={() => setFilterStatus(s)}>
                                {s === 'all' ? 'Toutes' : STATUS_LABELS[s]}
                                <span className="tab-count">{s === 'all' ? orders.length : (counts[s] || 0)}</span>
                            </button>
                        ))}
                    </div>
                    <div className="orders-list">
                        {filtered.map(o => <OrderCard key={o.id} order={o} onStatusChange={handleStatusChange} onDelete={handleDelete} onSendToPlanning={handleSendToPlanning} />)}
                        {filtered.length === 0 && (
                            <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 60 }}>
                                Aucune commande.<br />
                                <button className="btn-primary" style={{ marginTop: 16, padding: '10px 20px', display: 'inline-flex', gap: 8 }} onClick={() => openDrawer()}>
                                    <Plus size={16} /> Créer une commande
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}

            <OrderDrawer open={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} onSave={handleSave} prefillDate={prefillDate} />
        </div>
    );
}
