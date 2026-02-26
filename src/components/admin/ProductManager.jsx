import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Package, X } from 'lucide-react';
import { getProducts, getCategories, deleteProduct, saveProduct } from '../../db/indexedDB';
import './ProductManager.css';

export default function ProductManager() {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);

    // Form State
    const [formData, setFormData] = useState({ name: '', price: '', categoryId: '', stock: '', color: '#fbcfe8' });

    const loadData = async () => {
        setLoading(true);
        try {
            const p = await getProducts();
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
                color: product.color || '#fbcfe8'
            });
        } else {
            setEditingProduct(null);
            setFormData({ name: '', price: '', categoryId: categories[0]?.id || '', stock: '', color: '#fbcfe8' });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingProduct(null);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const productToSave = {
            id: editingProduct ? editingProduct.id : `prod_${Date.now()}`,
            name: formData.name,
            price: parseFloat(formData.price),
            categoryId: formData.categoryId,
            stock: parseInt(formData.stock) || 0,
            color: formData.color
        };

        await saveProduct(productToSave);
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
                                        <span className={`stock-badge ${product.stock > 10 ? 'ok' : product.stock > 0 ? 'low' : 'out'}`}>
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

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Prix (€)</label>
                                    <input required type="number" step="0.01" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Stock</label>
                                    <input required type="number" value={formData.stock} onChange={e => setFormData({ ...formData, stock: e.target.value })} />
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
