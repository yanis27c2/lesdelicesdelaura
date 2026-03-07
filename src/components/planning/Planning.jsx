import { useState, useEffect } from 'react';
import { getOrders, saveOrder, getProducts, getCategories, saveProduct } from '../../db/indexedDB';
import { CalendarClock, Factory, Clock, Truck, CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight, RefreshCw, PackagePlus, ArrowRight } from 'lucide-react';
import './Planning.css';

const STATUS_LABELS = {
    en_attente: 'En attente',
    en_production: 'En production',
    pret: 'Prêt à retirer',
    recupere: 'Récupéré',
    pending: 'En attente',
    ready: 'Prêt',
    collected: 'Récupéré',
};
const STATUS_COLORS = {
    en_attente: '#f59e0b',
    en_production: '#6366f1',
    pret: '#10b981',
    recupere: '#9ca3af',
};

function fmt(dateStr, opts = {}) {
    if (!dateStr) return null;
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', ...opts
    });
}

function daysFromNow(dateStr) {
    if (!dateStr) return null;
    return Math.round((new Date(dateStr + 'T12:00:00') - new Date()) / (1000 * 60 * 60 * 24));
}

/* ── Urgency badge ── */
function UrgencyBadge({ date }) {
    const d = daysFromNow(date);
    if (d === null) return null;
    if (d < 0) return <span className="urgency-badge late">🚨 En retard ({Math.abs(d)}j)</span>;
    if (d === 0) return <span className="urgency-badge today">🔴 Aujourd'hui</span>;
    if (d === 1) return <span className="urgency-badge soon">🟠 Demain</span>;
    if (d <= 3) return <span className="urgency-badge soon">🟡 Dans {d}j</span>;
    return <span className="urgency-badge ok">🟢 Dans {d}j</span>;
}

/* ── Planning Card ── */
function PlanningCard({ order, onStatusChange }) {
    const status = order.status || 'en_attente';
    const color = STATUS_COLORS[status] || '#f59e0b';
    const prodDays = daysFromNow(order.productionStartDate);

    return (
        <div className={`planning-card status-${status}`}>
            {/* Left accent bar */}
            <div className="planning-card-accent" style={{ backgroundColor: color }} />

            <div className="planning-card-body">
                {/* Header row */}
                <div className="planning-card-header">
                    <div>
                        <div className="planning-customer">{order.customerName}</div>
                        {order.customerPhone && (
                            <div className="planning-phone">📞 {order.customerPhone}</div>
                        )}
                    </div>
                    <div className="planning-status-badge" style={{ backgroundColor: color + '22', color, border: `1px solid ${color}` }}>
                        {STATUS_LABELS[status]}
                    </div>
                </div>

                {/* Items */}
                {order.items && (
                    <div className="planning-items">{order.items}</div>
                )}

                {/* Dates row */}
                <div className="planning-dates">
                    <div className="planning-date-block production">
                        <Factory size={14} />
                        <div>
                            <div className="date-label">Début production</div>
                            <div className="date-value">{fmt(order.productionStartDate) || '—'}</div>
                            {order.productionStartDate && <UrgencyBadge date={order.productionStartDate} />}
                        </div>
                    </div>
                    <div className="planning-date-sep">→</div>
                    <div className="planning-date-block pickup">
                        <Clock size={14} />
                        <div>
                            <div className="date-label">Retrait client</div>
                            <div className="date-value">
                                {fmt(order.pickupDate) || '—'}
                                {order.pickupTime && <span className="pickup-time"> à {order.pickupTime}</span>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Notes */}
                {order.notes && <div className="planning-notes">📝 {order.notes}</div>}

                {/* Actions */}
                <div className="planning-actions">
                    {(status === 'en_attente' || status === 'pending') && (
                        <button className="plan-btn production"
                            onClick={() => onStatusChange(order, 'en_production')}>
                            <Factory size={14} /> Démarrer production
                        </button>
                    )}
                    {status === 'en_production' && (
                        <button className="plan-btn ready"
                            onClick={() => onStatusChange(order, 'pret')}>
                            <CheckCircle2 size={14} /> Marquer Prêt
                        </button>
                    )}
                    {(status === 'pret' || status === 'ready') && (
                        <button className="plan-btn pickup"
                            onClick={() => onStatusChange(order, 'recupere')}>
                            <Truck size={14} /> Marquer Récupéré
                        </button>
                    )}
                    {(status === 'recupere' || status === 'collected') && (
                        <span className="plan-done">✅ Terminé</span>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ── Main Planning Component ── */
export default function Planning() {
    const [activeTab, setActiveTab] = useState('commandes'); // commandes | reassort
    const [orders, setOrders] = useState([]);
    const [reassortOrders, setReassortOrders] = useState([]);
    const [lowStockProducts, setLowStockProducts] = useState([]);
    const [filter, setFilter] = useState('active'); // active | all | late
    const [qtyInputs, setQtyInputs] = useState({});

    const load = async () => {
        const oData = await getOrders();

        // Commandes clients
        const clientOrders = oData
            .filter(o => o.productionStartDate && o.type !== 'reassort')
            .sort((a, b) => new Date(a.productionStartDate) - new Date(b.productionStartDate));
        setOrders(clientOrders);

        // Ordres de reassort
        const rOrders = oData
            .filter(o => o.type === 'reassort')
            .sort((a, b) => new Date(b.productionStartDate) - new Date(a.productionStartDate));
        setReassortOrders(rOrders);

        // Catalog (pour détecter les ruptures)
        const pData = await getProducts();
        const cats = await getCategories();
        const catMap = {};
        cats.forEach(c => catMap[c.id] = c.name);

        const lowStock = pData
            .filter(p => p.stock <= (p.alertThreshold || 0))
            .map(p => ({ ...p, categoryName: catMap[p.categoryId] }));
        setLowStockProducts(lowStock);
    };

    useEffect(() => {
        load();
        const handler = () => load();
        window.addEventListener('planningUpdated', handler);
        window.addEventListener('catalogUpdated', handler);
        return () => {
            window.removeEventListener('planningUpdated', handler);
            window.removeEventListener('catalogUpdated', handler);
        };
    }, []);

    const handleStatusChange = async (order, nextStatus) => {
        await saveOrder({ ...order, status: nextStatus });

        // Si c'est un ordre de réassort qui vient d'être terminé, on incrémente le stock
        if (order.type === 'reassort' && nextStatus === 'recupere') {
            const pData = await getProducts();
            for (const item of order.parsedItems) {
                const product = pData.find(p => p.id === item.id);
                if (product) {
                    product.stock = (product.stock || 0) + item.qty;
                    await saveProduct(product);
                }
            }
            window.dispatchEvent(new Event('catalogUpdated'));
        }

        load();
    };

    const handleCreateReassort = async (product) => {
        const qty = parseInt(qtyInputs[product.id]) || 0;
        if (qty <= 0) return alert('Veuillez saisir une quantité supérieure à 0.');

        const orderData = {
            customerName: `Réassort Interne`,
            customerPhone: '',
            items: `${qty}x ${product.name}`,
            parsedItems: [{ id: product.id, qty }],
            totalPrice: 0,
            deposit: 0,
            status: 'en_production',
            pickupDate: '',
            pickupTime: '',
            productionStartDate: new Date().toISOString().slice(0, 10),
            createdAt: new Date().toISOString(),
            notes: 'Production pour réapprovisionnement des stocks',
            type: 'reassort'
        };

        await saveOrder(orderData);
        setQtyInputs(prev => ({ ...prev, [product.id]: '' })); // reset input
        load();
        alert(`Ordre de production créé pour ${qty}x ${product.name}.`);
    };

    const today = new Date().toISOString().slice(0, 10);

    return (
        <div className="planning-container">
            {/* Header */}
            <div className="planning-header">
                <div className="planning-header-left">
                    <div className="planning-header-icon"><CalendarClock size={26} /></div>
                    <div>
                        <h2>Planning & Réassort</h2>
                        <p className="planning-header-sub">Suivez les commandes clients et gérez la production interne</p>
                    </div>
                </div>
                <button className="plan-refresh-btn" onClick={load} title="Rafraîchir">
                    <RefreshCw size={18} />
                </button>
            </div>

            {/* MASTER TABS */}
            <div className="master-tabs">
                <button className={`master-tab ${activeTab === 'commandes' ? 'active' : ''}`} onClick={() => setActiveTab('commandes')}>
                    📦 Commandes Clients
                </button>
                <button className={`master-tab ${activeTab === 'reassort' ? 'active' : ''}`} onClick={() => setActiveTab('reassort')}>
                    🏭 Réassort Boutique
                    {lowStockProducts.length > 0 && <span className="tab-badge">{lowStockProducts.length}</span>}
                </button>
            </div>

            {/* ========== TAB: COMMANDES CLIENTS ========== */}
            {activeTab === 'commandes' && (
                <>
                    {/* Alerts */}
                    {(() => {
                        const late = orders.filter(o => o.productionStartDate && o.productionStartDate < today && !['recupere', 'collected', 'pret'].includes(o.status || 'en_attente'));
                        if (late.length === 0) return null;
                        return (
                            <div className="planning-alert-banner">
                                <AlertTriangle size={18} />
                                <div>
                                    <strong>{late.length} production{late.length > 1 ? 's' : ''} en retard</strong>
                                    <div className="planning-alert-list">
                                        {late.map(o => (
                                            <span key={o.id} className="planning-alert-chip">
                                                {o.customerName} — prod. {fmt(o.productionStartDate, { weekday: 'short', day: 'numeric', month: 'short' })}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )
                    })()}

                    {(() => {
                        const todayProd = orders.filter(o => o.productionStartDate === today && !['recupere', 'collected'].includes(o.status || ''));
                        if (todayProd.length === 0) return null;
                        return (
                            <div className="planning-today-banner">
                                🏭 <strong>{todayProd.length} production{todayProd.length > 1 ? 's' : ''} à démarrer aujourd'hui</strong>
                                <div className="planning-alert-list">
                                    {todayProd.map(o => (
                                        <span key={o.id} className="planning-today-chip">{o.customerName}</span>
                                    ))}
                                </div>
                            </div>
                        )
                    })()}

                    {/* Stats bar */}
                    <div className="planning-stats">
                        {['en_attente', 'en_production', 'pret', 'recupere'].map(s => {
                            const count = orders.filter(o => (o.status || 'en_attente') === s).length;
                            return (
                                <div key={s} className="planning-stat" style={{ borderLeft: `4px solid ${STATUS_COLORS[s]}` }}>
                                    <div className="planning-stat-count" style={{ color: STATUS_COLORS[s] }}>{count}</div>
                                    <div className="planning-stat-label">{STATUS_LABELS[s]}</div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Filter tabs */}
                    <div className="planning-filter-tabs">
                        {[
                            { key: 'active', label: 'En cours' },
                            { key: 'late', label: '⚠️ En retard' },
                            { key: 'all', label: 'Toutes' },
                        ].map(({ key, label }) => (
                            <button key={key}
                                className={`plan-filter-tab ${filter === key ? 'active' : ''}`}
                                onClick={() => setFilter(key)}>
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Cards */}
                    <div className="planning-list">
                        {(() => {
                            const displayed = orders.filter(o => {
                                const status = o.status || 'en_attente';
                                if (filter === 'active') return !['recupere', 'collected'].includes(status);
                                if (filter === 'late') return o.productionStartDate < today && !['recupere', 'collected'].includes(status);
                                return true;
                            });
                            if (displayed.length === 0) {
                                return (
                                    <div className="planning-empty">
                                        <CalendarClock size={52} color="var(--color-border)" />
                                        <p>
                                            {filter === 'late'
                                                ? 'Aucune production en retard 🎉'
                                                : 'Aucune commande dans le planning.\nUtilisez "Envoyer en planning" depuis l\'onglet Commandes.'}
                                        </p>
                                    </div>
                                );
                            }
                            return displayed.map(o => <PlanningCard key={o.id} order={o} onStatusChange={handleStatusChange} />);
                        })()}
                    </div>
                </>
            )}

            {/* ========== TAB: RÉASSORT BOUTIQUE ========== */}
            {activeTab === 'reassort' && (
                <div className="reassort-container">

                    <div className="reassort-section">
                        <h3 className="section-title"><AlertTriangle size={18} color="#ef4444" /> Alertes Stock (Produits à refaire)</h3>
                        {lowStockProducts.length === 0 ? (
                            <div className="planning-empty" style={{ padding: '2rem' }}>
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
                                            <span>En vitrine: <strong style={{ color: p.stock <= 0 ? '#ef4444' : '#f59e0b' }}>{p.stock || 0}</strong></span>
                                            <span>Seuil alerte: {p.alertThreshold || 0}</span>
                                        </div>
                                        <div className="r-card-actions">
                                            <input
                                                type="number"
                                                min="1"
                                                placeholder="Qté à produire"
                                                value={qtyInputs[p.id] || ''}
                                                onChange={e => setQtyInputs({ ...qtyInputs, [p.id]: e.target.value })}
                                            />
                                            <button className="btn-primary" onClick={() => handleCreateReassort(p)}>
                                                <PackagePlus size={16} /> Lancer
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="reassort-section" style={{ marginTop: '2rem' }}>
                        <h3 className="section-title"><Factory size={18} color="#6366f1" /> Ordres de Production Internes</h3>
                        <div className="planning-list">
                            {reassortOrders.length === 0 ? (
                                <p style={{ color: '#6b7280', textAlign: 'center', padding: '1rem' }}>Aucune production interne en cours.</p>
                            ) : (
                                reassortOrders.map(o => (
                                    <PlanningCard key={o.id} order={o} onStatusChange={handleStatusChange} />
                                ))
                            )}
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
}
