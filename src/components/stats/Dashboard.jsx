import { useState, useEffect, useMemo } from 'react';
import {
    BarChart3, TrendingUp, Calendar, Euro, PieChart as PieChartIcon,
    Activity, AlertTriangle, PackageX, ShoppingBag, ArrowUpRight, ArrowDownRight,
    Minus, ChevronDown, ChevronUp, ClipboardList, Store, RefreshCw
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend
} from 'recharts';
import { getAllSales, getProducts, getOrders } from '../../db/indexedDB';
import './Dashboard.css';

const COLORS = ['#f472b6', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];
const SOURCE_COLORS = { direct: '#f472b6', commande: '#6366f1' };

/* ── Helpers ── */
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const endOfDay = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
const fmt = (d) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
const fmtFull = (d) => d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

function getPeriodBounds(preset, customFrom, customTo) {
    const now = new Date();
    if (preset === 'today') return { from: startOfDay(now), to: endOfDay(now) };
    if (preset === '7d') { const f = new Date(now); f.setDate(f.getDate() - 6); return { from: startOfDay(f), to: endOfDay(now) }; }
    if (preset === '30d') { const f = new Date(now); f.setDate(f.getDate() - 29); return { from: startOfDay(f), to: endOfDay(now) }; }
    if (preset === 'custom' && customFrom && customTo)
        return { from: startOfDay(new Date(customFrom)), to: endOfDay(new Date(customTo)) };
    return { from: startOfDay(now), to: endOfDay(now) };
}

function getPrevPeriodBounds(preset, customFrom, customTo) {
    const now = new Date();
    if (preset === 'today') { const y = new Date(now); y.setDate(y.getDate() - 1); return { from: startOfDay(y), to: endOfDay(y) }; }
    if (preset === '7d') { const f = new Date(now); f.setDate(f.getDate() - 13); const t = new Date(now); t.setDate(t.getDate() - 7); return { from: startOfDay(f), to: endOfDay(t) }; }
    if (preset === '30d') { const f = new Date(now); f.setDate(f.getDate() - 59); const t = new Date(now); t.setDate(t.getDate() - 30); return { from: startOfDay(f), to: endOfDay(t) }; }
    return null;
}

const parseOrderDate = (o) => {
    if (!o) return new Date();
    // 1. Essayer pickupDate (ISO string YYYY-MM-DD ou Date object)
    if (o.pickupDate) {
        const d = new Date(o.pickupDate);
        if (!isNaN(d.getTime())) return d;
    }
    // 2. Essayer pickupTime ou d'autres champs de date
    if (o.createdAt) {
        const d = new Date(o.createdAt);
        if (!isNaN(d.getTime())) return d;
    }
    return new Date();
};

/* Normalise une commande en "entrée de revenu" */
function ordersToRevenue(orders) {
    return orders
        .filter(o => {
            const s = (o.status || '').toLowerCase();
            // Seulement les commandes payées/récupérées comptent comme CA réalisé
            // Mais pour les stats 'Commandes', on veut peut-être tout voir ?
            // L'utilisateur veut voir le cumul, donc on prend tout ce qui est validé
            return s !== 'cancelled' && s !== 'brouillon' && o.totalPrice > 0;
        })
        .map(o => {
            const dateRef = parseOrderDate(o);
            return {
                timestamp: dateRef.getTime(),
                total: parseFloat(o.totalPrice) || 0,
                articleCount: Array.isArray(o.parsedItems)
                    ? o.parsedItems.reduce((s, i) => s + (parseFloat(i.qty || i.quantity) || 1), 0)
                    : 1,
                items: Array.isArray(o.parsedItems)
                    ? o.parsedItems.map(i => ({ name: i.name, quantity: parseFloat(i.qty || i.quantity) || 1, price: parseFloat(i.price) || 0 }))
                    : [],
                source: 'commande',
            };
        });
}

function filterByDate(entries, from, to) {
    return entries.filter(e => {
        const d = new Date(e.timestamp);
        return d >= from && d <= to;
    });
}

function computeStats(entries) {
    const revenue = entries.reduce((s, x) => s + x.total, 0);
    const orders = entries.length;
    const items = entries.reduce((s, x) => s + (x.itemsCount || 0), 0);
    const avg = orders > 0 ? revenue / orders : 0;
    return { revenue, orders, items, avg };
}

function buildDailyData(directEntries, orderEntries, from, to, source) {
    const map = {};
    const cur = new Date(from);
    while (cur <= to) {
        const key = cur.toISOString().slice(0, 10);
        map[key] = { date: fmt(cur), fullDate: fmtFull(new Date(cur)), direct: 0, commande: 0, total: 0, ventes: 0, ventes_direct: 0, ventes_commande: 0 };
        cur.setDate(cur.getDate() + 1);
    }

    (source !== 'commande' ? directEntries : []).forEach(s => {
        const key = new Date(s.timestamp).toISOString().slice(0, 10);
        const val = parseFloat(s.total) || 0;
        if (map[key]) {
            map[key].direct += val;
            map[key].total += val;
            map[key].ventes += 1;
            map[key].ventes_direct += 1;
        }
    });
    (source !== 'direct' ? orderEntries : []).forEach(o => {
        const key = new Date(o.timestamp).toISOString().slice(0, 10);
        const val = parseFloat(o.total) || 0;
        if (map[key]) {
            map[key].commande += val;
            map[key].total += val;
            map[key].ventes += 1;
            map[key].ventes_commande += 1;
        }
    });
    return Object.values(map);
}

function buildHourlyData(directEntries, orderEntries, source) {
    const map = {};
    for (let h = 7; h <= 20; h++) map[h] = { name: `${h}h`, direct: 0, commande: 0 };
    (source !== 'commande' ? directEntries : []).forEach(s => {
        const h = new Date(s.timestamp).getHours();
        const val = parseFloat(s.total) || 0;
        if (map[h]) map[h].direct += val;
    });
    (source !== 'direct' ? orderEntries : []).forEach(o => {
        const h = new Date(o.timestamp).getHours();
        const val = parseFloat(o.total) || 0;
        if (map[h]) map[h].commande += val;
    });
    return Object.values(map);
}

function buildTopProducts(directEntries, orderEntries, source) {
    const cnt = {}, rev = {};
    const add = (name, qty, price) => {
        if (!cnt[name]) { cnt[name] = 0; rev[name] = 0; }
        cnt[name] += qty; rev[name] += price * qty;
    };
    if (source !== 'commande') directEntries.forEach(s => (s.items || []).forEach(it => add(it.name, it.quantity, it.price || 0)));
    if (source !== 'direct') orderEntries.forEach(o => (o.items || []).forEach(it => add(it.name, it.quantity, it.price || 0)));
    return Object.entries(cnt).map(([name, qty]) => ({ name, qty, revenue: rev[name] || 0 }))
        .sort((a, b) => b.qty - a.qty).slice(0, 6);
}

/* ── Delta Badge ── */
function Delta({ cur, prev }) {
    if (prev === null || prev === undefined) return null;
    if (prev === 0 && cur === 0) return <span className="delta neutral"><Minus size={12} /> —</span>;
    if (prev === 0) return <span className="delta positive"><ArrowUpRight size={12} /> +∞</span>;
    const p = ((cur - prev) / prev) * 100;
    const pos = p >= 0;
    return (
        <span className={`delta ${pos ? 'positive' : 'negative'}`}>
            {pos ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {pos ? '+' : ''}{p.toFixed(1)}%
        </span>
    );
}

function StatCard({ icon, label, value, sub, prevValue }) {
    const numVal = typeof value === 'string' ? parseFloat(value) : value;
    return (
        <div className="stat-card">
            <div className="stat-icon-wrap">{icon}</div>
            <div className="stat-info">
                <h3>{label}</h3>
                <span className="stat-value">{value}</span>
                <div className="stat-footer">
                    {sub && <span className="stat-sub">{sub}</span>}
                    {prevValue !== undefined && prevValue !== null && <Delta cur={numVal} prev={prevValue} />}
                </div>
            </div>
        </div>
    );
}

function CustomTooltip({ active, payload, label, chartMode }) {
    if (!active || !payload?.length) return null;
    const fullDate = payload[0]?.payload?.fullDate || label;
    return (
        <div className="chart-tooltip">
            <p className="tooltip-label">{fullDate}</p>
            {payload.map((p, i) => (
                <p key={i} style={{ color: p.color, margin: '2px 0', fontSize: '0.85rem' }}>
                    {p.name === 'direct' ? '🛍 Caisse' : p.name === 'commande' ? '📋 Commande' : p.name === 'total' ? '📊 Total' : p.name} : <strong>{typeof p.value === 'number' ? (chartMode === 'revenue' ? `${p.value.toFixed(2)} €` : `${p.value} vente(s)`) : p.value}</strong>
                </p>
            ))}
        </div>
    );
}

/* ══════════════════ MAIN COMPONENT ══════════════════ */
export default function Dashboard() {
    const [directSales, setDirectSales] = useState([]);
    const [orders, setOrders] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [preset, setPreset] = useState('7d');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [showCustom, setShowCustom] = useState(false);
    const [source, setSource] = useState('all');   // 'all' | 'direct' | 'commande'
    const [topMode, setTopMode] = useState('qty');
    const [chartMode, setChartMode] = useState('revenue'); // 'revenue' | 'qty'
    const [chartMetric, setChartMetric] = useState('total'); // 'total' | 'direct' | 'commande'

    const loadData = async () => {
        setLoading(true);
        const [s, o, p] = await Promise.all([getAllSales(), getOrders(), getProducts()]);
        setDirectSales(s.map(x => ({ ...x, source: 'direct' })));
        setOrders(o.filter(order => order.type !== 'reassort'));
        setProducts(p);
        setLoading(false);
    };

    useEffect(() => { loadData(); }, []);

    const { from, to } = useMemo(() => getPeriodBounds(preset, customFrom, customTo), [preset, customFrom, customTo]);
    const prevBounds = useMemo(() => getPrevPeriodBounds(preset, customFrom, customTo), [preset, customFrom, customTo]);

    // Normalise orders en entrées de revenu
    const orderRevenue = useMemo(() => ordersToRevenue(orders), [orders]);

    // Filtre par date
    const filtDirect = useMemo(() => filterByDate(directSales, from, to), [directSales, from, to]);
    const filtOrders = useMemo(() => filterByDate(orderRevenue, from, to), [orderRevenue, from, to]);

    // Entrées actives selon le filtre source
    const activeEntries = useMemo(() => {
        if (source === 'direct') return filtDirect;
        if (source === 'commande') return filtOrders;
        return [...filtDirect, ...filtOrders];
    }, [source, filtDirect, filtOrders]);

    // Période précédente
    const prevDirect = useMemo(() => prevBounds ? filterByDate(directSales, prevBounds.from, prevBounds.to) : [], [directSales, prevBounds]);
    const prevOrders = useMemo(() => prevBounds ? filterByDate(orderRevenue, prevBounds.from, prevBounds.to) : [], [orderRevenue, prevBounds]);
    const prevActive = useMemo(() => {
        if (source === 'direct') return prevDirect;
        if (source === 'commande') return prevOrders;
        return [...prevDirect, ...prevOrders];
    }, [source, prevDirect, prevOrders]);

    const stats = useMemo(() => computeStats(activeEntries), [activeEntries]);
    const prevStats = useMemo(() => prevBounds ? computeStats(prevActive) : null, [prevActive, prevBounds]);

    const showDaily = preset !== 'today';
    const dailyData = useMemo(() => buildDailyData(filtDirect, filtOrders, from, to, source), [filtDirect, filtOrders, from, to, source]);
    const hourlyData = useMemo(() => buildHourlyData(filtDirect, filtOrders, source), [filtDirect, filtOrders, source]);
    const topProducts = useMemo(() => buildTopProducts(filtDirect, filtOrders, source), [filtDirect, filtOrders, source]);
    const lowStock = useMemo(() => products.filter(p => p.alertThreshold > 0 && p.stock <= p.alertThreshold).sort((a, b) => a.stock - b.stock), [products]);

    const PRESETS = [
        { id: 'today', label: "Aujourd'hui" },
        { id: '7d', label: '7 jours' },
        { id: '30d', label: '30 jours' },
        { id: 'custom', label: 'Personnalisé' },
    ];

    const dataKeys = source === 'all'
        ? [{ key: 'direct', color: SOURCE_COLORS.direct, label: '🛍 Caisse' }, { key: 'commande', color: SOURCE_COLORS.commande, label: '📋 Commandes' }]
        : [{ key: source, color: SOURCE_COLORS[source] || '#f472b6', label: source === 'direct' ? '🛍 Caisse' : '📋 Commandes' }];

    return (
        <div className="admin-container dash-root" style={{ overflowY: 'auto', paddingBottom: 60 }}>
            {/* Header */}
            <div className="admin-header">
                <h2><BarChart3 /> Statistiques</h2>
                <button className="btn-secondary refresh-btn" onClick={loadData} title="Actualiser les données" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: '0.85rem' }}>
                    <RefreshCw size={15} className={loading ? 'spin' : ''} /> Actualiser
                </button>
            </div>

            {/* Period Selector */}
            <div className="period-bar">
                <div className="period-tabs">
                    {PRESETS.map(p => (
                        <button key={p.id}
                            className={`period-tab ${preset === p.id ? 'active' : ''}`}
                            onClick={() => { if (p.id === 'custom') setShowCustom(v => !v); else { setPreset(p.id); setShowCustom(false); } }}>
                            {p.label} {p.id === 'custom' && (showCustom ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
                        </button>
                    ))}
                </div>
                {showCustom && (
                    <div className="custom-range">
                        <label>Du</label>
                        <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
                        <label>au</label>
                        <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} />
                        <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                            onClick={() => { if (customFrom && customTo) { setPreset('custom'); setShowCustom(false); } }}>
                            Appliquer
                        </button>
                    </div>
                )}
                <div className="period-label">
                    <Calendar size={13} />
                    {preset === 'today' && "Aujourd'hui"}
                    {preset === '7d' && '7 derniers jours'}
                    {preset === '30d' && '30 derniers jours'}
                    {preset === 'custom' && customFrom && `${fmt(new Date(customFrom))} → ${customTo ? fmt(new Date(customTo)) : '...'}`}
                </div>
            </div>

            {/* Source Filter */}
            <div className="source-filter">
                <button className={`source-btn all ${source === 'all' ? 'active' : ''}`} onClick={() => setSource('all')}>
                    <BarChart3 size={14} /> Tout
                    <span className="source-count">{filtDirect.length + filtOrders.length}</span>
                </button>
                <button className={`source-btn direct ${source === 'direct' ? 'active' : ''}`} onClick={() => setSource('direct')}>
                    <Store size={14} /> Ventes directes
                    <span className="source-count">{filtDirect.length}</span>
                </button>
                <button className={`source-btn commande ${source === 'commande' ? 'active' : ''}`} onClick={() => setSource('commande')}>
                    <ClipboardList size={14} /> Commandes
                    <span className="source-count">{filtOrders.length}</span>
                </button>
            </div>

            {/* KPI Cards */}
            <div className="stats-grid" style={{ marginTop: 16 }}>
                <StatCard icon={<div className="stat-icon revenue"><Euro size={22} /></div>}
                    label="Chiffre d'Affaires" value={`${stats.revenue.toFixed(2)} €`}
                    prevValue={prevStats?.revenue}
                    sub={source === 'all' ? `Caisse: ${filtDirect.reduce((s, x) => s + x.total, 0).toFixed(0)}€ · Cmd: ${filtOrders.reduce((s, x) => s + x.total, 0).toFixed(0)}€` : null} />
                <StatCard icon={<div className="stat-icon orders"><ShoppingBag size={22} /></div>}
                    label="Transactions" value={stats.orders} prevValue={prevStats?.orders} />
                <StatCard icon={<div className="stat-icon items"><TrendingUp size={22} /></div>}
                    label="Articles vendus" value={stats.items} prevValue={prevStats?.items} />
                <StatCard icon={<div className="stat-icon avg"><Activity size={22} /></div>}
                    label="Ticket moyen" value={`${stats.avg.toFixed(2)} €`}
                    prevValue={prevStats?.avg} />
            </div>

            {/* Charts */}
            <div className="charts-container" style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>

                {/* Trend Chart */}
                <div className="chart-card">
                    <div className="chart-card-header">
                        <h3><Activity size={15} /> {showDaily ? 'Évolution par jour' : 'Ventes par heure'}</h3>
                        <div className="chart-toggles-row">
                            <div className="chart-type-toggle">
                                <button className={chartMode === 'revenue' ? 'active' : ''} onClick={() => setChartMode('revenue')}>CA (€)</button>
                                <button className={chartMode === 'qty' ? 'active' : ''} onClick={() => setChartMode('qty')}>Nb ventes</button>
                            </div>
                            {source === 'all' && showDaily && (
                                <div className="chart-type-toggle">
                                    <button className={chartMetric === 'total' ? 'active' : ''} onClick={() => setChartMetric('total')}>Tout</button>
                                    <button className={chartMetric === 'direct' ? 'active' : ''} onClick={() => setChartMetric('direct')}>Caisse</button>
                                    <button className={chartMetric === 'commande' ? 'active' : ''} onClick={() => setChartMetric('commande')}>VPC</button>
                                </div>
                            )}
                        </div>
                    </div>
                    <div style={{ width: '100%', height: 270 }}>
                        <ResponsiveContainer>
                            {showDaily ? (
                                <LineChart data={dailyData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                                    <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => chartMode === 'revenue' ? `${v}€` : v} />
                                    <Tooltip content={<CustomTooltip chartMode={chartMode} />} />
                                    {source === 'all' ? (
                                        chartMetric === 'total' ? (
                                            <Line type="monotone" dataKey={chartMode === 'revenue' ? "total" : "ventes"} stroke="#f472b6" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} name="total" />
                                        ) : chartMetric === 'direct' ? (
                                            <Line type="monotone" dataKey={chartMode === 'revenue' ? "direct" : "ventes_direct"} stroke={SOURCE_COLORS.direct} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} name="direct" />
                                        ) : (
                                            <Line type="monotone" dataKey={chartMode === 'revenue' ? "commande" : "ventes_commande"} stroke={SOURCE_COLORS.commande} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} name="commande" />
                                        )
                                    ) : (
                                        <Line type="monotone" dataKey={chartMode === 'revenue' ? source : "ventes"} stroke={SOURCE_COLORS[source]} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} name={source} />
                                    )}
                                </LineChart>
                            ) : (
                                <BarChart data={hourlyData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                                    <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${v}€`} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(244,114,182,0.07)' }} />
                                    <Legend formatter={v => v === 'direct' ? '🛍 Caisse' : '📋 Cmd'} />
                                    {source !== 'commande' && <Bar dataKey="direct" fill={SOURCE_COLORS.direct} radius={[3, 3, 0, 0]} stackId="a" name="direct" />}
                                    {source !== 'direct' && <Bar dataKey="commande" fill={SOURCE_COLORS.commande} radius={[3, 3, 0, 0]} stackId="a" name="commande" />}
                                </BarChart>
                            )}
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Products */}
                <div className="chart-card">
                    <div className="chart-card-header">
                        <h3><PieChartIcon size={15} /> Top produits</h3>
                        <div className="chart-type-toggle">
                            <button className={topMode === 'qty' ? 'active' : ''} onClick={() => setTopMode('qty')}>Qté</button>
                            <button className={topMode === 'revenue' ? 'active' : ''} onClick={() => setTopMode('revenue')}>CA</button>
                        </div>
                    </div>
                    {topProducts.length > 0 ? (
                        <>
                            <ResponsiveContainer width="100%" height={155}>
                                <PieChart>
                                    <Pie data={topProducts} cx="50%" cy="50%" innerRadius={42} outerRadius={62} paddingAngle={3} dataKey={topMode === 'qty' ? 'qty' : 'revenue'}>
                                        {topProducts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip formatter={(v, _n, props) => topMode === 'qty' ? [`${v} unités`, props.payload?.name] : [`${v.toFixed(2)} €`, props.payload?.name]} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="top-products-list">
                                {topProducts.map((p, i) => (
                                    <div key={p.name} className="top-product-row">
                                        <div className="top-product-dot" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                        <span className="top-product-name">{p.name}</span>
                                        <span className="top-product-val">{topMode === 'qty' ? `${p.qty} u.` : `${p.revenue.toFixed(2)} €`}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="chart-empty">Pas de ventes sur cette période.</div>
                    )}
                </div>
            </div>

            {/* Daily breakdown table */}
            {showDaily && dailyData.some(d => d.total > 0) && (
                <div className="chart-card" style={{ marginTop: 20 }}>
                    <div className="chart-card-header">
                        <h3><BarChart3 size={15} /> Détail par jour</h3>
                    </div>
                    <div className="day-table">
                        <div className="day-table-head">
                            <span>Date</span>
                            <span>Transactions</span>
                            {source !== 'commande' && <span style={{ color: SOURCE_COLORS.direct }}>Caisse</span>}
                            {source !== 'direct' && <span style={{ color: SOURCE_COLORS.commande }}>Cmd</span>}
                            <span>Total</span>
                        </div>
                        {[...dailyData].reverse().filter(d => d.total > 0).map(d => (
                            <div key={d.date} className="day-table-row">
                                <span>{d.fullDate}</span>
                                <span>{d.ventes}</span>
                                {source !== 'commande' && <span style={{ color: SOURCE_COLORS.direct, fontWeight: 600 }}>{d.direct > 0 ? `${d.direct.toFixed(2)} €` : '—'}</span>}
                                {source !== 'direct' && <span style={{ color: SOURCE_COLORS.commande, fontWeight: 600 }}>{d.commande > 0 ? `${d.commande.toFixed(2)} €` : '—'}</span>}
                                <span className="day-ca">{d.total.toFixed(2)} €</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Low Stock */}
            {lowStock.length > 0 && (
                <div className="alert-card" style={{ marginTop: 20 }}>
                    <h3><AlertTriangle size={17} /> Alertes de stock ({lowStock.length})</h3>
                    <div className="stock-alert-grid">
                        {lowStock.map(p => (
                            <div key={p.id} className={`stock-alert-item ${p.stock === 0 ? 'out' : 'low'}`}>
                                <PackageX size={17} />
                                <div>
                                    <div className="stock-name">{p.name}</div>
                                    <div className="stock-qty">{p.stock === 0 ? '🔴 RUPTURE' : `🟡 ${p.stock} restant${p.stock > 1 ? 's' : ''}`} / seuil {p.alertThreshold}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
