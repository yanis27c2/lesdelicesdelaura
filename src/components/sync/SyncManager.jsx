import { useState, useEffect } from 'react';
import { CloudUpload, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import {
    getAllSales, getProducts, getCategories,
    getExpenses, getZReports, getOrders, getDevis,
    clearAllSales, clearAllExpenses, clearAllZReports, clearAllOrders, clearAllDevis
} from '../../db/indexedDB';
import './SyncManager.css';

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz9rk-6tmCsEN_QhbhBF25uRG5XKanS6vqcLBmcE1NVlEKSsEFCpVfDdY_3o6XmWrCK/exec';

export default function SyncManager({ isOnline }) {
    const [pendingCount, setPendingCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState(null); // { success, message }

    const countPending = async () => {
        try {
            const [sales, depenses, clotures, commandes, devis] = await Promise.all([
                getAllSales(),
                getExpenses(),
                getZReports(),
                getOrders(),
                getDevis()
            ]);
            setPendingCount(sales.length + depenses.length + clotures.length + commandes.length + devis.length);
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

    const handleSync = async () => {
        if (!isOnline) {
            alert('Vous êtes hors-ligne. Connectez-vous à Internet pour synchroniser.');
            return;
        }
        if (pendingCount === 0) {
            alert('Aucune donnée à téléverser.');
            return;
        }

        const confirmed = window.confirm(
            `Téléverser ${pendingCount} enregistrement(s) vers Google Sheets ?\n\n` +
            `⚠️ Après l'envoi réussi, les données locales seront supprimées de l'appareil pour libérer de l'espace.`
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
            const catalogue = products.map(p => ({
                ...p, categoryName: catMap[p.categoryId] || p.categoryId
            }));

            const payload = { ventes, catalogue, depenses, clotures, commandes, devis };

            const blob = new Blob([JSON.stringify(payload)], { type: 'text/plain' });

            // sendBeacon : conçu pour envoyer des données sans blocage CORS/SW
            // Retourne true si les données sont envoyées avec succès
            let sent = false;
            if (navigator.sendBeacon) {
                sent = navigator.sendBeacon(GOOGLE_SCRIPT_URL, blob);
            }

            // Fallback : XMLHttpRequest synchrone si sendBeacon non disponible
            if (!sent) {
                await new Promise((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', GOOGLE_SCRIPT_URL, true);
                    xhr.setRequestHeader('Content-Type', 'text/plain');
                    xhr.onload = resolve;
                    xhr.onerror = () => reject(new Error('Erreur réseau XHR'));
                    xhr.send(JSON.stringify(payload));
                });
            }

            // Succès : on vide les données locales
            await Promise.all([
                clearAllSales(), clearAllExpenses(),
                clearAllZReports(), clearAllOrders(), clearAllDevis()
            ]);
            window.dispatchEvent(new Event('catalogUpdated'));
            setPendingCount(0);
            setSyncResult({ success: true, message: 'Téléversement réussi ! Données locales supprimées.' });

        } catch (err) {
            console.error('Erreur synchronisation:', err);
            setSyncResult({ success: false, message: `Erreur : ${err.message}` });
        } finally {
            setIsSyncing(false);
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
            <button
                className={`sync-btn ${hasPending ? 'sync-btn--pending' : 'sync-btn--idle'} ${isSyncing ? 'sync-btn--loading' : ''}`}
                onClick={handleSync}
                disabled={isSyncing}
                title={!isOnline ? 'Hors-ligne — connexion requise' : hasPending ? `${pendingCount} enregistrement(s) à envoyer` : 'Tout est synchronisé'}
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
    );
}
