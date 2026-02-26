import { useState, useEffect } from 'react';
import { CloudUpload, RefreshCw } from 'lucide-react';
import { getUnsyncedSales, markSalesAsSynced } from '../../db/indexedDB';
import './SyncManager.css';

const GOOGLE_SCRIPT_URL = 'VOTRE_LIEN_GOOGLE_APP_SCRIPT_ICI';

export default function SyncManager({ isOnline }) {
    const [unsyncedCount, setUnsyncedCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);

    const checkUnsynced = async () => {
        try {
            const sales = await getUnsyncedSales();
            setUnsyncedCount(sales.length);
        } catch (err) {
            console.error('Failed to get unsynced sales', err);
        }
    };

    useEffect(() => {
        checkUnsynced();
        window.addEventListener('saleAdded', checkUnsynced);
        return () => window.removeEventListener('saleAdded', checkUnsynced);
    }, []);

    const handleSync = async () => {
        if (!isOnline) {
            alert("Vous êtes hors-ligne. Veuillez vous connecter à Internet.");
            return;
        }

        if (unsyncedCount === 0) return;

        setIsSyncing(true);
        try {
            const sales = await getUnsyncedSales();

            if (sales.length === 0) { setIsSyncing(false); return; }

            if (GOOGLE_SCRIPT_URL === 'VOTRE_LIEN_GOOGLE_APP_SCRIPT_ICI') {
                setTimeout(async () => {
                    console.log('Simulation: Ventes envoyées =', sales);
                    const ids = sales.map(s => s.id);
                    await markSalesAsSynced(ids);
                    setUnsyncedCount(0);
                    setIsSyncing(false);
                    alert('Succès ! (Mode Simulation) Les ventes ont été marquées comme synchronisées.');
                }, 1500);
                return;
            }

            // Vraie requête (décommentée dans le futur)
            /*
            const response = await fetch(GOOGLE_SCRIPT_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ sales })
            });
      
            if (!response.ok) throw new Error('Network response was not ok');
      
            const ids = sales.map(s => s.id);
            await markSalesAsSynced(ids);
            setUnsyncedCount(0);
            alert('Toutes les ventes ont été synchronisées vers Google Sheets !');
            */
        } catch (err) {
            console.error('Erreur de synchronisation:', err);
            alert("Une erreur s'est produite lors de la synchronisation.");
        } finally {
            if (GOOGLE_SCRIPT_URL !== 'VOTRE_LIEN_GOOGLE_APP_SCRIPT_ICI') {
                setIsSyncing(false);
            }
        }
    };

    if (unsyncedCount === 0) {
        return (
            <div className="sync-box success">
                <span className="sync-icon"><CloudUpload size={16} /></span>
                <span className="sync-text">À jour</span>
            </div>
        );
    }

    return (
        <button
            className={`sync-box warning ${isSyncing ? 'syncing' : ''}`}
            onClick={handleSync}
            disabled={isSyncing || !isOnline}
        >
            <span className="sync-icon">
                {isSyncing ? <RefreshCw size={16} className="spin" /> : <CloudUpload size={16} />}
            </span>
            <span className="sync-text">
                {unsyncedCount} {unsyncedCount > 1 ? 'ventes non envoyées' : 'vente non envoyée'}
            </span>
        </button>
    );
}
