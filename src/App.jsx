import { useState, useEffect } from 'react';
import './App.css';
import './AppNav.css';
import { Store, Wifi, WifiOff, LayoutGrid, Package, BarChart3, Calculator, Users, ClipboardList } from 'lucide-react';
import ProductGrid from './components/pos/ProductGrid';
import Cart from './components/pos/Cart';
import SyncManager from './components/sync/SyncManager';
import ProductManager from './components/admin/ProductManager';
import Dashboard from './components/stats/Dashboard';
import ZReport from './components/stats/ZReport';
import Customers from './components/customers/Customers';
import Orders from './components/orders/Orders';
import { saveSale } from './db/indexedDB';
import { seedDatabaseIfEmpty } from './db/initData';

function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [cartItems, setCartItems] = useState([]);
  const [currentView, setCurrentView] = useState('pos'); // pos, admin, stats, zreport
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Seed DB before rendering POS
    const initApp = async () => {
      await seedDatabaseIfEmpty();
      setIsReady(true);
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

  if (!isReady) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Chargement de la base de données...</div>;

  return (
    <div className="app-container">
      <main className="pos-main">
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

          <button className={`nav-item ${currentView === 'zreport' ? 'active' : ''}`} onClick={() => setCurrentView('zreport')}>
            <Calculator size={18} /> Clôture
          </button>
        </nav>

        <div className="pos-content">
          {currentView === 'pos' && <ProductGrid onAddToCart={addToCart} />}
          {currentView === 'admin' && <ProductManager />}
          {currentView === 'stats' && <Dashboard />}
          {currentView === 'zreport' && <ZReport />}
          {currentView === 'orders' && <Orders />}
          {currentView === 'customers' && <Customers />}
        </div>
      </main>

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
  );
}

export default App;
