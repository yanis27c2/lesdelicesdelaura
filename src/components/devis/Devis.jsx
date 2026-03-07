import { useState, useEffect } from 'react';
import {
    FileText, Plus, Send, CheckCircle2, XCircle, Clock, Trash2,
    User, Package, Euro, Search, Minus, ChevronRight, ChevronLeft,
    X, AlertTriangle, ShoppingBag, FileCheck, Copy, ArrowRight, Edit3, Eye
} from 'lucide-react';
import { getDevis, saveDevis, deleteDevis, getCustomers, getProducts, getCategories, saveOrder } from '../../db/indexedDB';
import './Devis.css';

// ─────────── CONFIG ───────────
const STATUS_CONFIG = {
    brouillon: { label: 'Brouillon', color: '#64748b', bg: '#f1f5f9' },
    envoye: { label: 'Envoyé', color: '#f59e0b', bg: '#fffbeb' },
    accepte: { label: 'Accepté', color: '#10b981', bg: '#ecfdf5' },
    refuse: { label: 'Refusé', color: '#ef4444', bg: '#fef2f2' },
    expire: { label: 'Expiré', color: '#94a3b8', bg: '#f8fafc' },
    converti: { label: 'Converti', color: '#8b5cf6', bg: '#f5f3ff' },
};

const TABS = [
    { key: 'all', label: 'Tous' },
    { key: 'brouillon', label: 'Brouillons' },
    { key: 'envoye', label: 'Envoyés' },
    { key: 'accepte', label: 'Acceptés' },
    { key: 'converti', label: 'Convertis' },
];

function formatNumero(id, year) {
    return `DEV-${year || new Date().getFullYear()}-${String(id).padStart(3, '0')}`;
}

const EMPTY_FORM = {
    customerName: '', customerPhone: '', customerEmail: '',
    items: [], freeText: '', totalPrice: '', discount: '',
    validityDate: '', notes: ''
};

// ─────────── DEVIS DRAWER (STANDARDIZED) ───────────
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

    useEffect(() => {
        if (open) {
            setStep(1);
            if (editData) {
                setForm({
                    ...editData,
                    items: editData.parsedItems || []
                });
            } else {
                const d = new Date();
                d.setDate(d.getDate() + 30);
                setForm({ ...EMPTY_FORM, validityDate: d.toISOString().split('T')[0] });
            }
            getProducts().then(setProducts);
            getCategories().then(setCategories);
            getCustomers().then(setCustomers);
        }
    }, [open, editData]);

    const addProduct = (p) => {
        setForm(f => {
            const existing = f.items.find(i => i.id === p.id);
            if (existing) return { ...f, items: f.items.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i) };
            return { ...f, items: [...f.items, { ...p, qty: 1 }] };
        });
    };

    const updateQty = (id, delta) => {
        setForm(f => ({
            ...f,
            items: f.items.map(i => i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i).filter(i => i.qty > 0)
        }));
    };

    const catalogTotal = form.items.reduce((s, i) => s + (i.price * i.qty), 0);
    const effectiveTotal = (parseFloat(form.totalPrice) || catalogTotal) - (parseFloat(form.discount) || 0);

    const handleSubmit = async () => {
        const itemsSummary = form.items.map(i => `${i.qty}× ${i.name} (${(i.price * i.qty).toFixed(2)}€)`).join('\n');
        await onSave({
            ...form,
            totalPrice: parseFloat(form.totalPrice) || catalogTotal,
            discount: parseFloat(form.discount) || 0,
            parsedItems: form.items,
            items: itemsSummary + (form.freeText ? `\n\nNote: ${form.freeText}` : '')
        });
        onClose();
    };

    if (!open) return null;

    return (
        <>
            <div className={`drawer-overlay ${open ? 'open' : ''}`} onClick={onClose} />
            <div className={`order-drawer ${open ? 'open' : ''}`}>
                <div className="drawer-header">
                    <div className="drawer-title">
                        <FileText size={20} color="var(--devis-primary)" />
                        {editData ? 'Modifier le devis' : 'Nouveau devis'}
                    </div>
                    <button className="close-btn" onClick={onClose}><X size={22} /></button>
                </div>

                <div className="drawer-steps">
                    {[{ n: 1, label: 'Client' }, { n: 2, label: 'Articles' }, { n: 3, label: 'Finaliser' }].map(s => (
                        <div key={s.n} className={`step-item ${step === s.n ? 'active' : ''} ${step > s.n ? 'done' : ''}`}
                            onClick={() => step > s.n && setStep(s.n)}>
                            <div className="step-circle">{step > s.n ? '✓' : s.n}</div>
                            <span>{s.label}</span>
                        </div>
                    ))}
                </div>

                <div className="drawer-body">
                    {step === 1 && (
                        <div className="step-content">
                            <p className="step-hint">Informations du client pour la proposition commerciale</p>
                            <div className="form-group">
                                <label>Nom du client *</label>
                                <div className="input-icon-wrap">
                                    <Search size={16} className="input-icon" />
                                    <input type="text" value={form.customerName} placeholder="Rechercher ou saisir..." autoFocus
                                        onChange={e => {
                                            setForm(f => ({ ...f, customerName: e.target.value }));
                                            setCustomerSearch(e.target.value);
                                            setShowSuggestions(true);
                                        }}
                                        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)} />
                                    {showSuggestions && customerSearch.length > 1 && (
                                        <div className="suggestions-dropdown">
                                            {customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase())).slice(0, 5).map(c => (
                                                <div key={c.id} className="suggestion-item" onMouseDown={() => {
                                                    setForm(f => ({ ...f, customerName: c.name, customerPhone: c.phone || '', customerEmail: c.email || '' }));
                                                    setShowSuggestions(false);
                                                }}>
                                                    {c.name} {c.phone && <small>({c.phone})</small>}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="payment-row">
                                <div className="form-group">
                                    <label>Téléphone</label>
                                    <input type="tel" value={form.customerPhone} onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))} placeholder="06..." />
                                </div>
                                <div className="form-group">
                                    <label>Email</label>
                                    <input type="email" value={form.customerEmail} onChange={e => setForm(f => ({ ...f, customerEmail: e.target.value }))} placeholder="marie@..." />
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="step-content">
                            <div className="products-selection-layout">
                                <div className="selection-main">
                                    <div className="cat-filter-row">
                                        <button className={`cat-chip ${activeCat === 'all' ? 'active' : ''}`} onClick={() => setActiveCat('all')}>Tous</button>
                                        {categories.map(c => (
                                            <button key={c.id} className={`cat-chip ${activeCat === c.id ? 'active' : ''}`} onClick={() => setActiveCat(c.id)}>{c.name}</button>
                                        ))}
                                    </div>
                                    <div className="products-picker-grid">
                                        {products.filter(p => {
                                            const matchCat = activeCat === 'all' || p.categoryId === activeCat;
                                            const matchSearch = p.name.toLowerCase().includes(productSearch.toLowerCase());
                                            return matchCat && matchSearch;
                                        }).map(p => {
                                            const inCart = form.items.find(i => i.id === p.id);
                                            return (
                                                <div key={p.id} className={`product-chip ${inCart ? 'selected' : ''}`}
                                                    style={{ background: p.color + '15', border: '2px solid ' + (inCart ? 'var(--devis-primary)' : 'transparent') }}
                                                    onClick={() => addProduct(p)}>
                                                    <strong>{p.name}</strong>
                                                    <span>{p.price.toFixed(2)}€</span>
                                                    {inCart && <span className="chip-qty-badge">{inCart.qty}</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="cart-preview">
                                    <h4><ShoppingBag size={18} /> Sélection ({form.items.length})</h4>
                                    <div className="cart-items-list">
                                        {form.items.map(item => (
                                            <div key={item.id} className="cart-item">
                                                <div className="item-info">
                                                    <div className="item-name">{item.name}</div>
                                                    <div className="item-price">{(item.price * item.qty).toFixed(2)}€</div>
                                                </div>
                                                <div className="qty-controls">
                                                    <button className="qty-btn" onClick={() => updateQty(item.id, -1)}><Minus size={12} /></button>
                                                    <span className="qty-val">{item.qty}</span>
                                                    <button className="qty-btn" onClick={() => updateQty(item.id, 1)}><Plus size={12} /></button>
                                                </div>
                                            </div>
                                        ))}
                                        {form.items.length === 0 && <p className="empty-hint">Aucun article sélectionné</p>}
                                    </div>
                                    {form.items.length > 0 && (
                                        <div className="cart-total-mini">
                                            Sous-total: <strong>{catalogTotal.toFixed(2)} €</strong>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="step-content">
                            <div className="finalization-layout">
                                <div className="final-form">
                                    <div className="form-group">
                                        <label>Date de validité</label>
                                        <input type="date" value={form.validityDate} onChange={e => setForm(f => ({ ...f, validityDate: e.target.value }))} />
                                    </div>
                                    <div className="payment-row">
                                        <div className="form-group">
                                            <label>Total personnalisé (€)</label>
                                            <input type="number" placeholder={catalogTotal.toFixed(2)} value={form.totalPrice} onChange={e => setForm(f => ({ ...f, totalPrice: e.target.value }))} />
                                        </div>
                                        <div className="form-group">
                                            <label>Remise (€)</label>
                                            <input type="number" value={form.discount} onChange={e => setForm(f => ({ ...f, discount: e.target.value }))} />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>Notes internes</label>
                                        <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes..." rows={3} />
                                    </div>
                                </div>
                                <div className="live-preview">
                                    <div className="preview-paper">
                                        <div className="preview-header">
                                            <strong>{form.customerName || 'Nom Client'}</strong>
                                            <small>Expire le {new Date(form.validityDate).toLocaleDateString('fr-FR')}</small>
                                        </div>
                                        <div className="preview-items">
                                            {form.items.map(i => (
                                                <div key={i.id} className="preview-row">
                                                    <span>{i.qty}x {i.name}</span>
                                                    <span>{(i.price * i.qty).toFixed(2)}€</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="preview-total">
                                            Total: {effectiveTotal.toFixed(2)} €
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="drawer-footer">
                    <button className="devis-btn" onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}>
                        {step === 1 ? 'Annuler' : 'Retour'}
                    </button>
                    {step < 3 ? (
                        <button className="devis-new-btn" onClick={() => setStep(s => s + 1)} disabled={step === 1 && !form.customerName}>
                            Suivant <ChevronRight size={18} />
                        </button>
                    ) : (
                        <button className="devis-new-btn" onClick={handleSubmit}>
                            <FileCheck size={18} /> {editData ? 'Enregistrer' : 'Générer le Devis'}
                        </button>
                    )}
                </div>
            </div>
        </>
    );
}

// ─────────── DEVIS CARD ───────────
function DevisCard({ devis, onStatusChange, onDelete, onConvertToOrder, onEdit }) {
    const status = devis.status || 'brouillon';
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.brouillon;

    return (
        <div className="devis-card">
            <div className="devis-card-header">
                <div className="devis-header-left">
                    <div className="devis-numero">{devis.numero}</div>
                    <div className="devis-customer">{devis.customerName}</div>
                </div>
                <div className="devis-status-badge" style={{ background: cfg.bg, color: cfg.color }}>
                    {cfg.label}
                </div>
            </div>

            <div className="devis-items">
                {devis.parsedItems?.length > 0
                    ? devis.parsedItems.map(i => `${i.qty}× ${i.name}`).join(', ')
                    : devis.items?.substring(0, 100) + '...'}
            </div>

            <div className="devis-footer-row">
                <div className="devis-meta">
                    <span>Créé le {new Date(devis.createdAt).toLocaleDateString('fr-FR')}</span>
                    <strong>Expire le {new Date(devis.validityDate).toLocaleDateString('fr-FR')}</strong>
                </div>
                <div className="devis-total">
                    {(devis.totalPrice - (devis.discount || 0)).toFixed(2)} €
                </div>
            </div>

            <div className="devis-actions">
                {status === 'brouillon' && (
                    <button className="devis-btn" onClick={() => onStatusChange(devis, 'envoye')}><Send size={14} /> Envoyer</button>
                )}
                {status === 'envoye' && (
                    <>
                        <button className="devis-btn accepte" onClick={() => onStatusChange(devis, 'accepte')}><CheckCircle2 size={14} /> Accepter</button>
                        <button className="devis-btn" onClick={() => onStatusChange(devis, 'refuse')}><XCircle size={14} /> Refuser</button>
                    </>
                )}
                {status === 'accepte' && (
                    <button className="devis-btn convert" onClick={() => onConvertToOrder(devis)}><ShoppingBag size={14} /> Convertir</button>
                )}
                <button className="devis-btn" onClick={() => onEdit(devis)}><Edit3 size={14} /></button>
                <button className="devis-btn" onClick={() => onDelete(devis.id)} style={{ color: '#ef4444' }}><Trash2 size={14} /></button>
            </div>
        </div>
    );
}

// ─────────── MAIN COMPONENT ───────────
export default function Devis() {
    const [devisList, setDevisList] = useState([]);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingDevis, setEditingDevis] = useState(null);
    const [filterStatus, setFilterStatus] = useState('all');

    const load = async () => {
        const data = await getDevis();
        setDevisList(data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    };

    useEffect(() => { load(); }, []);

    const handleSave = async (data) => {
        const id = await saveDevis(data);
        if (!data.id) {
            const year = new Date().getFullYear();
            await saveDevis({
                ...data,
                id,
                numero: formatNumero(id, year),
                year,
                status: 'brouillon',
                createdAt: new Date().toISOString()
            });
        }
        load();
    };

    const handleStatusChange = async (d, nextStatus) => {
        await saveDevis({ ...d, status: nextStatus });
        load();
    };

    const handleDelete = async (id) => {
        if (confirm('Supprimer ce devis ?')) {
            await deleteDevis(id);
            load();
        }
    };

    const handleConvertToOrder = async (d) => {
        if (confirm(`Convertir le devis ${d.numero} en commande ?`)) {
            await saveOrder({
                customerName: d.customerName,
                customerPhone: d.customerPhone || '',
                items: d.items,
                parsedItems: d.parsedItems || [],
                totalPrice: (d.totalPrice || 0) - (d.discount || 0),
                deposit: 0,
                notes: `Via devis ${d.numero}`,
                pickupDate: d.pickupDate || '',
                status: 'en_attente'
            });
            await saveDevis({ ...d, status: 'converti' });
            load();
        }
    };

    return (
        <div className="devis-container">
            <div className="devis-header">
                <div className="devis-header-left">
                    <h2>Gestion des Devis</h2>
                    <span className="devis-header-sub">{devisList.length} devis au total dans votre base</span>
                </div>
                <button className="devis-new-btn" onClick={() => { setEditingDevis(null); setIsDrawerOpen(true); }}>
                    <Plus size={20} /> Nouveau Devis
                </button>
            </div>

            <div className="devis-stats-bar">
                <div className="stat-card devis-stat">
                    <div className="stat-icon">📑</div>
                    <div>
                        <div className="stat-number">{devisList.length}</div>
                        <div className="stat-label">Total</div>
                    </div>
                </div>
                <div className="stat-card devis-stat">
                    <div className="stat-icon" style={{ background: '#fffbeb' }}>📤</div>
                    <div>
                        <div className="stat-number">{devisList.filter(d => d.status === 'envoye').length}</div>
                        <div className="stat-label">Envoyés</div>
                    </div>
                </div>
                <div className="stat-card devis-stat">
                    <div className="stat-icon" style={{ background: '#ecfdf5' }}>✅</div>
                    <div>
                        <div className="stat-number">{devisList.filter(d => d.status === 'accepte').length}</div>
                        <div className="stat-label">Acceptés</div>
                    </div>
                </div>
                <div className="stat-card devis-stat">
                    <div className="stat-icon" style={{ background: '#f5f3ff' }}>🎯</div>
                    <div>
                        <div className="stat-number">{devisList.filter(d => d.status === 'converti').length}</div>
                        <div className="stat-label">Convertis</div>
                    </div>
                </div>
            </div>

            <div className="devis-tabs">
                {TABS.map(t => (
                    <button key={t.key} className={`filter-tab ${filterStatus === t.key ? 'active' : ''}`} onClick={() => setFilterStatus(t.key)}>
                        {t.label}
                        <span className="tab-count">
                            {t.key === 'all' ? devisList.length : devisList.filter(d => d.status === t.key).length}
                        </span>
                    </button>
                ))}
            </div>

            <div className="devis-list">
                {devisList.filter(d => filterStatus === 'all' || d.status === filterStatus).map(d => (
                    <DevisCard key={d.id} devis={d}
                        onStatusChange={handleStatusChange}
                        onDelete={handleDelete}
                        onEdit={(dev) => { setEditingDevis(dev); setIsDrawerOpen(true); }}
                        onConvertToOrder={handleConvertToOrder}
                    />
                ))}
            </div>

            <DevisDrawer open={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} onSave={handleSave} editData={editingDevis} />
        </div>
    );
}
