import { useState, useEffect } from 'react';
import { getCategories, getProducts } from '../../db/indexedDB';
import './ProductGrid.css';

export default function ProductGrid({ onAddToCart }) {
    const [categories, setCategories] = useState([]);
    const [products, setProducts] = useState([]);
    const [activeCategory, setActiveCategory] = useState(null);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        try {
            const cats = await getCategories();
            const prods = await getProducts();
            setCategories(cats);
            setProducts(prods);
            if (cats.length > 0 && !activeCategory) {
                setActiveCategory(cats[0].id);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        // Listen for global catalog updates
        window.addEventListener('catalogUpdated', loadData);
        return () => window.removeEventListener('catalogUpdated', loadData);
    }, []);

    if (loading) return <div style={{ padding: 24 }}>Chargement des produits...</div>;
    if (categories.length === 0) return <div style={{ padding: 24 }}>Aucun produit. Veuillez en ajouter dans le Catalogue.</div>;

    const filteredProducts = products.filter(p => p.categoryId === activeCategory);

    return (
        <div className="product-grid-container">
            {/* Category Tabs */}
            <div className="category-tabs">
                {categories.map(cat => (
                    <button
                        key={cat.id}
                        className={`category-tab ${activeCategory === cat.id ? 'active' : ''}`}
                        onClick={() => setActiveCategory(cat.id)}
                    >
                        <span className="cat-icon">{cat.icon}</span>
                        <span className="cat-name">{cat.name}</span>
                    </button>
                ))}
            </div>

            {/* Products Grid */}
            <div className="products-grid">
                {filteredProducts.map(product => {
                    const isOutOfStock = product.stock <= 0;
                    return (
                        <button
                            key={product.id}
                            className={`product-card animate-slide-up ${isOutOfStock ? 'out-of-stock' : ''}`}
                            style={{ backgroundColor: isOutOfStock ? '#f3f4f6' : product.color }}
                            onClick={() => !isOutOfStock && onAddToCart(product)}
                            disabled={isOutOfStock}
                        >
                            <div className="product-info">
                                <span className="product-name">{product.name}</span>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span className="product-price">{product.price.toFixed(2)} €</span>
                                    {product.stock !== undefined && (
                                        <span style={{ fontSize: '0.8rem', color: isOutOfStock ? '#ef4444' : '#6b7280', fontWeight: 600 }}>
                                            Stock: {product.stock}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>
    );
}
