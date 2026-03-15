import { useState, useEffect } from 'react';
import './App.css';
import './AppNav.css';
import { Store, Wifi, WifiOff, LayoutGrid, Package, BarChart3, Calculator, Users, ClipboardList, FileText, CalendarClock, History } from 'lucide-react';
import ProductGrid from './components/pos/ProductGrid';
import Cart from './components/pos/Cart';
import SyncManager, { syncFromCloud } from './components/sync/SyncManager';
import ProductManager from './components/admin/ProductManager';
import Dashboard from './components/stats/Dashboard';
import ZReport from './components/stats/ZReport';
import Customers from './components/customers/Customers';
import Orders from './components/orders/Orders';
import Devis from './components/devis/Devis';
import Production from './components/planning/Planning';
import SalesHistory from './components/stats/SalesHistory';
import { saveSale, saveOrder, saveDevis } from './db/indexedDB';
import { seedDatabaseIfEmpty } from './db/initData';

function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [cartItems, setCartItems] = useState([]);
  const [currentView, setCurrentView] = useState('pos'); // pos, admin, stats, zreport
  const [isReady, setIsReady] = useState(false);
  const [renderError, setRenderError] = useState(null);
  const [syncToast, setSyncToast] = useState(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Seed DB before rendering POS and try cloud sync
    const initApp = async () => {
      await seedDatabaseIfEmpty();
      setIsReady(true);

      if (navigator.onLine) {
        console.log('Online at startup, attempting inbound sync...');
        const result = await syncFromCloud(saveOrder, saveDevis);
        if (result && result.success) {
          const total = (result.catalogue || 0) + (result.commandes || 0) + (result.devis || 0) + (result.ventes || 0);
          if (total > 0) {
            setSyncToast(`Cloud check: +${result.ventes || 0} ventes, +${result.commandes || 0} commandes`);
            setTimeout(() => setSyncToast(null), 5000);
            window.dispatchEvent(new Event('catalogUpdated')); // refresh POS
            window.dispatchEvent(new Event('saleAdded'));       // refresh Stats
          }
        }
      }
    };
    initApp();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const addToCart = (product) => {
    setCartItems(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId, delta) => {
    setCartItems(prev => prev.map(item => {
      if (item.id === productId) {
        const newQuantity = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQuantity };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const clearCart = () => setCartItems([]);

  const handleCheckout = async (paymentDetails) => {
    if (cartItems.length === 0) return;

    const saleData = {
      items: cartItems,
      ...paymentDetails, // contains subtotal, discount, tax, total, amountGiven, change
      itemsCount: cartItems.reduce((sum, item) => sum + item.quantity, 0)
    };

    try {
      await saveSale(saleData);
      clearCart();
      window.dispatchEvent(new Event('saleAdded'));
      // Force POS to refresh stock
      window.dispatchEvent(new Event('catalogUpdated'));
      console.log('Vente enregistrée en local !', saleData);
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement', error);
      alert('Erreur lors de l\'enregistrement de la vente.');
    }
  };

  if (renderError) {
    return (
      <div style={{ padding: 20, color: 'red', background: '#fff' }}>
        <h2>Un erreur est survenue au démarrage.</h2>
        <pre>{renderError}</pre>
        <button onClick={() => window.location.reload()}>Recharger</button>
      </div>
    );
  }

  if (!isReady) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Chargement de la base de données...</div>;

  try {
    return (
    <div className="app-container">
      {/* INBOUND SYNC TOAST */}
      {syncToast && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          background: '#10b981', color: 'white', padding: '10px 20px',
          borderRadius: 30, fontSize: '0.9rem', fontWeight: 600,
          boxShadow: '0 4px 12px rgba(16,185,129,0.3)', zIndex: 9999,
          animation: 'fadeIn 0.3s ease'
        }}>
          ☁️ {syncToast}
        </div>
      )}

      {/* Global header */}
      <header className="pos-header">
        <div className="brand">
          <Store color="var(--color-primary)" size={28} />
          <h1>Les délices de Laura</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className={`status-badge ${isOnline ? 'online' : 'offline'}`}>
            <div className="status-badge-dot"></div>
            {isOnline ? (
              <><Wifi size={16} /> En ligne</>
            ) : (
              <><WifiOff size={16} /> Hors ligne (Local)</>
            )}
          </div>
          <SyncManager isOnline={isOnline} />
        </div>
      </header>

      {/* Navigation Bar */}
      <nav className="app-nav">
        <button className={`nav-item ${currentView === 'pos' ? 'active' : ''}`} onClick={() => setCurrentView('pos')}>
          <LayoutGrid size={18} /> Caisse
        </button>
        <button className={`nav-item ${currentView === 'admin' ? 'active' : ''}`} onClick={() => setCurrentView('admin')}>
          <Package size={18} /> Catalogue
        </button>
        <button className={`nav-item ${currentView === 'stats' ? 'active' : ''}`} onClick={() => setCurrentView('stats')}>
          <BarChart3 size={18} /> Stats
        </button>
        <button className={`nav-item ${currentView === 'orders' ? 'active' : ''}`} onClick={() => setCurrentView('orders')}>
          <ClipboardList size={18} /> Commandes
        </button>
        <button className={`nav-item ${currentView === 'production' ? 'active' : ''}`} onClick={() => setCurrentView('production')}>
          <CalendarClock size={18} /> Production
        </button>
        <button className={`nav-item ${currentView === 'devis' ? 'active' : ''}`} onClick={() => setCurrentView('devis')}>
          <FileText size={18} /> Devis
        </button>
        <button className={`nav-item ${currentView === 'zreport' ? 'active' : ''}`} onClick={() => setCurrentView('zreport')}>
          <Calculator size={18} /> Clôture
        </button>
        <button className={`nav-item ${currentView === 'history' ? 'active' : ''}`} onClick={() => setCurrentView('history')}>
          <History size={18} /> Historique
        </button>
      </nav>

      {/* Content + optional cart sidebar */}
      <div className="pos-view">
        <div className="pos-content">
          {currentView === 'pos' && <ProductGrid onAddToCart={addToCart} />}
          {currentView === 'admin' && <ProductManager />}
          {currentView === 'stats' && <Dashboard />}
          {currentView === 'zreport' && <ZReport />}
          {currentView === 'orders' && <Orders />}
          {currentView === 'production' && <Production />}
          {currentView === 'devis' && <Devis />}
          {currentView === 'customers' && <Customers />}
          {currentView === 'history' && <SalesHistory />}
        </div>

        {currentView === 'pos' && (
          <aside className="pos-sidebar">
            <Cart
              items={cartItems}
              updateQuantity={updateQuantity}
              clearCart={clearCart}
              onCheckout={handleCheckout}
            />
          </aside>
        )}
      </div>
    </div>
    );
  } catch (e) {
    console.error("Render crash:", e);
    // Use a ref or a side effect to set the error to avoid infinite loop of renders if it happens during render
    // But since this is a try/catch in the body, we can return a fallback directly.
    return (
      <div style={{ padding: 20, color: 'red', background: '#fff' }}>
        <h2>Un erreur est survenue lors de l'affichage.</h2>
        <pre>{e.message}</pre>
        <pre>{e.stack}</pre>
        <button onClick={() => window.location.reload()}>Recharger</button>
      </div>
    );
  }
}

export default App;
