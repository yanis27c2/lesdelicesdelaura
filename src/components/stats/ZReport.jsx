import { useState, useEffect } from 'react';
import { Calculator, Wallet, DollarSign, Printer, AlertTriangle, CheckCircle2, History, Trash2 } from 'lucide-react';
import { getAllSales, getExpenses, saveExpense, deleteExpense, saveZReport, getZReports } from '../../db/indexedDB';
import './ZReport.css';

const METHOD_CONFIG = {
    especes: { label: 'Espèces', icon: '💵', color: '#10b981', bg: '#dcfce7' },
    cb: { label: 'CB', icon: '💳', color: '#3b82f6', bg: '#dbeafe' },
    cheque: { label: 'Chèque', icon: '📝', color: '#8b5cf6', bg: '#ede9fe' },
};

export default function ZReport() {
    const [sales, setSales] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [zReports, setZReports] = useState([]);
    const [startingCash, setStartingCash] = useState(0);
    const [countedCash, setCountedCash] = useState('');
    const [newExpenseDesc, setNewExpenseDesc] = useState('');
    const [newExpenseAmount, setNewExpenseAmount] = useState('');
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        setLoading(true);
        try {
            const allSales = await getAllSales();
            const allExpenses = await getExpenses();
            const allZReports = await getZReports();
            const todayStr = new Date().toDateString();
            setSales(allSales.filter(s => new Date(s.timestamp).toDateString() === todayStr));
            setExpenses(allExpenses.filter(e => new Date(e.timestamp).toDateString() === todayStr));
            setZReports(allZReports.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    useEffect(() => {
        const refresh = () => loadData();
        window.addEventListener('saleAdded', refresh);
        window.addEventListener('catalogUpdated', refresh);
        return () => {
            window.removeEventListener('saleAdded', refresh);
            window.removeEventListener('catalogUpdated', refresh);
        };
    }, []);

    // Payment breakdown
    const paymentTotals = { especes: 0, cb: 0, cheque: 0 };
    sales.forEach(s => {
        const method = s.paymentMethod || 'especes'; // sales without method = espèces (legacy)
        if (paymentTotals[method] !== undefined) paymentTotals[method] += s.total;
        else paymentTotals.especes += s.total;
    });

    const totalAllSales = sales.reduce((sum, s) => sum + s.total, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

    // Only espèces affect the physical cash drawer
    const expectedCashInDrawer = startingCash + paymentTotals.especes - totalExpenses;
    const countedCashNum = parseFloat(countedCash) || 0;
    const discrepancy = countedCashNum - expectedCashInDrawer;

    const handleAddExpense = async (e) => {
        e.preventDefault();
        if (!newExpenseDesc || !newExpenseAmount) return;
        await saveExpense({ description: newExpenseDesc, amount: parseFloat(newExpenseAmount) });
        setNewExpenseDesc(''); setNewExpenseAmount('');
        loadData();
    };

    const handleDeleteExpense = async (id) => {
        if (confirm('Supprimer cette dépense ?')) { await deleteExpense(id); loadData(); }
    };

    const handleGenerateZ = async () => {
        if (countedCash === '') { alert('Veuillez entrer le montant compté dans la caisse.'); return; }
        const report = {
            startingCash,
            totalAllSales,
            paymentBreakdown: paymentTotals,
            totalExpenses,
            expectedCash: expectedCashInDrawer,
            countedCash: countedCashNum,
            discrepancy,
            salesCount: sales.length,
            expensesList: expenses
        };
        await saveZReport(report);
        alert(
            `Clôture Z enregistrée !\n` +
            `💵 Espèces : ${paymentTotals.especes.toFixed(2)} €\n` +
            `💳 CB : ${paymentTotals.cb.toFixed(2)} €\n` +
            `📝 Chèques : ${paymentTotals.cheque.toFixed(2)} €\n` +
            `────────────────\n` +
            `Écart caisse : ${discrepancy >= 0 ? '+' : ''}${discrepancy.toFixed(2)} €`
        );
        loadData();
    };

    if (loading) return <div style={{ padding: 24 }}>Chargement...</div>;

    return (
        <div className="admin-container" style={{ overflowY: 'auto', paddingBottom: '60px' }}>
            <div className="admin-header">
                <h2><Calculator /> Clôture de Caisse (Z)</h2>
            </div>

            <div className="z-grid">

                {/* Left Column */}
                <div className="z-col">

                    {/* 1. Fond de caisse */}
                    <div className="card">
                        <h3>1. Fond de Caisse (Matin)</h3>
                        <div className="input-row">
                            <Wallet className="icon-muted" />
                            <input type="number" value={startingCash} onChange={e => setStartingCash(parseFloat(e.target.value) || 0)} className="z-input" />
                            <span>€</span>
                        </div>
                    </div>

                    {/* 2. Ventilation par moyen de paiement */}
                    <div className="card">
                        <h3 style={{ marginBottom: 14 }}>2. Ventes du jour — {sales.length} transaction{sales.length !== 1 ? 's' : ''}</h3>

                        {/* Breakdown chips */}
                        <div className="payment-breakdown-grid">
                            {Object.entries(METHOD_CONFIG).map(([key, cfg]) => (
                                <div key={key} className="payment-method-chip" style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.color}44` }}>
                                    <div className="pm-icon">{cfg.icon}</div>
                                    <div className="pm-label">{cfg.label}</div>
                                    <div className="pm-amount" style={{ color: cfg.color }}>{paymentTotals[key].toFixed(2)} €</div>
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontWeight: 700, fontSize: '0.95rem', paddingTop: 10, borderTop: '1px solid var(--color-border)' }}>
                            <span>Total des ventes</span>
                            <span style={{ color: '#10b981' }}>+ {totalAllSales.toFixed(2)} €</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 6 }}>
                            ℹ️ Seules les ventes en espèces affectent le tiroir-caisse physique.
                        </div>
                    </div>

                    {/* 3. Petite caisse */}
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <h3>3. Petite Caisse (Dépenses)</h3>
                            <span className="summary-val negative">- {totalExpenses.toFixed(2)} €</span>
                        </div>
                        <form onSubmit={handleAddExpense} className="expense-form">
                            <input type="text" placeholder="Achat fournitures..." value={newExpenseDesc} onChange={e => setNewExpenseDesc(e.target.value)} required />
                            <div className="amount-input">
                                <input type="number" step="0.01" placeholder="0.00" value={newExpenseAmount} onChange={e => setNewExpenseAmount(e.target.value)} required />
                                <span>€</span>
                            </div>
                            <button type="submit" className="btn-secondary add-exp">Ajouter</button>
                        </form>
                        <div className="expenses-list">
                            {expenses.map(exp => (
                                <div key={exp.id} className="expense-item">
                                    <span className="exp-desc">{exp.description}</span>
                                    <div className="exp-right">
                                        <span className="exp-amt">- {parseFloat(exp.amount).toFixed(2)} €</span>
                                        <button className="btn-icon delete" onClick={() => handleDeleteExpense(exp.id)}><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            ))}
                            {expenses.length === 0 && <span className="text-muted" style={{ fontSize: '0.85rem' }}>Aucune dépense enregistrée aujourd'hui.</span>}
                        </div>
                    </div>

                    <div className="card highlight">
                        <h3>= Caisse Théorique (Espèces seulement)</h3>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 8 }}>
                            {startingCash.toFixed(2)} + {paymentTotals.especes.toFixed(2)} − {totalExpenses.toFixed(2)} €
                        </div>
                        <div className="summary-val total">{expectedCashInDrawer.toFixed(2)} €</div>
                    </div>
                </div>

                {/* Right Column */}
                <div className="z-col">
                    <div className="card count-card">
                        <h3>Comptage Réel (Soir)</h3>
                        <p className="text-muted" style={{ marginBottom: 16, fontSize: '0.9rem' }}>Comptez vos espèces et entrez le total ci-dessous :</p>
                        <div className="input-row large">
                            <DollarSign />
                            <input type="number" step="0.01" value={countedCash} onChange={e => setCountedCash(e.target.value)} className="z-input huge" placeholder="0.00" />
                            <span>€</span>
                        </div>
                    </div>

                    {countedCash !== '' && (
                        <div className={`card result-card ${discrepancy === 0 ? 'perfect' : discrepancy > 0 ? 'surplus' : 'deficit'}`}>
                            <h3>Résultat du comptage</h3>
                            <div className="discrepancy-display">
                                Écart : <span className="val">{discrepancy > 0 ? '+' : ''}{discrepancy.toFixed(2)} €</span>
                            </div>
                            <div className="discrepancy-message">
                                {discrepancy === 0 && <><CheckCircle2 /> Caisse parfaite ! Aucun écart.</>}
                                {discrepancy > 0 && <><AlertTriangle /> Excédent de caisse.</>}
                                {discrepancy < 0 && <><AlertTriangle /> Déficit de caisse.</>}
                            </div>
                            <button className="btn-primary generate-z-btn" onClick={handleGenerateZ}>
                                <Printer size={18} /> Clôturer et Imprimer le Z
                            </button>
                        </div>
                    )}

                    {/* Historique */}
                    <div className="card history-card">
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><History size={18} /> Historique des Z</h3>
                        <div className="history-list">
                            {zReports.slice(0, 5).map(z => (
                                <div key={z.id} className="history-item">
                                    <div className="hist-meta">
                                        <span className="hist-date">{z.date}</span>
                                        <span className="hist-time">{new Date(z.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                    <div className="hist-details">
                                        {z.paymentBreakdown
                                            ? Object.entries(METHOD_CONFIG).map(([key, cfg]) =>
                                                z.paymentBreakdown[key] > 0 && (
                                                    <span key={key} style={{ color: cfg.color }}>{cfg.icon} {z.paymentBreakdown[key].toFixed(2)}€</span>
                                                ))
                                            : <span>Total: {(z.totalCashSales || z.totalAllSales || 0).toFixed(2)}€</span>
                                        }
                                        <span className={`hist-diff ${z.discrepancy < 0 ? 'neg' : z.discrepancy > 0 ? 'pos' : 'ok'}`}>
                                            Écart: {z.discrepancy > 0 ? '+' : ''}{z.discrepancy.toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {zReports.length === 0 && <span className="text-muted" style={{ fontSize: '0.85rem' }}>Aucun Z de caisse généré.</span>}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
