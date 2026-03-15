import { useState, useEffect } from 'react';
import { History, Trash2, Edit2, Check, X, Clock, ShoppingBag, CreditCard, Banknote, Landmark } from 'lucide-react';
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
    const [editingId, setEditingId] = useState(null);
    const [tempPayment, setTempPayment] = useState('');

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
        if (window.confirm('Supprimer cette vente ?')) {
            await deleteSale(id);
            loadSales();
        }
    };

    const startEdit = (sale) => {
        setEditingId(sale.id);
        setTempPayment(sale.paymentMethod);
    };

    const saveEdit = async (sale) => {
        await updateSale({ ...sale, paymentMethod: tempPayment });
        setEditingId(null);
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
                <h2><History size={24} /> Historique des Ventes locales</h2>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                    {sales.length} vente(s) réalisée(s) depuis le dernier téléversement
                </div>
            </div>

            {sales.length === 0 ? (
                <div className="history-empty">
                    <History size={48} color="var(--color-border)" />
                    <p style={{ marginTop: 12 }}>Aucune vente en local.<br />Les ventes téléversées sont archivées dans Google Sheets.</p>
                </div>
            ) : (
                <div className="sales-list">
                    {sales.map(sale => (
                        <div key={sale.id} className="sale-item-card">
                            <div className="sale-item-header">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div className="sale-time">
                                        <Clock size={14} style={{ marginRight: 4 }} />
                                        {formatDate(sale.timestamp)} à {formatTime(sale.timestamp)}
                                    </div>
                                    {sale.synced && <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 600 }}>☁️ Synchronisé</span>}
                                </div>
                                <div className="sale-total">{parseFloat(sale.totalPrice || 0).toFixed(2)} €</div>
                            </div>

                            <div className="sale-details">
                                {sale.items.map((item, idx) => (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                        <span>{item.quantity}x {item.name}</span>
                                        <span style={{ color: 'var(--color-text-muted)' }}>{(item.price * item.quantity).toFixed(2)}€</span>
                                    </div>
                                ))}
                            </div>

                            <div className="sale-footer">
                                <div style={{ flex: 1 }}>
                                    {editingId === sale.id ? (
                                        <div className="payment-select-row">
                                            {PAYMENT_METHODS.map(m => (
                                                <button 
                                                    key={m.id} 
                                                    className={`pay-btn ${tempPayment === m.id ? 'active' : ''}`}
                                                    onClick={() => setTempPayment(m.id)}
                                                >
                                                    <m.icon size={14} style={{ marginRight: 4 }} />
                                                    {m.label}
                                                </button>
                                            ))}
                                            <button className="btn-icon" onClick={() => saveEdit(sale)} style={{ background: '#10b981', color: 'white' }}><Check size={16} /></button>
                                            <button className="btn-icon" onClick={() => setEditingId(null)}><X size={16} /></button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <span className="payment-method-badge" style={{ 
                                                background: sale.paymentMethod === 'especes' ? '#fef3c7' : sale.paymentMethod === 'cb' ? '#dbeafe' : '#f3f4f6',
                                                color: sale.paymentMethod === 'especes' ? '#92400e' : sale.paymentMethod === 'cb' ? '#1e40af' : '#374151'
                                            }}>
                                                {PAYMENT_METHODS.find(m => m.id === sale.paymentMethod)?.label || sale.paymentMethod}
                                            </span>
                                            <button className="payment-edit-btn" onClick={() => startEdit(sale)}>
                                                <Edit2 size={12} style={{ marginRight: 4 }} />
                                                Modifier paiement
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="sale-actions">
                                    <button className="btn-icon delete" onClick={() => handleDelete(sale.id)} alt="Supprimer"><Trash2 size={16} /></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
