import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Calendar, DollarSign, PieChart as PieChartIcon, Activity, AlertTriangle, PackageX } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { getAllSales, getProducts } from '../../db/indexedDB';
import './Dashboard.css';

const COLORS = ['#f472b6', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

export default function Dashboard() {
    const [sales, setSales] = useState([]);
    const [stats, setStats] = useState({ totalRevenue: 0, totalOrders: 0, itemsSold: 0 });
    const [hourlyData, setHourlyData] = useState([]);
    const [topProducts, setTopProducts] = useState([]);
    const [lowStockProducts, setLowStockProducts] = useState([]);

    useEffect(() => {
        const fetchSales = async () => {
            try {
                const data = await getAllSales();
                setSales(data);

                // Calculate basic stats for today
                const today = new Date().toDateString();
                const todaySales = data.filter(s => new Date(s.timestamp).toDateString() === today);

                const total = todaySales.reduce((sum, s) => sum + s.total, 0);
                const items = todaySales.reduce((sum, s) => sum + s.itemsCount, 0);

                setStats({
                    totalRevenue: total,
                    totalOrders: todaySales.length,
                    itemsSold: items
                });

                // Calculate Hourly Sales Data
                const hourlyMap = {};
                for (let i = 8; i <= 20; i++) hourlyMap[i] = { name: `${i}h`, ventes: 0 };

                todaySales.forEach(sale => {
                    const hour = new Date(sale.timestamp).getHours();
                    if (hourlyMap[hour]) {
                        hourlyMap[hour].ventes += sale.total;
                    }
                });
                setHourlyData(Object.values(hourlyMap));

                // Calculate Best Sellers Pipeline
                const productsCount = {};
                data.forEach(sale => {
                    sale.items.forEach(item => {
                        if (!productsCount[item.name]) productsCount[item.name] = 0;
                        productsCount[item.name] += item.quantity;
                    });
                });

                const sortedProducts = Object.entries(productsCount)
                    .map(([name, value]) => ({ name, value }))
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 5); // Top 5

                setTopProducts(sortedProducts);

                // Fetch low stock products (threshold: stock <= 5)
                const allProducts = await getProducts();
                const lowStock = allProducts
                    .filter(p => p.stock !== undefined && p.stock <= 5)
                    .sort((a, b) => a.stock - b.stock);
                setLowStockProducts(lowStock);

            } catch (err) {
                console.error(err);
            }
        };

        fetchSales();
    }, []);

    return (
        <div className="admin-container">
            <div className="admin-header">
                <h2><BarChart3 /> Menu de Synthèse</h2>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon revenue"><DollarSign size={24} /></div>
                    <div className="stat-info">
                        <h3>Chiffre d'Affaires (Auj.)</h3>
                        <span className="stat-value">{stats.totalRevenue.toFixed(2)} €</span>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon orders"><Calendar size={24} /></div>
                    <div className="stat-info">
                        <h3>Commandes (Auj.)</h3>
                        <span className="stat-value">{stats.totalOrders}</span>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon items"><TrendingUp size={24} /></div>
                    <div className="stat-info">
                        <h3>Articles Vendus (Auj.)</h3>
                        <span className="stat-value">{stats.itemsSold}</span>
                    </div>
                </div>
            </div>

            <div className="charts-container" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '24px', marginTop: '24px' }}>

                {/* Hourly Chart */}
                <div className="chart-card" style={{ backgroundColor: 'var(--color-surface)', padding: '24px', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border)' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-muted)', marginBottom: '24px' }}><Activity size={18} /> Ventes par Heure (Aujourd'hui)</h3>
                    <div style={{ width: '100%', height: 300 }}>
                        <ResponsiveContainer>
                            <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}€`} />
                                <Tooltip cursor={{ fill: 'rgba(244, 114, 182, 0.1)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                                <Bar dataKey="ventes" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Products Pie Chart */}
                <div className="chart-card" style={{ backgroundColor: 'var(--color-surface)', padding: '24px', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border)' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-muted)', marginBottom: '8px' }}><PieChartIcon size={18} /> Top 5 (Global)</h3>

                    {topProducts.length > 0 ? (
                        <div style={{ width: '100%', height: 300, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <ResponsiveContainer width="100%" height={220}>
                                <PieChart>
                                    <Pie
                                        data={topProducts}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {topProducts.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="pie-legend" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                                {topProducts.slice(0, 3).map((p, i) => (
                                    <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: COLORS[i] }} />
                                            <span style={{ color: 'var(--color-text-muted)', maxWidth: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                                        </div>
                                        <span style={{ fontWeight: 600 }}>{p.value} ut.</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                            Pas encore de données.
                        </div>
                    )}
                </div>

            </div>

            {/* Low Stock Alarms */}
            {lowStockProducts.length > 0 && (
                <div style={{ marginTop: '24px', backgroundColor: '#fff7ed', border: '1px solid #fb923c', borderRadius: '16px', padding: '24px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#c2410c', marginBottom: '16px' }}>
                        <AlertTriangle size={20} /> Alertes de Stock ({lowStockProducts.length} produit{lowStockProducts.length > 1 ? 's' : ''})
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                        {lowStockProducts.map(p => (
                            <div key={p.id} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '12px 16px',
                                borderRadius: '12px',
                                backgroundColor: p.stock === 0 ? '#fee2e2' : '#fff',
                                border: `1px solid ${p.stock === 0 ? '#f87171' : '#fed7aa'}`
                            }}>
                                <PackageX size={20} color={p.stock === 0 ? '#ef4444' : '#f97316'} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text)' }}>{p.name}</div>
                                    <div style={{
                                        fontSize: '0.8rem',
                                        fontWeight: 700,
                                        color: p.stock === 0 ? '#ef4444' : '#f97316'
                                    }}>
                                        {p.stock === 0 ? '🔴 RUPTURE DE STOCK' : `🟡 Plus que ${p.stock} restant${p.stock > 1 ? 's' : ''}`}
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
