import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Package, X } from 'lucide-react';
import { getProducts, getCategories, deleteProduct, saveProduct, saveCategory } from '../../db/indexedDB';
import { getInitialColor } from '../../data/productColors';
import './ProductManager.css';

export default function ProductManager() {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);

    // Form State
    const [formData, setFormData] = useState({ name: '', price: '', categoryId: '', stock: '', alertThreshold: '', color: '#fbcfe8' });
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryIcon, setNewCategoryIcon] = useState('🍰');

    const loadData = async () => {
        setLoading(true);
        try {
            const p = await getProducts();
            p.sort((a, b) => a.name.localeCompare(b.name));

            // Restaurer les couleurs d'origine pour les cartes de produits si nécessaire
            for (const prod of p) {
                if (!prod.color || prod.color === '#fbcfe8') {
                    const origColor = getInitialColor(prod);
                    if (origColor !== prod.color) {
                        prod.color = origColor;
                        await saveProduct(prod);
                    }
                }
            }

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
        setIsCreatingCategory(false);
        setNewCategoryName('');
        setNewCategoryIcon('🍰');

        if (product) {
            setEditingProduct(product);
            setFormData({
                name: product.name,
                price: product.price,
                categoryId: product.categoryId,
                stock: product.stock !== undefined ? product.stock : 0,
                alertThreshold: product.alertThreshold !== undefined ? product.alertThreshold : 0,
                color: product.color && product.color !== '#fbcfe8' ? product.color : getInitialColor(product)
            });
        } else {
            setEditingProduct(null);
            const defaultCatId = categories[0]?.id || '';
            if (categories.length === 0) {
                setIsCreatingCategory(true);
            }
            setFormData({ name: '', price: '', categoryId: defaultCatId, stock: '', alertThreshold: '', color: '#fbcfe8' });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingProduct(null);
        setIsCreatingCategory(false);
        setNewCategoryName('');
    };

    const handleSave = async (e) => {
        e.preventDefault();

        let targetCategoryId = formData.categoryId;

        if (isCreatingCategory) {
            const cleanName = newCategoryName.trim();
            if (!cleanName) {
                alert('Veuillez saisir un nom pour la nouvelle catégorie.');
                return;
            }

            // Vérifier si la catégorie existe déjà (insensible à la casse)
            const existingCat = categories.find(c => c.name.trim().toLowerCase() === cleanName.toLowerCase());
            if (existingCat) {
                targetCategoryId = existingCat.id;
            } else {
                const newCat = {
                    id: `cat_${Date.now()}`,
                    name: cleanName,
                    icon: newCategoryIcon || '🍰'
                };
                await saveCategory(newCat);
                targetCategoryId = newCat.id;
            }
        } else {
            if (!targetCategoryId && categories.length > 0) {
                targetCategoryId = categories[0].id;
            }
        }

        const newStockVal = parseInt(formData.stock) || 0;
        const productToSave = {
            id: editingProduct ? editingProduct.id : `prod_${Date.now()}`,
            name: formData.name,
            price: parseFloat(formData.price) || 0,
            categoryId: targetCategoryId,
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

        await loadData();
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

    const handleQuickStockChange = async (product, newStock) => {
        const val = parseInt(newStock) || 0;
        const productToSave = { ...product, stock: val };
        await saveProduct(productToSave);

        const { logStockMovement } = await import('../../db/indexedDB');
        const diff = val - (product.stock || 0);
        await logStockMovement(product.id, product.name, diff, val, 'manuel', 'admin_inline');

        await loadData();
        window.dispatchEvent(new Event('catalogUpdated'));
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
                            const cardColor = getInitialColor(product);
                            return (
                                <tr key={product.id}>
                                    <td>
                                        <div className="color-swatch" style={{ backgroundColor: cardColor }}></div>
                                    </td>
                                    <td style={{ fontWeight: 500 }}>{product.name}</td>
                                    <td style={{ color: 'var(--color-text-muted)' }}>{cat ? cat.name : 'Inconnue'}</td>
                                    <td style={{ fontWeight: 600, color: 'var(--color-primary-dark)' }}>{product.price.toFixed(2)}</td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <input
                                                type="number"
                                                min="0"
                                                className="inline-stock-input"
                                                defaultValue={product.stock !== undefined ? product.stock : 0}
                                                key={`${product.id}-${product.stock}`}
                                                onBlur={async (e) => {
                                                    const val = parseInt(e.target.value);
                                                    if (!isNaN(val) && val !== (product.stock || 0)) {
                                                        await handleQuickStockChange(product, val);
                                                    }
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.target.blur();
                                                    }
                                                }}
                                                style={{
                                                    width: '65px',
                                                    padding: '5px 8px',
                                                    borderRadius: '6px',
                                                    border: '1px solid var(--color-border)',
                                                    fontWeight: 600,
                                                    fontSize: '0.9rem',
                                                    textAlign: 'center'
                                                }}
                                                title="Saisir directement le stock"
                                            />
                                            <span className={`stock-badge ${product.stock > (product.alertThreshold || 0) ? 'ok' : product.stock > 0 ? 'low' : 'out'}`}>
                                                {product.stock > (product.alertThreshold || 0) ? 'OK' : product.stock > 0 ? 'Bas' : '0'}
                                            </span>
                                        </div>
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
                                <div className="form-group" style={{ flex: 1.2 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                        <label style={{ margin: 0 }}>Catégorie</label>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsCreatingCategory(!isCreatingCategory);
                                                setNewCategoryName('');
                                            }}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: 'var(--color-primary-dark, #db2777)',
                                                fontSize: '0.82rem',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                padding: '2px 4px',
                                                textDecoration: 'underline'
                                            }}
                                        >
                                            {isCreatingCategory ? '← Choisir une existante' : '+ Nouvelle catégorie'}
                                        </button>
                                    </div>

                                    {!isCreatingCategory ? (
                                        <select
                                            required={!isCreatingCategory}
                                            value={formData.categoryId}
                                            onChange={e => {
                                                if (e.target.value === '__NEW__') {
                                                    setIsCreatingCategory(true);
                                                    setNewCategoryName('');
                                                } else {
                                                    setFormData({ ...formData, categoryId: e.target.value });
                                                }
                                            }}
                                        >
                                            {categories.map(c => (
                                                <option key={c.id} value={c.id}>
                                                    {c.icon ? `${c.icon} ` : ''}{c.name}
                                                </option>
                                            ))}
                                            <option value="__NEW__">➕ Créer une nouvelle catégorie...</option>
                                        </select>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <input
                                                type="text"
                                                autoFocus
                                                required={isCreatingCategory}
                                                placeholder="Ex: Viennoiseries, Boissons..."
                                                value={newCategoryName}
                                                onChange={e => setNewCategoryName(e.target.value)}
                                            />
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Icône :</span>
                                                {['🍰', '🎂', '🍪', '🥐', '🥖', '🧁', '🥪', '☕', '🏷️'].map(emoji => (
                                                    <button
                                                        key={emoji}
                                                        type="button"
                                                        onClick={() => setNewCategoryIcon(emoji)}
                                                        style={{
                                                            background: newCategoryIcon === emoji ? '#fce7f3' : 'transparent',
                                                            border: newCategoryIcon === emoji ? '1px solid #ec4899' : '1px solid transparent',
                                                            borderRadius: '6px',
                                                            fontSize: '1.1rem',
                                                            cursor: 'pointer',
                                                            padding: '2px 4px',
                                                            lineHeight: 1
                                                        }}
                                                    >
                                                        {emoji}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>Couleur</label>
                                    <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
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
