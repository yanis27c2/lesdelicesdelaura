import { useState, useEffect } from 'react';
import { History, Trash2, Edit2, Check, X, Clock, ShoppingBag, CreditCard, Banknote, Landmark, Save, Plus } from 'lucide-react';
import { getAllSales, updateSale, deleteSale } from '../../db/indexedDB';
import './SalesHistory.css';

const PAYMENT_METHODS = [
    { id: 'especes', label: 'Espèces', icon: Banknote },
    { id: 'cb', label: 'Carte Bancaire', icon: CreditCard },
    { id: 'virement', label: 'Virement', icon: Landmark },
    { id: 'autre', label: 'Autre', icon: ShoppingBag }
];

export default function SalesHistory() {
    const [sales, setSales] = useState([]);
    const [editingSale, setEditingSale] = useState(null);

    const loadSales = async () => {
        const all = await getAllSales();
        // Sort by timestamp descending
        setSales(all.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
    };

    useEffect(() => {
        loadSales();
        window.addEventListener('saleAdded', loadSales);
        return () => window.removeEventListener('saleAdded', loadSales);
    }, []);

    const handleDelete = async (id) => {
        if (window.confirm('Supprimer cette vente définitivement ?')) {
            await deleteSale(id);
            loadSales();
        }
    };

    const handleSaveEdit = async (updatedSale) => {
        await updateSale(updatedSale);
        setEditingSale(null);
        loadSales();
    };

    const formatTime = (ts) => {
        const d = new Date(ts);
        return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (ts) => {
        const d = new Date(ts);
        return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    };

    return (
        <div className="sales-history-container">
            <div className="sales-history-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ background: 'var(--color-primary-light)', padding: 10, borderRadius: 12 }}>
                        <History size={24} color="var(--color-primary)" />
                    </div>
                    <div>
                        <h2 style={{ margin: 0 }}>Historique des Ventes</h2>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                            {sales.length} vente(s) locales en attente de synchronisation
                        </p>
                    </div>
                </div>
            </div>

            {sales.length === 0 ? (
                <div className="history-empty">
                    <div style={{ background: '#f8fafc', padding: 30, borderRadius: '50%' }}>
                        <ShoppingBag size={48} color="var(--color-border)" />
                    </div>
                    <h3>Aucune vente en local</h3>
                    <p>Vos ventes téléversées sont archivées et consultables sur Google Sheets.</p>
                </div>
            ) : (
                <div className="sales-list">
                    {sales.map(sale => (
                        <div key={sale.id} className="sale-item-card">
                            <div className="sale-item-header">
                                <div className="sale-time">
                                    <Clock size={16} />
                                    {formatDate(sale.timestamp)} à {formatTime(sale.timestamp)}
                                    {sale.synced && <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}><Check size={14} /> Synchro</span>}
                                </div>
                                <div className="sale-total">{parseFloat(sale.totalPrice || 0).toFixed(2)} €</div>
                            </div>

                            <div className="sale-details">
                                {sale.items.map((item, idx) => (
                                    <div key={idx} className="sale-item-row">
                                        <span>{item.quantity}x {item.name}</span>
                                        <span style={{ fontWeight: 600 }}>{(item.price * item.quantity).toFixed(2)}€</span>
                                    </div>
                                ))}
                            </div>

                            <div className="sale-footer">
                                <div className="payment-method-badge" style={{ 
                                    background: sale.paymentMethod === 'especes' ? '#fef3c7' : sale.paymentMethod === 'cb' ? '#dbeafe' : '#f3f4f6',
                                    color: sale.paymentMethod === 'especes' ? '#92400e' : sale.paymentMethod === 'cb' ? '#1e40af' : '#374151'
                                }}>
                                    {PAYMENT_METHODS.find(m => m.id === sale.paymentMethod)?.icon && 
                                        (() => {
                                            const Icon = PAYMENT_METHODS.find(m => m.id === sale.paymentMethod).icon;
                                            return <Icon size={14} />;
                                        })()
                                    }
                                    {PAYMENT_METHODS.find(m => m.id === sale.paymentMethod)?.label || sale.paymentMethod}
                                </div>
                                
                                <div className="sale-actions">
                                    <button className="btn-icon" onClick={() => setEditingSale(sale)} title="Modifier">
                                        <Edit2 size={18} />
                                    </button>
                                    <button className="btn-icon delete" onClick={() => handleDelete(sale.id)} title="Supprimer">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {editingSale && (
                <SaleEditDrawer 
                    sale={editingSale} 
                    onClose={() => setEditingSale(null)} 
                    onSave={handleSaveEdit} 
                />
            )}
        </div>
    );
}

function SaleEditDrawer({ sale, onClose, onSave }) {
    const [editedSale, setEditedSale] = useState(JSON.parse(JSON.stringify(sale)));

    const updateItem = (index, field, value) => {
        const newItems = [...editedSale.items];
        newItems[index][field] = field === 'name' ? value : parseFloat(value) || 0;
        
        // Recalculate total
        const newTotal = newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        setEditedSale({
            ...editedSale,
            items: newItems,
            totalPrice: newTotal,
            subtotal: newTotal, // Adjust if you have complex taxes/discounts
            itemsCount: newItems.reduce((sum, item) => sum + item.quantity, 0)
        });
    };

    const removeItem = (index) => {
        const newItems = editedSale.items.filter((_, i) => i !== index);
        const newTotal = newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        setEditedSale({
            ...editedSale,
            items: newItems,
            totalPrice: newTotal,
            subtotal: newTotal,
            itemsCount: newItems.reduce((sum, item) => sum + item.quantity, 0)
        });
    };

    return (
        <div className="sale-editor-overlay" onClick={onClose}>
            <div className="sale-editor-drawer" onClick={e => e.stopPropagation()}>
                <div className="drawer-header">
                    <h3 style={{ margin: 0 }}>Modifier la vente #{sale.id}</h3>
                    <button className="btn-icon" onClick={onClose}><X size={24} /></button>
                </div>

                <div className="drawer-content">
                    <h4 style={{ marginBottom: 12 }}>Articles</h4>
                    {editedSale.items.map((item, idx) => (
                        <div key={idx} className="edit-item-row" style={{ gridTemplateColumns: '2fr 80px 80px auto' }}>
                            <div>
                                <label className="edit-label">Produit</label>
                                <input 
                                    className="edit-input" 
                                    value={item.name} 
                                    onChange={e => updateItem(idx, 'name', e.target.value)} 
                                />
                            </div>
                            <div>
                                <label className="edit-label">Qté</label>
                                <input 
                                    className="edit-input" 
                                    type="number" 
                                    value={item.quantity} 
                                    onChange={e => updateItem(idx, 'quantity', e.target.value)} 
                                />
                            </div>
                            <div>
                                <label className="edit-label">Prix unitaire</label>
                                <input 
                                    className="edit-input" 
                                    type="number" 
                                    step="0.01" 
                                    value={item.price} 
                                    onChange={e => updateItem(idx, 'price', e.target.value)} 
                                />
                            </div>
                            <button className="btn-icon delete" onClick={() => removeItem(idx)} style={{ marginTop: 20 }}>
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}

                    <h4 style={{ marginTop: 32, marginBottom: 16 }}>Moyen de paiement</h4>
                    <div className="payment-grid">
                        {PAYMENT_METHODS.map(m => (
                            <div 
                                key={m.id} 
                                className={`payment-opt ${editedSale.paymentMethod === m.id ? 'active' : ''}`}
                                onClick={() => setEditedSale({ ...editedSale, paymentMethod: m.id })}
                            >
                                <m.icon size={20} />
                                <span>{m.label}</span>
                            </div>
                        ))}
                    </div>

                    <div className="total-display">
                        <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>Nouveau Total</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{parseFloat(editedSale.totalPrice).toFixed(2)} €</div>
                    </div>
                </div>

                <div className="drawer-footer">
                    <button className="btn btn-primary" style={{ flex: 1, padding: '14px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => onSave(editedSale)}>
                        <Save size={20} /> Enregistrer les modifications
                    </button>
                </div>
            </div>
        </div>
    );
}
