import { useState, useEffect } from 'react';
import { getOrders, saveOrder, getProducts, getCategories, saveProduct } from '../../db/indexedDB';
import { CalendarClock, Factory, Clock, Truck, CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight, RefreshCw, PackagePlus, ArrowRight, Calendar, List, ClipboardList } from 'lucide-react';
import './Planning.css';
import '../orders/Orders.css'; // Pour les styles du calendrier (View)

const STATUS_LABELS = {
    en_attente: 'En attente',
    en_production: 'En production',
    pret: 'Prêt',
    recupere: 'Récupéré',
    produit: 'Produit ✅',
    pending: 'En attente',
    ready: 'Prêt',
    collected: 'Terminé ✅',
};
const STATUS_COLORS = {
    en_attente: '#f59e0b',
    en_production: '#6366f1',
    pret: '#10b981',
    recupere: '#9ca3af',
    produit: '#10b981',
};

const DAYS_FR = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

function fmt(dateStr, opts = {}) {
    if (!dateStr) return null;
    // Standardisation forcee car Sheets peut renvoyer des ISO strings avec l'heure
    const baseDate = String(dateStr).slice(0, 10);
    const d = new Date(baseDate + 'T12:00:00');
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', ...opts
    });
}

function daysFromNow(dateStr) {
    if (!dateStr) return null;
    const baseDate = String(dateStr).slice(0, 10);
    const d = new Date(baseDate + 'T12:00:00');
    if (isNaN(d.getTime())) return null;
    const todayAtNoon = new Date();
    todayAtNoon.setHours(12, 0, 0, 0);
    return Math.round((d - todayAtNoon) / (1000 * 60 * 60 * 24));
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

/* ── PRODUCTION CARD (CALENDAR VIEW) ── */
function ProductionCard({ order, onStatusChange }) {
    const isReassort = order.type === 'reassort';
    const status = order.status || 'en_attente';

    // Status label for calendar view
    const getStatusBadge = () => {
        if (status === 'recupere' || status === 'collected') {
            return <div className="pcard-badge gray">Terminé</div>;
        }
        if (status === 'pret' || status === 'ready' || status === 'produit') {
            return <div className="pcard-badge green">Prêt</div>;
        }
        return <div className="pcard-badge orange">En attente</div>;
    };

    return (
        <div className="production-detail-card">
            <div className="pcard-header">
                <span className="pcard-customer">{order.customerName} {isReassort && "(Réassort)"}</span>
                <div className="pcard-header-actions">
                    {getStatusBadge()}
                </div>
            </div>

            <div className="pcard-items-box">
                <div className="pcard-items-list">
                    {order.items || "Aucun article"}
                </div>
                {order.notes && <div className="pcard-note-inline">{order.notes}</div>}
            </div>

            <div className="pcard-meta">
                <div className="meta-item">
                    <Clock size={14} />
                    <span>Retrait : <strong>{fmt(order.pickupDate, { weekday: 'short', day: 'numeric', month: 'short' }) || "Non défini"}</strong> {order.pickupTime && `à ${order.pickupTime}`}</span>
                </div>
                <div className="meta-item blue">
                    <ClipboardList size={14} />
                    <span>Production : <strong>{fmt(order.productionStartDate, { weekday: 'short', day: 'numeric', month: 'short' }) || "Non défini"}</strong></span>
                </div>
            </div>

            <div className="pcard-footer">
                {order.totalPrice > 0 && (
                    <div className="pcard-price">
                        Reste à percevoir : <span className="price-bold">{order.totalPrice}€</span> (Total : {order.totalPrice}€)
                    </div>
                )}

                <div className="pcard-actions">
                    {status === 'en_attente' && (
                        <button className="pcard-btn start" onClick={() => onStatusChange(order, 'en_production')}>
                            Démarrer prod.
                        </button>
                    )}
                    {status === 'en_production' && (
                        <button className="pcard-btn ready" onClick={() => onStatusChange(order, isReassort ? 'produit' : 'pret')}>
                            Marquer Prêt
                        </button>
                    )}
                    {(status === 'pret' || status === 'ready') && !isReassort && (
                        <button className="pcard-btn collect" onClick={() => onStatusChange(order, 'recupere')}>
                            Marquer Récupéré
                        </button>
                    )}
                </div>

                {(status === 'recupere' || status === 'collected' || (isReassort && status === 'produit')) && (
                    <div className="pcard-done">
                        <CheckCircle2 size={16} /> Commande terminée
                    </div>
                )}
            </div>
        </div>
    );
}

/* ── Planning Card ── */
function PlanningCard({ order, onStatusChange }) {
    const status = order.status || 'en_attente';
    const color = STATUS_COLORS[status] || '#f59e0b';
    const isReassort = order.type === 'reassort';
    let displayStatus = status;
    if (isReassort && status === 'pret') displayStatus = 'produit';
    const label = STATUS_LABELS[displayStatus] || STATUS_LABELS[status];

    return (
        <div className={`planning-card status-${status}`}>
            {/* Left accent bar */}
            <div className="planning-card-accent" style={{ backgroundColor: color }} />

            <div className="planning-card-body">
                {/* Header row */}
                <div className="planning-card-header">
                    <div>
                        <div className="planning-customer">{order.customerName}
                            {isReassort && <span style={{ marginLeft: 8, fontSize: '0.75rem', background: '#6366f120', color: '#6366f1', borderRadius: 99, padding: '2px 8px' }}>⚙️ Réassort</span>}
                        </div>
                        {order.customerPhone && (
                            <div className="planning-phone">📞 {order.customerPhone}</div>
                        )}
                    </div>
                    <div className="planning-status-badge" style={{ backgroundColor: color + '22', color, border: `1px solid ${color}` }}>
                        {label}
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
                    {!isReassort && (
                        <>
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
                        </>
                    )}
                </div>

                {/* Notes */}
                {order.notes && <div className="planning-notes">📝 {order.notes}</div>}

                {/* Actions */}
                <div className="planning-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>

                        {/* ── FLUX RÉASSORT (3 étapes) ── */}
                        {isReassort && (status === 'en_attente' || status === 'pending') && (
                            <button className="plan-btn production" onClick={() => onStatusChange(order, 'en_production')}>
                                <Factory size={14} /> Démarrer prod.
                            </button>
                        )}
                        {isReassort && status === 'en_production' && (
                            <button className="plan-btn ready" onClick={() => onStatusChange(order, 'produit')}>
                                <CheckCircle2 size={14} /> Marquer Produit
                            </button>
                        )}
                        {isReassort && status === 'produit' && (
                            <span className="plan-done">✅ Produit — stock mis à jour</span>
                        )}

                        {/* ── FLUX CLIENT (4 étapes) ── */}
                        {!isReassort && (status === 'en_attente' || status === 'pending') && (
                            <button className="plan-btn production" onClick={() => onStatusChange(order, 'en_production')}>
                                <Factory size={14} /> Démarrer prod.
                            </button>
                        )}
                        {!isReassort && status === 'en_production' && (
                            <button className="plan-btn ready" onClick={() => onStatusChange(order, 'pret')}>
                                <CheckCircle2 size={14} /> Marquer Prêt
                            </button>
                        )}
                        {!isReassort && (status === 'pret' || status === 'ready') && (
                            <button className="plan-btn pickup" onClick={() => onStatusChange(order, 'recupere')}>
                                <Truck size={14} /> Marquer Récupéré
                            </button>
                        )}
                        {!isReassort && (status === 'recupere' || status === 'collected') && (
                            <span className="plan-done">✅ Terminé</span>
                        )}
                    </div>

                    {/* Rollback actions */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                        {status === 'en_production' && (
                            <button className="plan-btn" style={{ background: '#f1f5f9', color: '#64748b', padding: '6px 10px' }} onClick={() => onStatusChange(order, 'en_attente')} title="Annuler le démarrage">
                                ↺
                            </button>
                        )}
                        {!isReassort && (status === 'pret' || status === 'ready') && (
                            <button className="plan-btn" style={{ background: '#f1f5f9', color: '#64748b', padding: '6px 10px' }} onClick={() => onStatusChange(order, 'en_production')} title="Annuler Prêt">
                                ↺
                            </button>
                        )}
                        {!isReassort && (status === 'recupere' || status === 'collected') && (
                            <button className="plan-btn" style={{ background: '#f1f5f9', color: '#64748b', padding: '6px 10px' }} onClick={() => onStatusChange(order, 'pret')} title="Annuler Récupéré">
                                ↺
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ── Main Planning Component ── */
/* ─────────── CALENDAR VIEW ─────────── */


export default function Production() {
    const [orders, setOrders] = useState([]);
    const [reassortOrders, setReassortOrders] = useState([]);
    const [filter, setFilter] = useState('active'); // active | all | late
    const [filterDate, setFilterDate] = useState('');

    // View mode for planning: list or calendar
    const [viewMode, setViewMode] = useState('list');

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

        // Catalogue checks removed (migrated to ProductManager)
    };

    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));

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
        // Quand un réassort est marqué Produit, demander la quantité exacte
        if (order.type === 'reassort' && nextStatus === 'produit') {
            const item = order.parsedItems?.[0];
            const expectedQty = item?.qty || 1;
            const productName = item ? (order.items?.match(/\dx (.+)/)?.[1] || item.id) : 'produits';
            const exactQtyStr = window.prompt(
                `📦 Combien avez-vous RÉELLEMENT produit ?\n(Prévu : ${expectedQty}x ${productName})`,
                expectedQty
            );
            if (exactQtyStr === null) return; // Annulation
            const exactQty = parseInt(exactQtyStr);
            if (isNaN(exactQty) || exactQty < 0) return alert('Quantité invalide.');

            const { getProducts, saveProduct, logStockMovement } = await import('../../db/indexedDB');
            const pData = await getProducts();
            for (const i of order.parsedItems) {
                const product = pData.find(p => p.id === i.id);
                if (product) {
                    const newStock = (product.stock || 0) + exactQty;
                    product.stock = newStock;
                    await saveProduct(product);
                    await logStockMovement(product.id, product.name, exactQty, newStock, 'reassort', String(order.id));
                }
            }
            window.dispatchEvent(new Event('catalogUpdated'));
        }

        await saveOrder({ ...order, status: nextStatus });
        load();
    };

    const today = new Date().toISOString().slice(0, 10);

    const allOrders = [...orders, ...reassortOrders].sort((a, b) => new Date(a.productionStartDate) - new Date(b.productionStartDate));

    return (
        <div className="planning-container">
            {/* Header */}
            <div className="planning-header">
                <div className="planning-header-left">
                    <div className="planning-header-icon"><CalendarClock size={26} /></div>
                    <div>
                        <h2>Production</h2>
                        <p className="planning-header-sub">Suivez les commandes clients et gérez la production interne</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div className="view-toggle">
                        <button className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')} title="Vue Liste">
                            <List size={20} />
                        </button>
                        <button className={`toggle-btn ${viewMode === 'calendar' ? 'active' : ''}`} onClick={() => setViewMode('calendar')} title="Vue Calendrier">
                            <Calendar size={20} />
                        </button>
                    </div>
                    <button className="plan-refresh-btn" onClick={load} title="Rafraîchir">
                        <RefreshCw size={18} />
                    </button>
                </div>
            </div>

            {/* Alerts */}
            {(() => {
                const late = orders.filter(o => {
                    const d = o.productionStartDate ? o.productionStartDate.split('T')[0] : null;
                    return d && d < today && !['recupere', 'collected', 'pret', 'produit'].includes(o.status || 'en_attente');
                });
                if (late.length === 0) return null;
                return (
                    <div className="planning-alert-banner">
                        <AlertTriangle size={18} />
                        <div>
                            <strong>{late.length} production{late.length > 1 ? 's' : ''} en retard</strong>
                            <div className="planning-alert-list">
                                {late.map(o => {
                                    const name = o.customerName && o.customerName.includes('T') && o.customerName.length > 20 ? 'Production' : o.customerName;
                                    return (
                                        <span key={o.id} className="planning-alert-chip">
                                            {name} — prod. {fmt(o.productionStartDate.split('T')[0], { weekday: 'short', day: 'numeric', month: 'short' })}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )
            })()}

            {(() => {
                const todayProd = [...orders, ...reassortOrders].filter(o => {
                    const d = o.productionStartDate ? o.productionStartDate.split('T')[0] : null;
                    return d === today && !['recupere', 'collected', 'produit', 'pret'].includes(o.status || 'en_attente');
                });
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
                {[
                    { id: 'en_attente', label: 'En attente', color: STATUS_COLORS.en_attente },
                    { id: 'en_production', label: 'En production', color: STATUS_COLORS.en_production },
                    { id: 'done', label: 'Prêt / Produit', color: STATUS_COLORS.produit },
                    { id: 'recupere', label: 'Récupéré (Client)', color: STATUS_COLORS.recupere },
                ].map(s => {
                    let count = 0;
                    if (s.id === 'done') {
                        count = [...orders, ...reassortOrders].filter(o => ['pret', 'produit', 'ready'].includes(o.status)).length;
                    } else {
                        count = [...orders, ...reassortOrders].filter(o => (o.status || 'en_attente') === s.id || (s.id === 'en_attente' && o.status === 'pending')).length;
                    }
                    return (
                        <div key={s.id} className="planning-stat" style={{ borderLeft: `4px solid ${s.color}` }}>
                            <div className="planning-stat-count" style={{ color: s.color }}>{count}</div>
                            <div className="planning-stat-label">{s.label}</div>
                        </div>
                    );
                })}
            </div>

            {/* Filter tabs and View Toggle (Hide filters in calendar mode) */}
            <div className="planning-filter-tabs" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                {viewMode === 'list' ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {[
                            { key: 'en_attente', label: '⏳ En attente' },
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
                ) : <div />}

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {viewMode === 'list' && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: '#fff',
                            padding: '8px 16px',
                            borderRadius: '99px',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                        }}>
                            <CalendarClock size={20} color="#6366f1" />
                            <input
                                type="date"
                                value={filterDate}
                                onChange={e => setFilterDate(e.target.value)}
                                style={{
                                    border: 'none',
                                    outline: 'none',
                                    background: 'transparent',
                                    color: '#334155',
                                    fontWeight: 600,
                                    fontSize: '1' + 'rem',
                                    fontFamily: 'monospace',
                                    letterSpacing: '0.05em'
                                }}
                            />
                            {filterDate && (
                                <button
                                    onClick={() => setFilterDate('')}
                                    style={{
                                        border: 'none',
                                        background: '#f1f5f9',
                                        borderRadius: '50%',
                                        width: '24px',
                                        height: '24px',
                                        cursor: 'pointer',
                                        color: '#64748b',
                                        fontSize: '16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginLeft: '4px'
                                    }}
                                    title="Effacer la date"
                                >
                                    &times;
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Content: List or Calendar */}
            {viewMode === 'list' ? (
                <div className="planning-list">
                    {(() => {
                        const displayed = allOrders.filter(o => {
                            const d = o.productionStartDate ? o.productionStartDate.split('T')[0] : null;
                            if (filterDate && d !== filterDate) return false;
                            const status = o.status || 'en_attente';
                            if (filter === 'en_attente') return status === 'en_attente' || status === 'pending';
                            if (filter === 'active') return !['recupere', 'collected'].includes(status);
                            if (filter === 'late') return d < today && !['recupere', 'collected'].includes(status);
                            return true;
                        });

                        if (displayed.length === 0) {
                            return (
                                <div className="planning-empty">
                                    <CheckCircle2 size={48} color="#e5e7eb" />
                                    <p>Aucune production (commande ou réassort) à préparer avec ces critères.</p>
                                </div>
                            );
                        }
                        return displayed.map(o => <PlanningCard key={o.id} order={o} onStatusChange={handleStatusChange} />);
                    })()}
                </div>
            ) : (
                <PlanningCalendar
                    orders={allOrders}
                    onStatusChange={handleStatusChange}
                    selectedDate={selectedDate}
                    setSelectedDate={setSelectedDate}
                />
            )}
        </div>
    );
}

/* ─────────── PLANNING CALENDAR VIEW ─────────── */
function PlanningCalendar({ orders, onStatusChange, selectedDate, setSelectedDate }) {
    const today = new Date();
    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth());

    const ordersByDate = {};
    orders.forEach(order => {
        const d = order.productionStartDate ? order.productionStartDate.split('T')[0] : null;
        if (d) {
            if (!ordersByDate[d]) ordersByDate[d] = [];
            ordersByDate[d].push(order);
        }
    });

    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    let startOffset = firstDayOfMonth.getDay() - 1;
    if (startOffset < 0) startOffset = 6;

    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const prevMonth = () => {
        if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
        else setViewMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
        else setViewMonth(m => m + 1);
    };

    const formatDateKey = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const todayKey = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());

    const selectedOrders = ordersByDate[selectedDate] || [];

    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    return (
        <div className="calendar-wrapper">
            <div className="calendar-main">
                <div className="cal-nav">
                    <button className="cal-nav-btn" onClick={prevMonth}><ChevronLeft size={20} /></button>
                    <h3 className="cal-title">{MONTHS_FR[viewMonth]} {viewYear}</h3>
                    <button className="cal-nav-btn" onClick={nextMonth}><ChevronRight size={20} /></button>
                </div>

                <div className="cal-grid">
                    {DAYS_FR.map(d => <div key={d} className="cal-day-header">{d}</div>)}
                    {cells.map((day, i) => {
                        if (!day) return <div key={`e${i}`} className="cal-cell empty" />;
                        const key = formatDateKey(viewYear, viewMonth, day);
                        const dayOrders = ordersByDate[key] || [];
                        const isToday = key === todayKey;
                        const isSelected = selectedDate === key;

                        return (
                            <div
                                key={day}
                                className={`cal-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${dayOrders.length > 0 ? 'has-orders' : ''}`}
                                onClick={() => setSelectedDate(key)}
                            >
                                <span className="cal-day-num">{day}</span>
                                {dayOrders.length > 0 && (
                                    <div className="cal-dots">
                                        <div className="cal-order-token">
                                            {dayOrders.length}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="cal-legend">
                    <div className="legend-item"><span className="pcal-dot green" /> Prêt</div>
                    <div className="legend-item"><span className="pcal-dot orange" /> En attente</div>
                </div>
            </div>

            <div className="cal-detail-panel">
                {selectedDate ? (
                    <>
                        <div className="cal-detail-header">
                            <h3>{fmt(selectedDate, { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
                        </div>
                        {selectedOrders.length > 0 ? (
                            <div className="cal-detail-list">
                                {selectedOrders.map(o => (
                                    <ProductionCard key={o.id} order={o} onStatusChange={onStatusChange} />
                                ))}
                            </div>
                        ) : (
                            <div className="cal-empty-day">
                                <CalendarClock size={48} />
                                <p>Aucune production prévue pour ce jour.</p>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="cal-empty-day">
                        <Calendar size={48} />
                        <p>Cliquez sur un jour pour voir le détail de la production.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
