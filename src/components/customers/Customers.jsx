import { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Star, CheckSquare, Phone, X } from 'lucide-react';
import { getCustomers, saveCustomer, deleteCustomer } from '../../db/indexedDB';
import './Customers.css';

const LOYALTY_THRESHOLD = 10; // visits needed for a free pastry

export default function Customers() {
    const [customers, setCustomers] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({ name: '', phone: '' });
    const [search, setSearch] = useState('');

    const loadCustomers = async () => {
        const data = await getCustomers();
        setCustomers(data.sort((a, b) => a.name.localeCompare(b.name)));
    };

    useEffect(() => { loadCustomers(); }, []);

    const handleAddVisit = async (customer) => {
        const updated = { ...customer, visits: (customer.visits || 0) + 1 };
        if (updated.visits >= LOYALTY_THRESHOLD) {
            alert(`🎉 ${customer.name} a atteint ${LOYALTY_THRESHOLD} visites ! Offrez-lui une pâtisserie gratuite ! Les points vont être remis à zéro.`);
            updated.visits = 0;
            updated.totalRewards = (customer.totalRewards || 0) + 1;
        }
        await saveCustomer(updated);
        loadCustomers();
    };

    const handleDelete = async (id) => {
        if (confirm('Supprimer ce client ?')) {
            await deleteCustomer(id);
            loadCustomers();
        }
    };

    const handleAddCustomer = async (e) => {
        e.preventDefault();
        await saveCustomer({ name: formData.name, phone: formData.phone });
        setFormData({ name: '', phone: '' });
        setIsModalOpen(false);
        loadCustomers();
    };

    const filtered = customers.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.phone && c.phone.includes(search))
    );

    return (
        <div className="admin-container">
            <div className="admin-header">
                <h2><Users /> Fichier Clients & Fidélité</h2>
                <button className="btn-primary" onClick={() => setIsModalOpen(true)} style={{ padding: '0.8rem 1.5rem', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Plus size={18} /> Nouveau Client
                </button>
            </div>

            <div style={{ marginBottom: 16 }}>
                <input
                    type="text"
                    placeholder="🔍 Rechercher par nom ou téléphone..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--color-border)', fontSize: '1rem' }}
                />
            </div>

            <div className="loyalty-info-bar">
                <Star size={16} color="#f59e0b" />
                Carte de fidélité : <strong>{LOYALTY_THRESHOLD} visites</strong> = 1 pâtisserie offerte !
            </div>

            <div className="customers-grid">
                {filtered.map(c => {
                    const progress = Math.min((c.visits || 0) / LOYALTY_THRESHOLD * 100, 100);
                    const remaining = Math.max(LOYALTY_THRESHOLD - (c.visits || 0), 0);
                    return (
                        <div key={c.id} className="customer-card">
                            <div className="customer-header">
                                <div>
                                    <div className="customer-name">{c.name}</div>
                                    {c.phone && <div className="customer-phone"><Phone size={13} /> {c.phone}</div>}
                                </div>
                                <button className="btn-icon delete" onClick={() => handleDelete(c.id)}>
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <div className="loyalty-progress-bar-track">
                                <div className="loyalty-progress-bar-fill" style={{ width: `${progress}%` }} />
                            </div>
                            <div className="loyalty-visits-row">
                                <span>{c.visits || 0} / {LOYALTY_THRESHOLD} visites</span>
                                <span className="remaining-hint">
                                    {remaining > 0 ? `encore ${remaining} pour un cadeau 🎁` : '🎉 Récompense disponible !'}
                                </span>
                            </div>

                            {(c.totalRewards || 0) > 0 && (
                                <div className="reward-count"><Star size={14} /> {c.totalRewards} récompense{c.totalRewards > 1 ? 's' : ''} offerte{c.totalRewards > 1 ? 's' : ''}</div>
                            )}

                            <button className="btn-visit" onClick={() => handleAddVisit(c)}>
                                <CheckSquare size={16} /> Enregistrer une visite
                            </button>
                        </div>
                    );
                })}
                {filtered.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 40, gridColumn: '1/-1' }}>
                        Aucun client trouvé.
                    </div>
                )}
            </div>

            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: 450 }}>
                        <div className="modal-header">
                            <h2>Nouveau Client</h2>
                            <button className="close-btn" onClick={() => setIsModalOpen(false)}><X size={24} /></button>
                        </div>
                        <form onSubmit={handleAddCustomer} className="product-form">
                            <div className="form-group">
                                <label>Nom complet *</label>
                                <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Marie Dupont" />
                            </div>
                            <div className="form-group">
                                <label>Téléphone (optionnel)</label>
                                <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="06 12 34 56 78" />
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Annuler</button>
                                <button type="submit" className="btn-primary">Enregistrer</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
