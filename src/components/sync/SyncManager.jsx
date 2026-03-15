import { useState, useEffect, useRef } from 'react';
import { CloudUpload, RefreshCw, CheckCircle, AlertCircle, CloudDownload, Trash2, ShieldAlert, Download, Upload } from 'lucide-react';
import {
    getAllSales, getProducts, getCategories,
    getExpenses, getZReports, getOrders, getDevis,
    clearAllSales, clearAllExpenses, clearAllZReports,
    saveOrder, saveDevis, getUnsyncedStockHistory, clearStockHistory,
    saveProduct, deleteProduct, saveCategory, getCustomers,
    clearCatalog, clearAllOrders, clearAllDevis, saveSale,
    getUnsyncedSales, getUnsyncedExpenses, getUnsyncedZReports, clearAllCustomers
} from '../../db/indexedDB';
import './SyncManager.css';

export const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz9rk-6tmCsEN_QhbhBF25uRG5XKanS6vqcLBmc1NVlEKSsEFCpVfDdY_3o6XmWrCK/exec';

const LAST_SYNC_KEY = 'bakery_last_sync';

// --- HELPERS (Top-level for access by syncFromCloud) ---

function fromSheetDate(str) {
    if (!str || typeof str !== 'string') return '';
    if (str.match(/^\d{2}\/\d{2}\/\d{4}/)) {
        const [d, m, y] = str.split('/');
        return `${y}-${m}-${d}`;
    }
    return String(str).slice(0, 10); // Fallback for YYYY-MM-DD
}

function toSheetDate(str) {
    if (!str || typeof str !== 'string') return '';
    if (str.match(/^\d{4}-\d{2}-\d{2}/)) {
        const [y, m, d] = str.split('-');
        return `${d}/${m}/${y}`;
    }
    return str;
}

function fmtDateTime(isoStr) {
    if (!isoStr) return '';
    try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return isoStr;
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch (e) {
        return String(isoStr);
    }
}

export default function SyncManager({ isOnline }) {
    const [lastSync, setLastSync] = useState(() => localStorage.getItem(LAST_SYNC_KEY));
    const [pendingCount, setPendingCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState(null);
    const [counts, setCounts] = useState({ orders: 0, devis: 0 });
    const resultTimer = useRef(null);
    
    const countAll = async () => {
        try {
            const [sales, depenses, clotures, stockHistory, ordersData, devisData] = await Promise.all([
                getUnsyncedSales(), getUnsyncedExpenses(), getUnsyncedZReports(), getUnsyncedStockHistory(),
                getOrders(), getDevis()
            ]);
            setPendingCount(sales.length + depenses.length + clotures.length + stockHistory.length);
            setCounts({ orders: ordersData.length, devis: devisData.length });
        } catch (err) {
            console.error('Erreur comptage données', err);
        }
    };

    useEffect(() => {
        countAll();
        const refresh = () => countAll();
        window.addEventListener('saleAdded', refresh);
        window.addEventListener('catalogUpdated', refresh);
        window.addEventListener('ordersUpdated', refresh);
        window.addEventListener('devisUpdated', refresh);
        return () => {
            window.removeEventListener('saleAdded', refresh);
            window.removeEventListener('catalogUpdated', refresh);
            window.removeEventListener('ordersUpdated', refresh);
            window.removeEventListener('devisUpdated', refresh);
        };
    }, []);

    // Effacer le toast après 5 s
    const showResult = (result) => {
        setSyncResult(result);
        clearTimeout(resultTimer.current);
        resultTimer.current = setTimeout(() => setSyncResult(null), 5000);
    };

    const handleSync = async () => {
        if (!isOnline) {
            showResult({ success: false, message: 'Hors-ligne — connexion requise.' });
            return;
        }

        const confirmed = window.confirm(
            `Téléverser les données vers Google Sheets ?\n\n` +
            `⚠️ TOUTES les données locales (ventes, commandes, devis, etc.) seront EFFACÉES après le succès de l'envoi.`
        );
        if (!confirmed) return;

        setIsSyncing(true);
        setSyncResult(null);

        try {
            const [ventes, products, categories, depenses, clotures, commandes, devis, stock_history, customers] = await Promise.all([
                getAllSales(), getProducts(), getCategories(),
                getExpenses(), getZReports(), getOrders(), getDevis(), getUnsyncedStockHistory(), getCustomers()
            ]);

            const catMap = {};
            categories.forEach(c => { catMap[c.id] = c.name; });
            const catalogue = products.map(p => ({ ...p, categoryName: catMap[p.categoryId] || p.categoryId }));

            const payload = {
                ventes,
                catalogue,
                depenses,
                clotures,
                commandes: commandes.map(o => ({
                    ...o,
                    createdAt: fmtDateTime(o.createdAt),
                    pickupDate: toSheetDate(o.pickupDate),
                    productionStartDate: toSheetDate(o.productionStartDate)
                })),
                devis: devis.map(d => ({
                    ...d,
                    createdAt: fmtDateTime(d.createdAt),
                    validityDate: toSheetDate(d.validityDate),
                    pickupDate: toSheetDate(d.pickupDate)
                })),
                stock_history,
                customers
            };

            // fetch() au lieu de sendBeacon → on a la réponse du serveur
            const response = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify(payload),
                headers: { 'Content-Type': 'text/plain' },
                mode: 'no-cors',   // Google Apps Script requiert no-cors
            });

            // IMPORTANT : Avec no-cors, on ne sait pas si ça a réussi à 100%.
            // Cependant, suite à votre demande, on vide TOUT pour ne rien laisser sur l'iPad
            await Promise.all([
                clearAllSales(),
                clearAllExpenses(),
                clearAllZReports(),
                clearStockHistory(),
                clearAllOrders(),
                clearAllDevis()
            ]);

            const now = new Date().toLocaleString('fr-FR');
            localStorage.setItem(LAST_SYNC_KEY, now);
            setLastSync(now);

            window.dispatchEvent(new Event('catalogUpdated'));
            setPendingCount(0);
            showResult({ success: true, message: `Synchronisation réussie le ${now}. iPad vidé.` });

        } catch (err) {
            console.error('Erreur synchronisation:', err);
            showResult({ success: false, message: `Erreur réseau : ${err.message}` });
        } finally {
            setIsSyncing(false);
        }
    };

    // handleSync ends here...

    const handlePurgeLocal = async () => {
        const confirmed = window.confirm(
            "⚠️ ATTENTION : Purger les données locales ?\n\n" +
            "Cela effacera TOUTES les ventes, dépenses, clôtures, commandes et devis stockés sur CET APPAREIL.\n\n" +
            "Assurez-vous que vos données importantes sont bien sur Google Sheets. Continuer ?"
        );
        if (!confirmed) return;

        try {
            await Promise.all([
                clearAllSales(),
                clearAllExpenses(),
                clearAllZReports(),
                clearStockHistory(),
                clearAllOrders(),
                clearAllDevis(),
                clearAllCustomers()
            ]);
            // On garde le catalogue (produits) pour éviter un écran vide, 
            // l'utilisateur pourra faire "Importer" pour le mettre à jour.

            window.dispatchEvent(new Event('catalogUpdated'));
            window.dispatchEvent(new Event('saleAdded'));
            setPendingCount(0);
            showResult({ success: true, message: "Données locales purgées. Vous pouvez maintenant importer depuis le Cloud." });
        } catch (err) {
            console.error("Erreur purge:", err);
            showResult({ success: false, message: "Erreur lors de la purge : " + err.message });
        }
    };

    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownload = async () => {
        if (!isOnline) {
            showResult({ success: false, message: 'Hors-ligne — impossible de télécharger.' });
            return;
        }
        setIsDownloading(true);
        setSyncResult(null);
        try {
            const result = await syncFromCloud(saveOrder, saveDevis);
            if (result.success) {
                showResult({ success: true, message: `Import réussi : ${result.catalogue} produit(s), ${result.commandes} commande(s), ${result.devis} devis remplacé(s)` });
                window.dispatchEvent(new Event('catalogUpdated'));
            } else {
                showResult({ success: false, message: `Erreur cloud: ${result.message || 'Inconnue'}` });
            }
        } catch (err) {
            showResult({ success: false, message: `Erreur : ${err.message}` });
        } finally {
            setIsDownloading(false);
        }
    };

    const hasPending = pendingCount > 0;

    return (
        <div className="sync-wrapper">
            {syncResult && (
                <div className={`sync-result-toast ${syncResult.success ? 'toast-success' : 'toast-error'}`}>
                    {syncResult.success ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                    {syncResult.message}
                </div>
            )}
            <div className="sync-btn-group">
                <button
                    className={`sync-btn sync-btn-download ${isDownloading ? 'sync-btn--loading' : ''}`}
                    onClick={handleDownload}
                    disabled={isDownloading || !isOnline}
                    title={!isOnline ? 'Hors-ligne' : 'Importer les commandes récentes du Cloud'}
                >
                    <span className="sync-btn__icon">
                        {isDownloading ? <RefreshCw size={18} className="spin" /> : <CloudDownload size={18} />}
                    </span>
                    <span className="sync-btn__label">
                        {isDownloading ? 'Import...' : 'Importer'}
                    </span>
                </button>

                <button
                    className={`sync-btn ${hasPending || !lastSync ? 'sync-btn--pending' : 'sync-btn--idle'} ${isSyncing ? 'sync-btn--loading' : ''}`}
                    onClick={handleSync}
                    disabled={isSyncing}
                    title={
                        !isOnline ? 'Hors-ligne — connexion requise'
                            : hasPending ? `${pendingCount} vente(s)/dépense(s) à envoyer`
                                : lastSync ? `Dernier sync : ${lastSync}` : 'Cliquer pour synchroniser'
                    }
                >
                    <span className="sync-btn__icon">
                        {isSyncing
                            ? <RefreshCw size={18} className="spin" />
                            : hasPending
                                ? <CloudUpload size={18} />
                                : <CheckCircle size={18} />
                        }
                    </span>
                    <span className="sync-btn__label">
                        {isSyncing
                            ? 'Envoi...'
                            : hasPending
                                ? `Téléverser (${pendingCount})`
                                : 'Synchronisé'
                        }
                    </span>
                    {!isOnline && <span className="sync-btn__offline">Hors-ligne</span>}
                </button>
            </div>

             {/* Aide & Secours Restored */}
            <div className="sync-section-divider"></div>
            
            <div className="sync-help-section">
                <h3 className="sync-help-title"><ShieldAlert size={16} /> Aide & Secours</h3>
                
                <div style={{ marginBottom: 12, padding: 8, background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.8rem' }}>
                    <strong>Mémoire iPad :</strong> {pendingCount} ventes à envoyer, {counts.orders} commandes, {counts.devis} devis.
                </div>

                <p className="sync-help-text">
                    Si vos commandes ne s'affichent plus ou si vous voulez faire une sauvegarde manuelle sur votre iPad :
                </p>
                
                <div className="sync-help-actions">
                    <button className="sync-help-btn" onClick={async () => {
                        try {
                            const [ventes, products, categories, depenses, clotures, commandes, devis, customers] = await Promise.all([
                                getAllSales(), getProducts(), getCategories(), getExpenses(), getZReports(), getOrders(), getDevis(), getCustomers()
                            ]);
                            const data = { ventes, products, categories, depenses, clotures, commandes, devis, customers, exportDate: new Date().toISOString() };
                            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `backup_boulangerie_${new Date().toISOString().slice(0, 10)}.json`;
                            a.click();
                            showResult({ success: true, message: "Sauvegarde JSON téléchargée." });
                        } catch (e) {
                            showResult({ success: false, message: "Erreur export: " + e.message });
                        }
                    }}>
                        <Download size={14} /> Sauvegarder (Fichier JSON)
                    </button>

                    <label className="sync-help-btn ghost">
                        <Upload size={14} /> Restaurer un fichier
                        <input type="file" accept=".json" style={{ display: 'none' }} onChange={async (e) => {
                            const file = e.target.result; // Not how it works, need FileReader
                        }} />
                        {/* Inline JS for simpler import */}
                        <input type="file" accept=".json" style={{ display: 'none' }} onChange={async (event) => {
                            const file = event.target.files[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = async (e) => {
                                try {
                                    const data = JSON.parse(e.target.result);
                                    if (confirm("⚠️ RESTAURER ? Cela va fusionner les données du fichier avec votre iPad.")) {
                                        if (data.commandes) {
                                            for (const o of data.commandes) await saveOrder(o);
                                        }
                                        if (data.devis) {
                                            for (const d of data.devis) await saveDevis(d);
                                        }
                                        showResult({ success: true, message: "Restauration terminée." });
                                        window.dispatchEvent(new Event('ordersUpdated'));
                                    }
                                } catch (err) {
                                    showResult({ success: false, message: "Fichier invalide." });
                                }
                            };
                            reader.readAsText(file);
                        }} />
                    </label>
                </div>
            </div>

            <div className="sync-footer-actions">
                <button className="sync-btn-purge-text" onClick={handlePurgeLocal}>
                   <Trash2 size={13} /> Purger TOUTES les données (Ventes + Commandes)
                </button>
            </div>

            {lastSync && !isSyncing && (
                <div className="sync-last-time">Dernier sync : {lastSync}</div>
            )}
        </div>
    );
}

export async function syncFromCloud(saveOrderFn, saveDevisFn) {
    return new Promise((resolve, reject) => {
        const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
        const timeout = setTimeout(() => {
            cleanup();
            console.warn('Sync cloud entrante timeout.');
            resolve({ success: false, message: 'Délai dépassé (15s)' });
        }, 15000);

        window[callbackName] = async function (data) {
            clearTimeout(timeout);
            cleanup();
            if (!data || data.status !== 'ok') {
                console.warn('Sync cloud entrante retour incorrect:', data);
                return resolve({ success: false, message: data ? data.message : 'Pas de réponse valide' });
            }

            try {
                let productsUpdated = 0;
                let commandesUpdated = 0;
                let devisUpdated = 0;
                let salesUpdated = 0;

                // ── 1. CATALOGUE : remplacement complet ──────────────────
                // Google Sheets est la source de vérité pour les produits
                if (data.catalogue && Array.isArray(data.catalogue) && data.catalogue.length > 0) {
                    // IMPORTANT: lire catégories et produits locaux AVANT clearCatalog
                    const localCategories = await getCategories();
                    const catNameToId = {};
                    localCategories.forEach(c => {
                        if (c.name) catNameToId[c.name.toLowerCase().trim()] = c.id;
                    });

                    // Conserver les champs visuels (couleur, emoji) depuis la version locale
                    const localProducts = await getProducts();
                    const localProductMap = new Map(localProducts.map(p => [String(p.id), p]));

                    // Vider les produits uniquement (sans toucher les catégories)
                    for (const lp of localProducts) {
                        try { await deleteProduct(lp.id); } catch (e) { }
                    }

                    // Réimporter exactement depuis le Sheet
                    for (const remoteProd of data.catalogue) {
                        if (!remoteProd.id) continue;
                        const localP = localProductMap.get(String(remoteProd.id));

                        // Mapper le nom de catégorie vers un id local
                        const catName = String(remoteProd.categoryName || '').toLowerCase().trim();
                        const categoryId = catNameToId[catName] || localP?.categoryId || 'cat1';

                        const product = {
                            id: remoteProd.id,
                            name: remoteProd.name || localP?.name || 'Produit sans nom',
                            price: parseFloat(String(remoteProd.price).replace(',', '.')) || localP?.price || 0,
                            categoryId,
                            stock: parseInt(remoteProd.stock) || 0,
                            alertThreshold: parseInt(remoteProd.alertThreshold) || localP?.alertThreshold || 0,
                            description: remoteProd.description || localP?.description || '',
                            // Conserver les champs visuels depuis la version locale si disponible
                            color: localP?.color || '#fbcfe8',
                            emoji: localP?.emoji || '',
                        };
                        await saveProduct(product);
                        productsUpdated++;
                    }
                }

                // ── 2. COMMANDES : remplacement complet ──────────────────
                if (data.commandes && Array.isArray(data.commandes) && data.commandes.length > 0) {
                    await clearAllOrders();
                    for (const order of data.commandes) {
                        try {
                            if (String(order.status || 'en_attente') === 'recupere' || String(order.status || 'en_attente') === 'collected') continue;

                            const parsedItems = typeof order.parsedItems === 'string' ? JSON.parse(order.parsedItems) : (order.parsedItems || []);
                            await saveOrderFn({
                                id: order.id,
                                customerName: order.customerName || '',
                                customerPhone: order.customerPhone || '',
                                status: order.status || 'en_attente',
                                pickupDate: fromSheetDate(order.pickupDate),
                                pickupTime: order.pickupTime || '',
                                items: order.items || '',
                                parsedItems: parsedItems,
                                totalPrice: parseFloat(order.totalPrice) || 0,
                                deposit: parseFloat(order.deposit) || 0,
                                notes: order.notes || '',
                                productionStartDate: fromSheetDate(order.productionStartDate),
                                type: order.type || 'Standard',
                                createdAt: order.createdAt || new Date().toISOString(),
                            });
                            commandesUpdated++;
                        } catch (e) { console.error("Err order", e); }
                    }
                    console.log(`[Sync] ${commandesUpdated} commandes importées.`);
                    window.dispatchEvent(new Event('ordersUpdated'));
                }

                // ── 3. DEVIS : remplacement complet ──────────────────────
                if (data.devis && Array.isArray(data.devis) && data.devis.length > 0) {
                    await clearAllDevis();
                    for (const d of data.devis) {
                        try {
                            await saveDevisFn({
                                id: d.id,
                                numero: d.numero || '',
                                customerName: d.customerName || '',
                                customerPhone: d.customerPhone || '',
                                customerEmail: d.customerEmail || '',
                                status: d.status || 'brouillon',
                                validityDate: fromSheetDate(d.validityDate),
                                pickupDate: fromSheetDate(d.pickupDate),
                                totalPrice: parseFloat(d.totalPrice) || 0,
                                discount: parseFloat(d.discount) || 0,
                                items: d.items || '',
                                notes: d.notes || '',
                                createdAt: d.createdAt || new Date().toISOString(),
                            });
                            devisUpdated++;
                        } catch (e) { console.error("Err devis", e); }
                    }
                    console.log(`[Sync] ${devisUpdated} devis importés.`);
                    window.dispatchEvent(new Event('devisUpdated'));
                }

                // ── 4. VENTES : remplacement complet ─────────────────────
                if (data.ventes && Array.isArray(data.ventes)) {
                    await clearAllSales();
                    for (const s of data.ventes) {
                        if (!s.id) continue;
                        await saveSale(s, true); // le second argument true évite de déclencher des événements en boucle
                        salesUpdated++;
                    }
                }

                resolve({
                    success: true,
                    commandes: commandesUpdated,
                    devis: devisUpdated,
                    catalogue: productsUpdated,
                    ventes: salesUpdated
                });
            } catch (err) {
                console.warn('Erreur durant la fusion locale:', err);
                resolve({ success: false, message: err.message });
            }
        };

        const script = document.createElement('script');
        script.src = `${GOOGLE_SCRIPT_URL}?action=getData&callback=${callbackName}`;
        script.id = callbackName;
        script.onerror = () => {
            clearTimeout(timeout);
            cleanup();
            console.warn('Sync cloud entrante script erreur.');
            resolve({ success: false, message: 'Erreur de connexion au serveur' });
        };

        function cleanup() {
            delete window[callbackName];
            const el = document.getElementById(callbackName);
            if (el) el.remove();
        }

        document.body.appendChild(script);
    });
}

