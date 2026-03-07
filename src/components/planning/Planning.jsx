import { useState, useEffect } from 'react';
import { getOrders, saveOrder } from '../../db/indexedDB';
import { CalendarClock, Factory, Clock, Truck, CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
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
    const [orders, setOrders] = useState([]);
    const [filter, setFilter] = useState('active'); // active | all | late

    const load = async () => {
        const data = await getOrders();
        // Only show orders that have a productionStartDate
        const planning = data
            .filter(o => o.productionStartDate)
            .sort((a, b) => new Date(a.productionStartDate) - new Date(b.productionStartDate));
        setOrders(planning);
    };

    useEffect(() => {
        load();
        const handler = () => load();
        window.addEventListener('planningUpdated', handler);
        return () => window.removeEventListener('planningUpdated', handler);
    }, []);

    const handleStatusChange = async (order, nextStatus) => {
        await saveOrder({ ...order, status: nextStatus });
        load();
    };

    // Filtered view
    const today = new Date().toISOString().slice(0, 10);
    const displayed = orders.filter(o => {
        const status = o.status || 'en_attente';
        if (filter === 'active') return !['recupere', 'collected'].includes(status);
        if (filter === 'late') return o.productionStartDate < today && !['recupere', 'collected'].includes(status);
        return true; // 'all'
    });

    // Alert: overdue productions
    const lateProductions = orders.filter(o => {
        const s = o.status || 'en_attente';
        return o.productionStartDate && o.productionStartDate < today && !['recupere', 'collected', 'pret'].includes(s);
    });

    // Today's productions
    const todayProductions = orders.filter(o => o.productionStartDate === today && !['recupere', 'collected'].includes(o.status || ''));

    return (
        <div className="planning-container">
            {/* Header */}
            <div className="planning-header">
                <div className="planning-header-left">
                    <div className="planning-header-icon"><CalendarClock size={26} /></div>
                    <div>
                        <h2>Planning de production</h2>
                        <p className="planning-header-sub">Suivez la préparation des commandes par date de production</p>
                    </div>
                </div>
                <button className="plan-refresh-btn" onClick={load} title="Rafraîchir">
                    <RefreshCw size={18} />
                </button>
            </div>

            {/* Alerts */}
            {lateProductions.length > 0 && (
                <div className="planning-alert-banner">
                    <AlertTriangle size={18} />
                    <div>
                        <strong>{lateProductions.length} production{lateProductions.length > 1 ? 's' : ''} en retard</strong>
                        <div className="planning-alert-list">
                            {lateProductions.map(o => (
                                <span key={o.id} className="planning-alert-chip">
                                    {o.customerName} — prod. {fmt(o.productionStartDate, { weekday: 'short', day: 'numeric', month: 'short' })}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {todayProductions.length > 0 && (
                <div className="planning-today-banner">
                    🏭 <strong>{todayProductions.length} production{todayProductions.length > 1 ? 's' : ''} à démarrer aujourd'hui</strong>
                    <div className="planning-alert-list">
                        {todayProductions.map(o => (
                            <span key={o.id} className="planning-today-chip">{o.customerName}</span>
                        ))}
                    </div>
                </div>
            )}

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
                {displayed.length === 0 ? (
                    <div className="planning-empty">
                        <CalendarClock size={52} color="var(--color-border)" />
                        <p>
                            {filter === 'late'
                                ? 'Aucune production en retard 🎉'
                                : 'Aucune commande dans le planning.\nUtilisez "Envoyer en planning" depuis l\'onglet Commandes.'}
                        </p>
                    </div>
                ) : (
                    displayed.map(o => (
                        <PlanningCard key={o.id} order={o} onStatusChange={handleStatusChange} />
                    ))
                )}
            </div>
        </div>
    );
}
