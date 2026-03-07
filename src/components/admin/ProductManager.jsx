import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Package, X, PackagePlus, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { getProducts, getCategories, deleteProduct, saveProduct } from '../../db/indexedDB';
import './ProductManager.css';

export default function ProductManager() {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);

    // Form State
    const [formData, setFormData] = useState({ name: '', price: '', categoryId: '', stock: '', alertThreshold: '', color: '#fbcfe8' });

    // Restock State
    const [qtyInputs, setQtyInputs] = useState({});
    const [dateInputs, setDateInputs] = useState({});
    const today = new Date().toISOString().slice(0, 10);

    const loadData = async () => {
        setLoading(true);
        try {
            const p = await getProducts();
            p.sort((a, b) => a.name.localeCompare(b.name));
            const c = await getCategories();
            setProducts(p);
            setCategories(c);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        const handleCatalogUpdate = () => {
            loadData();
        };
        window.addEventListener('catalogUpdated', handleCatalogUpdate);
        return () => {
            window.removeEventListener('catalogUpdated', handleCatalogUpdate);
        };
    }, []);

    const handleDelete = async (id) => {
        if (confirm('Voulez-vous vraiment supprimer ce produit ?')) {
            await deleteProduct(id);
            loadData();
            window.dispatchEvent(new Event('catalogUpdated'));
        }
    };

    const handleOpenModal = (product = null) => {
        if (product) {
            setEditingProduct(product);
            setFormData({
                name: product.name,
                price: product.price,
                categoryId: product.categoryId,
                stock: product.stock !== undefined ? product.stock : 0,
                alertThreshold: product.alertThreshold !== undefined ? product.alertThreshold : 0,
                color: product.color || '#fbcfe8'
            });
        } else {
            setEditingProduct(null);
            setFormData({ name: '', price: '', categoryId: categories[0]?.id || '', stock: '', alertThreshold: '', color: '#fbcfe8' });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingProduct(null);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const newStockVal = parseInt(formData.stock) || 0;
        const productToSave = {
            id: editingProduct ? editingProduct.id : `prod_${Date.now()}`,
            name: formData.name,
            price: parseFloat(formData.price),
            categoryId: formData.categoryId,
            stock: newStockVal,
            alertThreshold: parseInt(formData.alertThreshold) || 0,
            color: formData.color
        };

        await saveProduct(productToSave);

        // Log manual stock changes
        if (editingProduct && editingProduct.stock !== newStockVal) {
            const { logStockMovement } = await import('../../db/indexedDB');
            const diff = newStockVal - (editingProduct.stock || 0);
            await logStockMovement(productToSave.id, productToSave.name, diff, newStockVal, 'manuel', 'admin_edit');
        }

        loadData();
        window.dispatchEvent(new Event('catalogUpdated'));
        handleCloseModal();
    };

    const handleReset = async () => {
        if (confirm('ATTENTION: Cela va effacer tout votre catalogue et remettre les produits par défaut ! Êtes-vous sûr ?')) {
            const { clearCatalog } = await import('../../db/indexedDB');
            const { seedDatabaseIfEmpty } = await import('../../db/initData');

            setLoading(true);
            try {
                await clearCatalog();
                await seedDatabaseIfEmpty();
                await loadData();
                window.dispatchEvent(new Event('catalogUpdated'));
                alert('Catalogue réinitialisé avec succès avec les nouvelles données !');
            } catch (err) {
                console.error(err);
                alert('Erreur lors de la réinitialisation.');
            } finally {
                setLoading(false);
            }
        }
    };

    const handleCreateReassort = async (product) => {
        const qty = parseInt(qtyInputs[product.id]) || 0;
        const prodDate = dateInputs[product.id] || today;
        if (qty <= 0) return alert('Veuillez saisir une quantité supérieure à 0.');

        const orderData = {
            customerName: `Réassort Interne`,
            customerPhone: '',
            items: `${qty}x ${product.name}`,
            parsedItems: [{ id: product.id, qty }],
            totalPrice: 0,
            deposit: 0,
            status: 'en_attente',
            pickupDate: '',
            pickupTime: '',
            productionStartDate: prodDate,
            createdAt: new Date().toISOString(),
            notes: 'Production pour réapprovisionnement des stocks',
            type: 'reassort'
        };

        const { saveOrder } = await import('../../db/indexedDB');
        await saveOrder(orderData);
        setQtyInputs(prev => ({ ...prev, [product.id]: '' }));
        setDateInputs(prev => ({ ...prev, [product.id]: '' }));
        alert(`Ordre de réassort planifié le ${prodDate} pour ${qty}x ${product.name}. Retrouvez-le dans l'onglet Planning !`);
    };

    const lowStockProducts = products.filter(p => typeof p.stock === 'number' && typeof p.alertThreshold === 'number' && p.stock <= p.alertThreshold);

    if (loading) return <div style={{ padding: 24 }}>Chargement...</div>;

    return (
        <div className="admin-container">
            <div className="admin-header">
                <h2><Package /> Gestion du Catalogue</h2>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn-secondary" onClick={handleReset} style={{ padding: '0.8rem 1.5rem', display: 'flex', gap: 8, alignItems: 'center', borderColor: 'var(--color-primary)', color: 'var(--color-primary-dark)' }}>
                        Réinitialiser avec les données du tableur
                    </button>
                    <button className="btn-primary" onClick={() => handleOpenModal()} style={{ padding: '0.8rem 1.5rem', display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Plus size={18} /> Nouveau Produit
                    </button>
                </div>
            </div>

            {/* Alertes Stock & Réassort */}
            <div className="reassort-section" style={{ margin: '0 24px 24px' }}>
                <h3 className="section-title"><AlertTriangle size={18} color="#ef4444" /> Alertes Stock (Produits à refaire)</h3>
                {lowStockProducts.length === 0 ? (
                    <div className="planning-empty" style={{ padding: '2rem', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)' }}>
                        <CheckCircle2 size={40} color="#10b981" />
                        <p style={{ marginTop: '1rem' }}>Tous les stocks sont au-dessus de leur seuil d'alerte. Bravo !</p>
                    </div>
                ) : (
                    <div className="reassort-grid">
                        {lowStockProducts.map(p => (
                            <div key={p.id} className="reassort-card">
                                <div className="r-card-header">
                                    <div className="color-swatch" style={{ backgroundColor: p.color || '#ccc', width: 16, height: 16, borderRadius: '50%' }}></div>
                                    <strong>{p.name}</strong>
                                </div>
                                <div className="r-card-body">
                                    <span>Stock: <strong style={{ color: p.stock <= 0 ? '#ef4444' : '#f59e0b' }}>{p.stock || 0}</strong></span>
                                    <span>Seuil alerte: {p.alertThreshold || 0}</span>
                                </div>
                                <div className="r-card-actions" style={{ flexWrap: 'wrap', gap: '8px' }}>
                                    <input
                                        type="date"
                                        value={dateInputs[p.id] || today}
                                        onChange={e => setDateInputs({ ...dateInputs, [p.id]: e.target.value })}
                                        style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', width: '130px' }}
                                    />
                                    <input
                                        type="number"
                                        min="1"
                                        placeholder="Qté"
                                        value={qtyInputs[p.id] || ''}
                                        onChange={e => setQtyInputs({ ...qtyInputs, [p.id]: e.target.value })}
                                        style={{ flex: 1, minWidth: '80px' }}
                                    />
                                    <button className="btn-primary" onClick={() => handleCreateReassort(p)}>
                                        <PackagePlus size={16} /> Prod
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="products-table-container">
                <table className="products-table">
                    <thead>
                        <tr>
                            <th>Couleur</th>
                            <th>Nom</th>
                            <th>Catégorie</th>
                            <th>Prix (€)</th>
                            <th>Stock</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {products.map(product => {
                            const cat = categories.find(c => c.id === product.categoryId);
                            return (
                                <tr key={product.id}>
                                    <td>
                                        <div className="color-swatch" style={{ backgroundColor: product.color }}></div>
                                    </td>
                                    <td style={{ fontWeight: 500 }}>{product.name}</td>
                                    <td style={{ color: 'var(--color-text-muted)' }}>{cat ? cat.name : 'Inconnue'}</td>
                                    <td style={{ fontWeight: 600, color: 'var(--color-primary-dark)' }}>{product.price.toFixed(2)}</td>
                                    <td>
                                        <span className={`stock-badge ${product.stock > (product.alertThreshold || 0) ? 'ok' : product.stock > 0 ? 'low' : 'out'}`}>
                                            {product.stock || 0}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="actions">
                                            <button className="btn-icon edit" onClick={() => handleOpenModal(product)}><Edit2 size={16} /></button>
                                            <button className="btn-icon delete" onClick={() => handleDelete(product.id)}><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                        {products.length === 0 && (
                            <tr>
                                <td colSpan="6" style={{ textAlign: 'center', padding: 24 }}>Aucun produit dans le catalogue.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>{editingProduct ? 'Modifier le Produit' : 'Ajouter un Produit'}</h2>
                            <button className="close-btn" onClick={handleCloseModal}><X size={24} /></button>
                        </div>

                        <form onSubmit={handleSave} className="product-form">
                            <div className="form-group">
                                <label>Nom du produit</label>
                                <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                            </div>

                            <div className="form-row" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label style={{ textAlign: 'center', display: 'block' }}>Prix (€)</label>
                                    <input style={{ textAlign: 'center' }} required type="number" step="0.01" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} />
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label style={{ textAlign: 'center', display: 'block' }}>Stock en boutique</label>
                                    <input style={{ textAlign: 'center' }} required type="number" value={formData.stock} onChange={e => setFormData({ ...formData, stock: e.target.value })} />
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label style={{ textAlign: 'center', display: 'block' }}>Seuil minimum</label>
                                    <input style={{ textAlign: 'center' }} required type="number" value={formData.alertThreshold} onChange={e => setFormData({ ...formData, alertThreshold: e.target.value })} />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Catégorie</label>
                                    <select required value={formData.categoryId} onChange={e => setFormData({ ...formData, categoryId: e.target.value })}>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Couleur</label>
                                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                        {['#fbcfe8', '#fed7aa', '#fde047', '#dcfce7', '#bfdbfe', '#e9d5ff', '#f3f4f6'].map(col => (
                                            <div
                                                key={col}
                                                onClick={() => setFormData({ ...formData, color: col })}
                                                style={{
                                                    width: 32, height: 32, borderRadius: 8, backgroundColor: col, cursor: 'pointer',
                                                    border: formData.color === col ? '2px solid var(--color-primary-dark)' : '1px solid #ccc'
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={handleCloseModal}>Annuler</button>
                                <button type="submit" className="btn-primary">Enregistrer</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
