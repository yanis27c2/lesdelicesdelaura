import { useState, useEffect, useRef } from 'react';
import { CloudUpload, RefreshCw, CheckCircle, AlertCircle, CloudDownload } from 'lucide-react';
import {
    getAllSales, getProducts, getCategories,
    getExpenses, getZReports, getOrders, getDevis,
    clearAllSales, clearAllExpenses, clearAllZReports,
    saveOrder, saveDevis
} from '../../db/indexedDB';
import './SyncManager.css';

export const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz9rk-6tmCsEN_QhbhBF25uRG5XKanS6vqcLBmcE1NVlEKSsEFCpVfDdY_3o6XmWrCK/exec';

const LAST_SYNC_KEY = 'bakery_last_sync';

export default function SyncManager({ isOnline }) {
    const [pendingCount, setPendingCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState(null);
    const [lastSync, setLastSync] = useState(() => localStorage.getItem(LAST_SYNC_KEY));
    const resultTimer = useRef(null);

    const countPending = async () => {
        try {
            const [sales, depenses, clotures] = await Promise.all([
                getAllSales(), getExpenses(), getZReports()
            ]);
            // Commandes et devis ne sont PAS comptés comme "à supprimer" —
            // ils sont toujours envoyés mais restent en local.
            setPendingCount(sales.length + depenses.length + clotures.length);
        } catch (err) {
            console.error('Erreur comptage données', err);
        }
    };

    useEffect(() => {
        countPending();
        const refresh = () => countPending();
        window.addEventListener('saleAdded', refresh);
        window.addEventListener('catalogUpdated', refresh);
        return () => {
            window.removeEventListener('saleAdded', refresh);
            window.removeEventListener('catalogUpdated', refresh);
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
            `• Ventes, dépenses, clôtures → envoyées puis effacées localement\n` +
            `• Commandes et devis → copiés dans le Sheet, conservés en local`
        );
        if (!confirmed) return;

        setIsSyncing(true);
        setSyncResult(null);

        try {
            const [ventes, products, categories, depenses, clotures, commandes, devis] = await Promise.all([
                getAllSales(), getProducts(), getCategories(),
                getExpenses(), getZReports(), getOrders(), getDevis()
            ]);

            const catMap = {};
            categories.forEach(c => { catMap[c.id] = c.name; });
            const catalogue = products.map(p => ({ ...p, categoryName: catMap[p.categoryId] || p.categoryId }));

            const payload = { ventes, catalogue, depenses, clotures, commandes, devis };

            // fetch() au lieu de sendBeacon → on a la réponse du serveur
            const response = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify(payload),
                headers: { 'Content-Type': 'text/plain' },
                mode: 'no-cors',   // Google Apps Script requiert no-cors
            });

            // no-cors → réponse opaque, on ne peut pas lire le body
            // On considère que si pas d'erreur réseau = succès
            // Vider uniquement les données passées (ventes, dépenses, clôtures)
            await Promise.all([
                clearAllSales(),
                clearAllExpenses(),
                clearAllZReports(),
            ]);
            // Commandes et devis : ON NE SUPPRIME PAS — ils restent en local

            const now = new Date().toLocaleString('fr-FR');
            localStorage.setItem(LAST_SYNC_KEY, now);
            setLastSync(now);

            window.dispatchEvent(new Event('catalogUpdated'));
            setPendingCount(0);
            showResult({ success: true, message: `Téléversement réussi le ${now}.` });

        } catch (err) {
            console.error('Erreur synchronisation:', err);
            showResult({ success: false, message: `Erreur réseau : ${err.message}` });
        } finally {
            setIsSyncing(false);
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
                showResult({ success: true, message: `Cloud récupéré : +${result.commandes} commandes, +${result.devis} devis` });
                window.dispatchEvent(new Event('catalogUpdated'));
            } else {
                showResult({ success: false, message: 'Erreur lors de la récupération cloud.' });
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
            {lastSync && !isSyncing && (
                <div className="sync-last-time">Dernier sync : {lastSync}</div>
            )}
        </div>
    );
}

/* ── Fonction utilitaire exportée pour sync entrante depuis App.jsx ── */
export async function syncFromCloud(saveOrderFn, saveDevisFn) {
    try {
        const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=getData`, {
            method: 'GET',
            mode: 'cors',
        });
        if (!res.ok) return { success: false };
        const data = await res.json();

        // Merge commandes
        if (data.commandes && Array.isArray(data.commandes)) {
            const local = await getOrders();
            const localIds = new Set(local.map(o => String(o.id)));
            for (const order of data.commandes) {
                if (!localIds.has(String(order.id))) {
                    await saveOrderFn(order);
                }
            }
        }
        // Merge devis
        if (data.devis && Array.isArray(data.devis)) {
            const local = await getDevis();
            const localIds = new Set(local.map(d => String(d.id)));
            for (const d of data.devis) {
                if (!localIds.has(String(d.id))) {
                    await saveDevisFn(d);
                }
            }
        }
        return { success: true, commandes: data.commandes?.length || 0, devis: data.devis?.length || 0 };
    } catch (err) {
        console.warn('Sync cloud entrante échouée (probablement hors-ligne):', err.message);
        return { success: false };
    }
}
