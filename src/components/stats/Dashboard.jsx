import { useState, useEffect, useMemo } from 'react';
import {
    BarChart3, TrendingUp, Calendar, Euro, PieChart as PieChartIcon,
    Activity, AlertTriangle, PackageX, ShoppingBag, ArrowUpRight, ArrowDownRight,
    Minus, ChevronDown, ChevronUp
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend
} from 'recharts';
import { getAllSales, getProducts } from '../../db/indexedDB';
import './Dashboard.css';

const COLORS = ['#f472b6', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

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
    if (preset === 'custom' && customFrom && customTo) {
        return { from: startOfDay(new Date(customFrom)), to: endOfDay(new Date(customTo)) };
    }
    return { from: startOfDay(now), to: endOfDay(now) };
}

function getPrevPeriodBounds(preset, customFrom, customTo) {
    const now = new Date();
    if (preset === 'today') { const y = new Date(now); y.setDate(y.getDate() - 1); return { from: startOfDay(y), to: endOfDay(y) }; }
    if (preset === '7d') { const f = new Date(now); f.setDate(f.getDate() - 13); const t = new Date(now); t.setDate(t.getDate() - 7); return { from: startOfDay(f), to: endOfDay(t) }; }
    if (preset === '30d') { const f = new Date(now); f.setDate(f.getDate() - 59); const t = new Date(now); t.setDate(t.getDate() - 30); return { from: startOfDay(f), to: endOfDay(t) }; }
    return null;
}

function filterSales(sales, from, to) {
    return sales.filter(s => {
        const d = new Date(s.timestamp);
        return d >= from && d <= to;
    });
}

function computeStats(filtered) {
    const revenue = filtered.reduce((s, x) => s + x.total, 0);
    const orders = filtered.length;
    const items = filtered.reduce((s, x) => s + (x.itemsCount || 0), 0);
    const avg = orders > 0 ? revenue / orders : 0;
    return { revenue, orders, items, avg };
}

function buildDailyData(filtered, from, to) {
    const map = {};
    const cur = new Date(from);
    while (cur <= to) {
        const key = cur.toISOString().slice(0, 10);
        map[key] = { date: fmt(cur), fullDate: fmtFull(new Date(cur)), ca: 0, ventes: 0 };
        cur.setDate(cur.getDate() + 1);
    }
    filtered.forEach(s => {
        const key = new Date(s.timestamp).toISOString().slice(0, 10);
        if (map[key]) { map[key].ca += s.total; map[key].ventes += 1; }
    });
    return Object.values(map);
}

function buildHourlyData(filtered) {
    const map = {};
    for (let h = 7; h <= 20; h++) map[h] = { name: `${h}h`, ca: 0 };
    filtered.forEach(s => {
        const h = new Date(s.timestamp).getHours();
        if (map[h]) map[h].ca += s.total;
    });
    return Object.values(map);
}

function buildTopProducts(filtered) {
    const cnt = {};
    const rev = {};
    filtered.forEach(s => {
        (s.items || []).forEach(it => {
            if (!cnt[it.name]) { cnt[it.name] = 0; rev[it.name] = 0; }
            cnt[it.name] += it.quantity;
            rev[it.name] += (it.price || 0) * it.quantity;
        });
    });
    return Object.entries(cnt)
        .map(([name, qty]) => ({ name, qty, revenue: rev[name] || 0 }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 6);
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

/* ── Stat Card ── */
function StatCard({ icon, label, value, sub, prevValue }) {
    return (
        <div className="stat-card">
            <div className="stat-icon-wrap">{icon}</div>
            <div className="stat-info">
                <h3>{label}</h3>
                <span className="stat-value">{value}</span>
                <div className="stat-footer">
                    {sub && <span className="stat-sub">{sub}</span>}
                    {prevValue !== undefined && <Delta cur={typeof value === 'string' ? parseFloat(value) : value} prev={prevValue} />}
                </div>
            </div>
        </div>
    );
}

/* ── Custom Tooltip ── */
function CustomTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    const fullDate = payload[0]?.payload?.fullDate || label;
    return (
        <div className="chart-tooltip">
            <p className="tooltip-label">{fullDate}</p>
            {payload.map((p, i) => (
                <p key={i} style={{ color: p.color, margin: '2px 0', fontSize: '0.85rem' }}>
                    {p.name === 'ca' ? 'CA' : p.name === 'ventes' ? 'Ventes' : p.name} : <strong>{p.name === 'ca' ? `${p.value.toFixed(2)} €` : p.value}</strong>
                </p>
            ))}
        </div>
    );
}

/* ══════════════════ MAIN COMPONENT ══════════════════ */
export default function Dashboard() {
    const [sales, setSales] = useState([]);
    const [products, setProducts] = useState([]);
    const [preset, setPreset] = useState('7d');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [showCustom, setShowCustom] = useState(false);
    const [chartType, setChartType] = useState('ca'); // 'ca' ou 'ventes'
    const [topMode, setTopMode] = useState('qty'); // 'qty' ou 'revenue'

    useEffect(() => {
        getAllSales().then(setSales);
        getProducts().then(setProducts);
    }, []);

    const { from, to } = useMemo(() => getPeriodBounds(preset, customFrom, customTo), [preset, customFrom, customTo]);
    const prevBounds = useMemo(() => getPrevPeriodBounds(preset, customFrom, customTo), [preset, customFrom, customTo]);

    const filtered = useMemo(() => filterSales(sales, from, to), [sales, from, to]);
    const prevFiltered = useMemo(() => prevBounds ? filterSales(sales, prevBounds.from, prevBounds.to) : [], [sales, prevBounds]);

    const stats = useMemo(() => computeStats(filtered), [filtered]);
    const prevStats = useMemo(() => prevBounds ? computeStats(prevFiltered) : null, [prevFiltered, prevBounds]);

    const dailyData = useMemo(() => buildDailyData(filtered, from, to), [filtered, from, to]);
    const hourlyData = useMemo(() => buildHourlyData(filtered), [filtered]);
    const topProducts = useMemo(() => buildTopProducts(filtered), [filtered]);

    const lowStock = useMemo(() => products.filter(p => p.stock !== undefined && p.alertThreshold > 0 && p.stock <= p.alertThreshold).sort((a, b) => a.stock - b.stock), [products]);
    const outOfStock = products.filter(p => p.stock === 0);

    const PRESETS = [
        { id: 'today', label: "Aujourd'hui" },
        { id: '7d', label: '7 derniers jours' },
        { id: '30d', label: '30 derniers jours' },
        { id: 'custom', label: 'Personnalisé' },
    ];

    const showDaily = preset !== 'today';

    const applyCustom = () => {
        if (customFrom && customTo) setPreset('custom');
    };

    return (
        <div className="admin-container dash-root" style={{ overflowY: 'auto', paddingBottom: 60 }}>
            {/* ── Header ── */}
            <div className="admin-header">
                <h2><BarChart3 /> Statistiques</h2>
            </div>

            {/* ── Period Selector ── */}
            <div className="period-bar">
                <div className="period-tabs">
                    {PRESETS.map(p => (
                        <button
                            key={p.id}
                            className={`period-tab ${preset === p.id ? 'active' : ''}`}
                            onClick={() => { if (p.id === 'custom') setShowCustom(v => !v); else { setPreset(p.id); setShowCustom(false); } }}
                        >
                            {p.label} {p.id === 'custom' && (showCustom ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                        </button>
                    ))}
                </div>
                {showCustom && (
                    <div className="custom-range">
                        <label>Du</label>
                        <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
                        <label>au</label>
                        <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} />
                        <button className="btn-primary" style={{ padding: '6px 14px', fontSize: '0.85rem' }} onClick={applyCustom}>Appliquer</button>
                    </div>
                )}
                <div className="period-label">
                    <Calendar size={14} />
                    {preset === 'today' && "Aujourd'hui"}
                    {preset === '7d' && 'Ce week (7 jours)'}
                    {preset === '30d' && 'Ce mois (30 jours)'}
                    {preset === 'custom' && customFrom && customTo && `Du ${fmt(new Date(customFrom))} au ${fmt(new Date(customTo))}`}
                </div>
            </div>

            {/* ── KPI Cards ── */}
            <div className="stats-grid" style={{ marginTop: 24 }}>
                <StatCard
                    icon={<div className="stat-icon revenue"><Euro size={22} /></div>}
                    label="Chiffre d'Affaires"
                    value={`${stats.revenue.toFixed(2)} €`}
                    prevValue={prevStats?.revenue}
                    sub={prevStats ? `vs ${prevStats.revenue.toFixed(2)} € période préc.` : null}
                />
                <StatCard
                    icon={<div className="stat-icon orders"><ShoppingBag size={22} /></div>}
                    label="Ventes"
                    value={stats.orders}
                    prevValue={prevStats?.orders}
                    sub={prevStats ? `vs ${prevStats.orders} période préc.` : null}
                />
                <StatCard
                    icon={<div className="stat-icon items"><TrendingUp size={22} /></div>}
                    label="Articles vendus"
                    value={stats.items}
                    prevValue={prevStats?.items}
                />
                <StatCard
                    icon={<div className="stat-icon avg"><Activity size={22} /></div>}
                    label="Ticket moyen"
                    value={`${stats.avg.toFixed(2)} €`}
                    prevValue={prevStats?.avg}
                />
            </div>

            {/* ── Main Chart ── */}
            <div className="charts-container" style={{ marginTop: 24, display: 'grid', gridTemplateColumns: showDaily ? '2fr 1fr' : '2fr 1fr', gap: 24 }}>

                {/* Daily trend (7d/30d/custom) or Hourly (today) */}
                <div className="chart-card">
                    <div className="chart-card-header">
                        <h3><Activity size={16} /> {showDaily ? 'Évolution du CA par jour' : 'Ventes par heure'}</h3>
                        {showDaily && (
                            <div className="chart-type-toggle">
                                <button className={chartType === 'ca' ? 'active' : ''} onClick={() => setChartType('ca')}>CA (€)</button>
                                <button className={chartType === 'ventes' ? 'active' : ''} onClick={() => setChartType('ventes')}>Nb ventes</button>
                            </div>
                        )}
                    </div>
                    <div style={{ width: '100%', height: 280 }}>
                        <ResponsiveContainer>
                            {showDaily ? (
                                <LineChart data={dailyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                                    <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => chartType === 'ca' ? `${v}€` : v} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Line type="monotone" dataKey={chartType} stroke="var(--color-primary)" strokeWidth={2.5} dot={{ fill: 'var(--color-primary)', r: 3 }} activeDot={{ r: 6 }} name={chartType} />
                                </LineChart>
                            ) : (
                                <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                                    <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${v}€`} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(244,114,182,0.08)' }} />
                                    <Bar dataKey="ca" fill="var(--color-primary)" radius={[4, 4, 0, 0]} name="ca" />
                                </BarChart>
                            )}
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Products */}
                <div className="chart-card">
                    <div className="chart-card-header">
                        <h3><PieChartIcon size={16} /> Top produits</h3>
                        <div className="chart-type-toggle">
                            <button className={topMode === 'qty' ? 'active' : ''} onClick={() => setTopMode('qty')}>Qté</button>
                            <button className={topMode === 'revenue' ? 'active' : ''} onClick={() => setTopMode('revenue')}>CA</button>
                        </div>
                    </div>

                    {topProducts.length > 0 ? (
                        <>
                            <ResponsiveContainer width="100%" height={160}>
                                <PieChart>
                                    <Pie
                                        data={topProducts}
                                        cx="50%" cy="50%"
                                        innerRadius={45} outerRadius={68}
                                        paddingAngle={3}
                                        dataKey={topMode === 'qty' ? 'qty' : 'revenue'}
                                    >
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
                                        <span className="top-product-val">
                                            {topMode === 'qty' ? `${p.qty} u.` : `${p.revenue.toFixed(2)} €`}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="chart-empty">Pas de ventes sur cette période.</div>
                    )}
                </div>
            </div>

            {/* ── Daily breakdown table (7d/30d) ── */}
            {showDaily && dailyData.some(d => d.ca > 0) && (
                <div className="chart-card" style={{ marginTop: 24 }}>
                    <div className="chart-card-header">
                        <h3><BarChart3 size={16} /> Détail par jour</h3>
                    </div>
                    <div className="day-table">
                        <div className="day-table-head">
                            <span>Date</span>
                            <span>Ventes</span>
                            <span>CA</span>
                            <span>Ticket moy.</span>
                        </div>
                        {[...dailyData].reverse().filter(d => d.ca > 0 || d.ventes > 0).map(d => (
                            <div key={d.date} className="day-table-row">
                                <span>{d.fullDate}</span>
                                <span>{d.ventes}</span>
                                <span className="day-ca">{d.ca.toFixed(2)} €</span>
                                <span>{d.ventes > 0 ? `${(d.ca / d.ventes).toFixed(2)} €` : '—'}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Low Stock Alerts ── */}
            {(lowStock.length > 0 || outOfStock.length > 0) && (
                <div className="alert-card" style={{ marginTop: 24 }}>
                    <h3><AlertTriangle size={18} /> Alertes de stock ({lowStock.length + outOfStock.length})</h3>
                    <div className="stock-alert-grid">
                        {lowStock.map(p => (
                            <div key={p.id} className={`stock-alert-item ${p.stock === 0 ? 'out' : 'low'}`}>
                                <PackageX size={18} />
                                <div>
                                    <div className="stock-name">{p.name}</div>
                                    <div className="stock-qty">
                                        {p.stock === 0 ? '🔴 RUPTURE' : `🟡 ${p.stock} restant${p.stock > 1 ? 's' : ''}`}
                                        {p.alertThreshold > 0 && ` / seuil ${p.alertThreshold}`}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
