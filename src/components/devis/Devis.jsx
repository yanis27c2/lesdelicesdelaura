import { useState, useEffect } from 'react';
import {
    FileText, Plus, Send, CheckCircle2, XCircle, Clock, Trash2,
    User, Package, Euro, Search, Minus, ChevronRight, ChevronLeft,
    X, AlertTriangle, ShoppingBag, FileCheck, Copy, ArrowRight, Edit3
} from 'lucide-react';
import { getDevis, saveDevis, deleteDevis, getCustomers, getProducts, getCategories, saveOrder } from '../../db/indexedDB';
import './Devis.css';

// ─────────── STATUTS ───────────
const STATUS_CONFIG = {
    brouillon: { label: 'Brouillon', color: '#94a3b8', bg: '#f1f5f9', icon: '✏️' },
    envoye: { label: 'Envoyé', color: '#f59e0b', bg: '#fffbeb', icon: '📤' },
    accepte: { label: 'Accepté', color: '#10b981', bg: '#ecfdf5', icon: '✅' },
    refuse: { label: 'Refusé', color: '#ef4444', bg: '#fef2f2', icon: '❌' },
    expire: { label: 'Expiré', color: '#9ca3af', bg: '#f9fafb', icon: '⏰' },
    converti: { label: 'Converti', color: '#8b5cf6', bg: '#f5f3ff', icon: '🎯' },
};

const TABS = [
    { key: 'all', label: 'Tous' },
    { key: 'brouillon', label: 'Brouillons' },
    { key: 'envoye', label: 'Envoyés' },
    { key: 'accepte', label: 'Acceptés' },
    { key: 'refuse', label: 'Refusés' },
    { key: 'converti', label: 'Convertis' },
];

function formatNumero(id, year) {
    return `DEV-${year || new Date().getFullYear()}-${String(id).padStart(3, '0')}`;
}

function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysUntil(dateStr) {
    if (!dateStr) return null;
    const d = (new Date(dateStr + 'T23:59:59') - new Date()) / (1000 * 60 * 60 * 24);
    return Math.round(d);
}

const EMPTY_FORM = {
    customerName: '', customerPhone: '', customerEmail: '',
    items: [], freeText: '', totalPrice: '', discount: '',
    validityDate: '', notes: ''
};

// ─────────── DRAWER (création / édition) ───────────
function DevisDrawer({ open, onClose, onSave, editData = null }) {
    const [step, setStep] = useState(1);
    const [form, setForm] = useState(EMPTY_FORM);
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [activeCat, setActiveCat] = useState('all');
    const [productSearch, setProductSearch] = useState('');
    const [customers, setCustomers] = useState([]);
    const [customerSearch, setCustomerSearch] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [priceEdits, setPriceEdits] = useState({});
    const [customName, setCustomName] = useState('');
    const [customPrice, setCustomPrice] = useState('');

    // Default validity: 30 days from now
    const defaultValidity = () => {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        return d.toISOString().split('T')[0];
    };

    useEffect(() => {
        if (open) {
            setStep(1);
            if (editData) {
                setForm({
                    customerName: editData.customerName || '',
                    customerPhone: editData.customerPhone || '',
                    customerEmail: editData.customerEmail || '',
                    items: editData.itemsRaw || [],
                    freeText: editData.freeText || '',
                    totalPrice: editData.totalPrice ? String(editData.totalPrice) : '',
                    discount: editData.discount ? String(editData.discount) : '',
                    validityDate: editData.validityDate || defaultValidity(),
                    notes: editData.notes || ''
                });
            } else {
                setForm({ ...EMPTY_FORM, validityDate: defaultValidity() });
            }
            setProductSearch('');
            setCustomerSearch('');
            getProducts().then(setProducts);
            getCategories().then(setCategories);
            getCustomers().then(setCustomers);
        }
    }, [open]);

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
            if (existing) return { ...f, items: f.items.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i) };
            return { ...f, items: [...f.items, { id: product.id, name: product.name, price: product.price, qty: 1 }] };
        });
    };

    const updateQty = (id, delta) => {
        setForm(f => ({ ...f, items: f.items.map(i => i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i).filter(i => i.qty > 0) }));
    };

    const commitPrice = (id) => {
        const raw = priceEdits[id] ?? '';
        const parsed = parseFloat(raw.replace(',', '.'));
        setForm(f => ({ ...f, items: f.items.map(i => i.id === id ? { ...i, price: isNaN(parsed) ? 0 : parsed } : i) }));
    };

    const addCustomArticle = () => {
        if (!customName.trim()) return;
        const parsed = parseFloat(customPrice.replace(',', '.'));
        setForm(f => ({ ...f, items: [...f.items, { id: `custom_${Date.now()}`, name: customName.trim(), price: isNaN(parsed) ? 0 : parsed, qty: 1 }] }));
        setCustomName('');
        setCustomPrice('');
    };

    const catalogTotal = form.items.reduce((s, i) => s + i.price * i.qty, 0);
    const discount = parseFloat(form.discount) || 0;
    const effectiveTotal = (parseFloat(form.totalPrice) || catalogTotal) - discount;

    const handleSubmit = async () => {
        const itemsSummary = [
            ...form.items.map(i => `${i.qty}× ${i.name}${i.price > 0 ? ` (${(i.price * i.qty).toFixed(2)}€)` : ''}`),
            ...(form.freeText ? [form.freeText] : [])
        ].join('\n');

        await onSave({
            ...(editData ? { id: editData.id, status: editData.status, year: editData.year, numero: editData.numero, createdAt: editData.createdAt } : {}),
            customerName: form.customerName,
            customerPhone: form.customerPhone,
            customerEmail: form.customerEmail,
            items: itemsSummary,
            parsedItems: form.items,
            freeText: form.freeText,
            totalPrice: parseFloat(form.totalPrice) || catalogTotal,
            discount,
            validityDate: form.validityDate,
            pickupDate: form.pickupDate,
            notes: form.notes,
        });
        onClose();
    };

    const canProceed1 = form.customerName.trim().length > 0;
    const canProceed2 = form.items.length > 0 || form.freeText.trim().length > 0;
    const canSubmit = canProceed1 && canProceed2 && form.validityDate;

    if (!open) return null;

    return (
        <>
            <div className="drawer-overlay" onClick={onClose} />
            <div className="order-drawer open">
                {/* Header */}
                <div className="drawer-header devis-drawer-header">
                    <div className="drawer-header-brand">
                        <FileText size={22} />
                        <h2 className="drawer-title">{editData ? 'Modifier le devis' : 'Nouveau devis'}</h2>
                    </div>
                    <button className="close-btn" onClick={onClose}><X size={22} /></button>
                </div>

                {/* Step indicator */}
                <div className="drawer-steps">
                    {[{ n: 1, label: 'Client' }, { n: 2, label: 'Articles' }, { n: 3, label: 'Finaliser' }].map(({ n, label }) => (
                        <div key={n} className={`step-item ${step === n ? 'active' : ''} ${step > n ? 'done' : ''}`} onClick={() => step > n && setStep(n)}>
                            <div className="step-circle">{step > n ? '✓' : n}</div>
                            <span>{label}</span>
                        </div>
                    ))}
                </div>

                {/* Body */}
                <div className="drawer-body">
                    {/* Step 1 — Client */}
                    {step === 1 && (
                        <div className="step-content">
                            <p className="step-hint">Recherchez un client existant ou saisissez un nouveau contact.</p>
                            <div className="form-group" style={{ position: 'relative' }}>
                                <label>Nom du client *</label>
                                <div className="input-icon-wrap">
                                    <Search size={16} className="input-icon" />
                                    <input autoFocus type="text" value={form.customerName}
                                        onChange={e => { setForm(f => ({ ...f, customerName: e.target.value })); setCustomerSearch(e.target.value); setShowSuggestions(true); }}
                                        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                                        placeholder="Marie Dupont" />
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
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="form-group">
                                <label>Téléphone (optionnel)</label>
                                <input type="tel" value={form.customerPhone} onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))} placeholder="06 12 34 56 78" />
                            </div>
                            <div className="form-group">
                                <label>Email (optionnel)</label>
                                <input type="email" value={form.customerEmail} onChange={e => setForm(f => ({ ...f, customerEmail: e.target.value }))} placeholder="marie@example.com" />
                            </div>
                        </div>
                    )}

                    {/* Step 2 — Articles */}
                    {step === 2 && (
                        <div className="step-content">
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
                                            <div className="price-edit-wrap">
                                                <input type="text" inputMode="decimal"
                                                    value={priceEdits[item.id] ?? (item.price > 0 ? String(item.price) : '')}
                                                    onChange={e => setPriceEdits(p => ({ ...p, [item.id]: e.target.value }))}
                                                    onBlur={() => commitPrice(item.id)}
                                                    placeholder="0.00" className="price-edit-input" />
                                                <span className="price-edit-unit">€/u</span>
                                            </div>
                                            <span className="cart-mini-price">{item.price > 0 ? `= ${(item.price * item.qty).toFixed(2)}€` : '—'}</span>
                                        </div>
                                    ))}
                                    <div className="cart-mini-total">Sous-total : <strong>{catalogTotal.toFixed(2)} €</strong></div>
                                </div>
                            )}
                            <div className="cat-filter-row">
                                <button className={`cat-chip ${activeCat === 'all' ? 'active' : ''}`} onClick={() => setActiveCat('all')}>Tous</button>
                                {categories.map(c => (
                                    <button key={c.id} className={`cat-chip ${activeCat === c.id ? 'active' : ''}`} onClick={() => setActiveCat(c.id)}>{c.icon} {c.name}</button>
                                ))}
                            </div>
                            <div className="input-icon-wrap" style={{ marginBottom: 12 }}>
                                <Search size={16} className="input-icon" />
                                <input type="text" placeholder="Rechercher un produit..." value={productSearch} onChange={e => setProductSearch(e.target.value)} />
                            </div>
                            <div className="products-picker-grid">
                                {filteredProducts.map(p => {
                                    const inCart = form.items.find(i => i.id === p.id);
                                    return (
                                        <div key={p.id} className={`product-chip ${inCart ? 'selected' : ''}`}
                                            style={{ backgroundColor: p.color + (inCart ? '' : '99'), borderColor: inCart ? 'var(--color-primary)' : 'transparent' }}
                                            onClick={() => addProduct(p)}>
                                            <span className="chip-name">{p.name}</span>
                                            <span className="chip-price">{p.price > 0 ? `${p.price.toFixed(2)}€` : 'prix libre'}</span>
                                            {inCart && <span className="chip-qty-badge">{inCart.qty}</span>}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="custom-article-box">
                                <p className="custom-article-label">➕ Ajouter un article hors catalogue</p>
                                <div className="custom-article-row">
                                    <input type="text" className="custom-article-name" placeholder="Nom de l'article..."
                                        value={customName} onChange={e => setCustomName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCustomArticle()} />
                                    <div className="custom-article-price-wrap">
                                        <input type="number" step="0.01" placeholder="Prix" value={customPrice}
                                            onChange={e => setCustomPrice(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCustomArticle()} className="custom-article-price" />
                                        <span>€</span>
                                    </div>
                                    <button className="btn-primary custom-article-add" onClick={addCustomArticle} disabled={!customName.trim()} type="button"><Plus size={16} /></button>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Précisions / description libre</label>
                                <textarea value={form.freeText} onChange={e => setForm(f => ({ ...f, freeText: e.target.value }))}
                                    placeholder="Ex: décoration sur mesure, ingrédients spéciaux..." rows={2} style={{ resize: 'none' }} />
                            </div>
                        </div>
                    )}

                    {/* Step 3 — Finaliser */}
                    {step === 3 && (
                        <div className="step-content">
                            <div className="recap-card">
                                <div className="recap-row"><span>Client</span><strong>{form.customerName}</strong></div>
                                {form.customerPhone && <div className="recap-row"><span>Téléphone</span><span>{form.customerPhone}</span></div>}
                                {form.customerEmail && <div className="recap-row"><span>Email</span><span>{form.customerEmail}</span></div>}
                                <div className="recap-row">
                                    <span>Articles</span>
                                    <div style={{ textAlign: 'right', fontSize: '0.9rem' }}>
                                        {form.items.map(i => <div key={i.id}>{i.qty}× {i.name}</div>)}
                                        {form.freeText && <div style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>{form.freeText}</div>}
                                    </div>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>📅 Date de validité *</label>
                                <input type="date" required value={form.validityDate} onChange={e => setForm(f => ({ ...f, validityDate: e.target.value }))} />
                            </div>

                            <div className="form-group">
                                <label>🚗 Date de retrait (prévue)</label>
                                <input type="date" value={form.pickupDate || ''} onChange={e => setForm(f => ({ ...f, pickupDate: e.target.value }))} />
                                <span className="field-hint">Cette date sera pré-remplie lors de la conversion en commande</span>
                            </div>

                            <div className="payment-row">
                                <div className="form-group">
                                    <label>Prix total (€)</label>
                                    <div className="input-icon-wrap">
                                        <Euro size={15} className="input-icon" />
                                        <input type="number" step="0.01" value={form.totalPrice}
                                            onChange={e => setForm(f => ({ ...f, totalPrice: e.target.value }))}
                                            placeholder={catalogTotal > 0 ? catalogTotal.toFixed(2) : '0.00'} />
                                    </div>
                                    {catalogTotal > 0 && !form.totalPrice && (
                                        <span className="field-hint">Calculé depuis le catalogue : {catalogTotal.toFixed(2)} €</span>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label>Remise (€)</label>
                                    <div className="input-icon-wrap">
                                        <Euro size={15} className="input-icon" />
                                        <input type="number" step="0.01" value={form.discount}
                                            onChange={e => setForm(f => ({ ...f, discount: e.target.value }))}
                                            placeholder="0.00" />
                                    </div>
                                </div>
                            </div>

                            {effectiveTotal > 0 && (
                                <div className="remaining-pill devis-total-pill">
                                    Total devis (après remise) : <strong>{effectiveTotal.toFixed(2)} €</strong>
                                </div>
                            )}

                            <div className="form-group">
                                <label>Notes internes</label>
                                <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                    placeholder="Conditions particulières, remarques..." />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="drawer-footer">
                    {step > 1 ? (
                        <button className="btn-secondary" onClick={() => setStep(s => s - 1)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <ChevronLeft size={18} /> Retour
                        </button>
                    ) : <div />}
                    {step < 3 ? (
                        <button className="btn-primary" disabled={step === 1 ? !canProceed1 : !canProceed2}
                            onClick={() => setStep(s => s + 1)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            Suivant <ChevronRight size={18} />
                        </button>
                    ) : (
                        <button className="btn-primary" disabled={!canSubmit} onClick={handleSubmit} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <FileCheck size={18} /> {editData ? 'Mettre à jour' : 'Créer le devis'}
                        </button>
                    )}
                </div>
            </div>
        </>
    );
}

// ─────────── DEVIS CARD ───────────
function DevisCard({ devis, onStatusChange, onDelete, onConvertToOrder, onEdit }) {
    // Defensive: treat missing/undefined status as 'brouillon'
    const status = devis.status || 'brouillon';
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.brouillon;
    const days = daysUntil(devis.validityDate);
    const isExpired = days !== null && days < 0 && status !== 'refuse' && status !== 'converti';
    const isUrgent = days !== null && days >= 0 && days <= 3 && status === 'envoye';

    const isEditable = ['brouillon', 'envoye'].includes(status);

    const handleCardClick = (e) => {
        // Prevent triggering if clicking on action buttons or inner elements
        if (e.target.closest('.btn-icon') || e.target.closest('.devis-actions') || e.target.closest('.devis-status-badge')) {
            return;
        }
        if (isEditable) {
            onEdit(devis);
        }
    };

    return (
        <div
            className={`devis-card ${status} ${isExpired ? 'expired' : ''} ${isUrgent ? 'urgent-card' : ''} ${isEditable ? 'clickable-card' : ''}`}
            onClick={handleCardClick}
        >
            {/* Card Header */}
            <div className="devis-card-header">
                <div className="devis-card-left">
                    <div className="devis-numero">{devis.numero || `DEV-${devis.year || new Date().getFullYear()}-${String(devis.id).padStart(3, '0')}`}</div>
                    <div className="devis-customer">{devis.customerName}</div>
                    {devis.customerPhone && <div className="devis-phone">📞 {devis.customerPhone}</div>}
                </div>
                <div className="devis-card-right">
                    <div className="devis-status-badge" style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1.5px solid ${cfg.color}40` }}>
                        {cfg.icon} {cfg.label}
                    </div>
                    <div className="devis-card-actions-icons">
                        {isEditable && (
                            <button className="btn-icon edit" onClick={(e) => { e.stopPropagation(); onEdit(devis); }} title="Modifier">
                                <Edit3 size={15} />
                            </button>
                        )}
                        <button className="btn-icon delete" onClick={(e) => { e.stopPropagation(); onDelete(devis.id); }} title="Supprimer">
                            <Trash2 size={15} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Articles */}
            <div className="devis-items">{devis.items}</div>

            {/* Footer info */}
            <div className="devis-footer-row">
                <div className="devis-meta">
                    <span>📅 Créé le {formatDate(devis.createdAt)}</span>
                    {devis.validityDate && (
                        <span className={`devis-validity ${isExpired ? 'text-expired' : isUrgent ? 'text-urgent' : ''}`}>
                            {isExpired ? '⚠️ Expiré' : `🕐 Valable jusqu'au ${formatDate(devis.validityDate)}`}
                            {!isExpired && days !== null && days <= 7 && ` (J+${days})`}
                        </span>
                    )}
                </div>
                {devis.totalPrice > 0 && (
                    <div className="devis-price-block">
                        {devis.discount > 0 && <span className="devis-discount">-{parseFloat(devis.discount).toFixed(2)} €</span>}
                        <span className="devis-total">{Math.max(0, devis.totalPrice - (devis.discount || 0)).toFixed(2)} €</span>
                    </div>
                )}
            </div>

            {devis.notes && <div className="devis-notes">📝 {devis.notes}</div>}

            {/* Action Buttons */}
            <div className="devis-actions">
                {status === 'brouillon' && (
                    <button className="devis-btn envoye" onClick={() => onStatusChange(devis, 'envoye')}>
                        <Send size={14} /> Marquer Envoyé
                    </button>
                )}
                {status === 'envoye' && (
                    <>
                        <button className="devis-btn accepte" onClick={() => onStatusChange(devis, 'accepte')}>
                            <CheckCircle2 size={14} /> Accepté
                        </button>
                        <button className="devis-btn refuse" onClick={() => onStatusChange(devis, 'refuse')}>
                            <XCircle size={14} /> Refusé
                        </button>
                    </>
                )}
                {status === 'accepte' && (
                    <button className="devis-btn convert" onClick={() => onConvertToOrder(devis)}>
                        <ShoppingBag size={14} /> Convertir en commande <ArrowRight size={14} />
                    </button>
                )}
                {status === 'refuse' && <span className="devis-terminal-badge refuse">Devis refusé</span>}
                {status === 'expire' && <span className="devis-terminal-badge expire">Devis expiré</span>}
                {status === 'converti' && <span className="devis-terminal-badge converti">🎯 Converti en commande</span>}
            </div>
        </div>
    );
}

// ─────────── STATS BAR ───────────
function StatsBar({ devis }) {
    const total = devis.length;
    const envoyes = devis.filter(d => d.status === 'envoye').length;
    const acceptes = devis.filter(d => d.status === 'accepte').length;
    const refuses = devis.filter(d => d.status === 'refuse').length;
    const montantTotal = devis.filter(d => ['accepte', 'converti'].includes(d.status))
        .reduce((s, d) => s + Math.max(0, (d.totalPrice || 0) - (d.discount || 0)), 0);

    return (
        <div className="devis-stats-bar">
            <div className="stat-card devis-stat">
                <div className="stat-icon">📋</div>
                <div>
                    <div className="stat-number">{total}</div>
                    <div className="stat-label">Total devis</div>
                </div>
            </div>
            <div className="stat-card devis-stat">
                <div className="stat-icon">📤</div>
                <div>
                    <div className="stat-number" style={{ color: '#f59e0b' }}>{envoyes}</div>
                    <div className="stat-label">En attente réponse</div>
                </div>
            </div>
            <div className="stat-card devis-stat">
                <div className="stat-icon">✅</div>
                <div>
                    <div className="stat-number" style={{ color: '#10b981' }}>{acceptes}</div>
                    <div className="stat-label">Acceptés</div>
                </div>
            </div>
            <div className="stat-card devis-stat">
                <div className="stat-icon">💶</div>
                <div>
                    <div className="stat-number" style={{ color: 'var(--color-primary)' }}>{montantTotal.toFixed(0)} €</div>
                    <div className="stat-label">CA accepté</div>
                </div>
            </div>
        </div>
    );
}

// ─────────── COMPOSANT PRINCIPAL ───────────
export default function Devis() {
    const [devisList, setDevisList] = useState([]);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingDevis, setEditingDevis] = useState(null);
    const [filterStatus, setFilterStatus] = useState('all');

    const load = async () => {
        const data = await getDevis();
        // Auto-repair: fix any devis with missing status or missing numero
        const repaired = await Promise.all(data.map(async d => {
            let updated = { ...d };
            let needsSave = false;

            // Fix missing status
            if (!d.status) {
                updated.status = 'brouillon';
                needsSave = true;
            }
            // Fix missing numero
            if (!d.numero && d.id) {
                updated.numero = formatNumero(d.id, d.year || new Date().getFullYear());
                updated.year = d.year || new Date().getFullYear();
                needsSave = true;
            }
            // Auto-expire
            if (['brouillon', 'envoye'].includes(updated.status) && updated.validityDate) {
                const days = daysUntil(updated.validityDate);
                if (days < 0) {
                    updated.status = 'expire';
                    needsSave = true;
                }
            }

            if (needsSave) await saveDevis(updated);
            return updated;
        }));
        setDevisList(repaired.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
    };

    useEffect(() => {
        load();
        const handler = () => load();
        window.addEventListener('catalogUpdated', handler);
        return () => window.removeEventListener('catalogUpdated', handler);
    }, []);

    const handleSave = async (data) => {
        const id = await saveDevis(data);
        // If brand-new, assign a numero and ensure status is set
        if (!data.id) {
            const year = new Date().getFullYear();
            const numero = formatNumero(id, year);
            await saveDevis({
                ...data,
                id,
                numero,
                year,
                status: 'brouillon',
                createdAt: data.createdAt || new Date().toISOString(),
            });
        }
        load();
    };

    const handleStatusChange = async (d, nextStatus) => {
        await saveDevis({ ...d, status: nextStatus });
        load();
    };

    const handleDelete = async (id) => {
        if (!confirm('Supprimer ce devis définitivement ?')) return;
        await deleteDevis(id);
        load();
    };

    const handleConvertToOrder = async (d) => {
        if (!confirm(`Convertir le devis ${d.numero} en commande pour ${d.customerName} ?`)) return;
        await saveOrder({
            customerName: d.customerName,
            customerPhone: d.customerPhone || '',
            items: d.items,
            parsedItems: d.parsedItems || [],
            totalPrice: Math.max(0, (d.totalPrice || 0) - (d.discount || 0)),
            deposit: 0,
            notes: `Converti depuis devis ${d.numero}`,
            pickupDate: d.pickupDate || '',
            pickupTime: '',
            productionStartDate: '',
            status: 'en_attente'
        });
        await saveDevis({ ...d, status: 'converti' });
        load();
        window.dispatchEvent(new Event('devisConverted'));
        alert(`✅ Commande créée depuis ${d.numero} !\nLa date de retrait a été pré-remplie. Rendez-vous dans l'onglet Commandes pour finaliser.`);
    };

    const handleEdit = (d) => {
        setEditingDevis(d);
        setIsDrawerOpen(true);
    };

    const openNew = () => {
        setEditingDevis(null);
        setIsDrawerOpen(true);
    };

    const filtered = filterStatus === 'all' ? devisList : devisList.filter(d => d.status === filterStatus);
    const counts = devisList.reduce((acc, d) => {
        const s = d.status || 'brouillon';
        acc[s] = (acc[s] || 0) + 1;
        return acc;
    }, {});

    // Alert: devis envoyés depuis > 7 jours sans réponse
    const staleSent = devisList.filter(d => {
        if (d.status !== 'envoye') return false;
        const age = (new Date() - new Date(d.createdAt)) / (1000 * 60 * 60 * 24);
        return age > 7;
    });

    return (
        <div className="admin-container devis-container" style={{ overflowY: 'auto', paddingBottom: 60 }}>
            {/* Header */}
            <div className="admin-header devis-header">
                <div className="devis-header-left">
                    <div className="devis-header-icon"><FileText size={24} /></div>
                    <div>
                        <h2>Gestion des devis</h2>
                        <p className="devis-header-sub">Créez, suivez et convertissez vos propositions commerciales</p>
                    </div>
                </div>
                <button className="btn-primary devis-new-btn" onClick={openNew}>
                    <Plus size={18} /> Nouveau devis
                </button>
            </div>

            {/* Stats */}
            <StatsBar devis={devisList} />

            {/* Alert banner */}
            {staleSent.length > 0 && (
                <div className="devis-alert-banner">
                    <AlertTriangle size={18} />
                    <div>
                        <strong>{staleSent.length} devis envoyé{staleSent.length > 1 ? 's' : ''}</strong> sans réponse depuis plus de 7 jours :
                        <div className="devis-alert-list">
                            {staleSent.map(d => (
                                <span key={d.id} className="devis-alert-chip">
                                    {d.numero} — {d.customerName}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="order-filter-tabs devis-tabs">
                {TABS.map(t => (
                    <button key={t.key} className={`filter-tab ${filterStatus === t.key ? 'active' : ''}`} onClick={() => setFilterStatus(t.key)}>
                        {t.key !== 'all' && STATUS_CONFIG[t.key]?.icon + ' '}{t.label}
                        <span className="tab-count">{t.key === 'all' ? devisList.length : (counts[t.key] || 0)}</span>
                    </button>
                ))}
            </div>

            {/* List */}
            <div className="orders-list devis-list">
                {filtered.map(d => (
                    <DevisCard key={d.id} devis={d}
                        onStatusChange={handleStatusChange}
                        onDelete={handleDelete}
                        onConvertToOrder={handleConvertToOrder}
                        onEdit={handleEdit}
                    />
                ))}
                {filtered.length === 0 && (
                    <div className="devis-empty">
                        <FileText size={52} color="var(--color-border)" />
                        <p>Aucun devis {filterStatus !== 'all' ? `avec le statut "${STATUS_CONFIG[filterStatus]?.label}"` : ''}.</p>
                        <button className="btn-primary" style={{ marginTop: 16, padding: '10px 20px', display: 'inline-flex', gap: 8 }} onClick={openNew}>
                            <Plus size={16} /> Créer un devis
                        </button>
                    </div>
                )}
            </div>

            <DevisDrawer open={isDrawerOpen} onClose={() => { setIsDrawerOpen(false); setEditingDevis(null); }} onSave={handleSave} editData={editingDevis} />
        </div>
    );
}
