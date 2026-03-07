// Simple wrapper for IndexedDB to store sales, products, and categories offline

const DB_NAME = 'BakeryPOS_DB';
const DB_VERSION = 6; // v6: productionStartDate index on orders
const STORE_SALES = 'sales';
const STORE_PRODUCTS = 'products';
const STORE_CATEGORIES = 'categories';
const STORE_EXPENSES = 'expenses';
const STORE_Z_REPORTS = 'z_reports';
const STORE_CUSTOMERS = 'customers';
const STORE_ORDERS = 'orders';
const STORE_DEVIS = 'devis';

let db = null;

export const initDB = () => {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error('IndexedDB error:', event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = event.target.result;

            // Sales store
            if (!database.objectStoreNames.contains(STORE_SALES)) {
                const salesStore = database.createObjectStore(STORE_SALES, { keyPath: 'id', autoIncrement: true });
                salesStore.createIndex('synced', 'synced', { unique: false });
                salesStore.createIndex('timestamp', 'timestamp', { unique: false });
            }

            // Products store
            if (!database.objectStoreNames.contains(STORE_PRODUCTS)) {
                const productStore = database.createObjectStore(STORE_PRODUCTS, { keyPath: 'id' });
                productStore.createIndex('categoryId', 'categoryId', { unique: false });
            }

            // Categories store
            if (!database.objectStoreNames.contains(STORE_CATEGORIES)) {
                database.createObjectStore(STORE_CATEGORIES, { keyPath: 'id' });
            }

            // Expenses store
            if (!database.objectStoreNames.contains(STORE_EXPENSES)) {
                const expenseStore = database.createObjectStore(STORE_EXPENSES, { keyPath: 'id', autoIncrement: true });
                expenseStore.createIndex('timestamp', 'timestamp', { unique: false });
            }

            // Z Reports store
            if (!database.objectStoreNames.contains(STORE_Z_REPORTS)) {
                const zStore = database.createObjectStore(STORE_Z_REPORTS, { keyPath: 'id', autoIncrement: true });
                zStore.createIndex('date', 'date', { unique: false });
            }

            // Customers store
            if (!database.objectStoreNames.contains(STORE_CUSTOMERS)) {
                const custStore = database.createObjectStore(STORE_CUSTOMERS, { keyPath: 'id', autoIncrement: true });
                custStore.createIndex('name', 'name', { unique: false });
            }

            // Orders store
            if (!database.objectStoreNames.contains(STORE_ORDERS)) {
                const orderStore = database.createObjectStore(STORE_ORDERS, { keyPath: 'id', autoIncrement: true });
                orderStore.createIndex('status', 'status', { unique: false });
                orderStore.createIndex('pickupDate', 'pickupDate', { unique: false });
                orderStore.createIndex('productionStartDate', 'productionStartDate', { unique: false });
            } else {
                // Upgrade v5 → v6: add productionStartDate index if missing
                const tx = event.target.transaction;
                const orderStore = tx.objectStore(STORE_ORDERS);
                if (!orderStore.indexNames.contains('productionStartDate')) {
                    orderStore.createIndex('productionStartDate', 'productionStartDate', { unique: false });
                }
            }

            // Devis store
            if (!database.objectStoreNames.contains(STORE_DEVIS)) {
                const devisStore = database.createObjectStore(STORE_DEVIS, { keyPath: 'id', autoIncrement: true });
                devisStore.createIndex('status', 'status', { unique: false });
                devisStore.createIndex('createdAt', 'createdAt', { unique: false });
                devisStore.createIndex('numero', 'numero', { unique: false });
            }
        };
    });
};

// --- SALES ---

export const saveSale = async (saleData) => {
    await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_SALES, STORE_PRODUCTS], 'readwrite');
        const salesStore = transaction.objectStore(STORE_SALES);
        const productsStore = transaction.objectStore(STORE_PRODUCTS);

        const sale = {
            ...saleData,
            timestamp: new Date().toISOString(),
            synced: false,
        };

        const request = salesStore.add(sale);

        // Update stock for each item sold
        saleData.items.forEach(item => {
            if (item.stock !== undefined && item.stock !== null) {
                const getReq = productsStore.get(item.id);
                getReq.onsuccess = (e) => {
                    const product = e.target.result;
                    if (product && product.stock !== undefined) {
                        product.stock = Math.max(0, product.stock - item.quantity);
                        productsStore.put(product);
                    }
                };
            }
        });

        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
};

export const getUnsyncedSales = async () => {
    await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_SALES], 'readonly');
        const store = transaction.objectStore(STORE_SALES);
        const index = store.index('synced');
        const request = index.getAll(IDBKeyRange.only(false));

        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
};

export const getAllSales = async () => {
    await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_SALES], 'readonly');
        const store = transaction.objectStore(STORE_SALES);
        const request = store.getAll();

        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

export const markSalesAsSynced = async (saleIds) => {
    await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_SALES], 'readwrite');
        const store = transaction.objectStore(STORE_SALES);

        transaction.oncomplete = () => resolve(true);
        transaction.onerror = (event) => reject(event.target.error);

        saleIds.forEach(id => {
            const getReq = store.get(id);
            getReq.onsuccess = (event) => {
                const sale = event.target.result;
                if (sale) {
                    sale.synced = true;
                    store.put(sale);
                }
            };
        });
    });
};

// --- CATALOG DATA (PRODUCTS & CATEGORIES) ---

export const getCategories = async () => {
    await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_CATEGORIES], 'readonly');
        const request = transaction.objectStore(STORE_CATEGORIES).getAll();
        request.onsuccess = e => resolve(e.target.result);
        request.onerror = e => reject(e.target.error);
    });
};

export const saveCategory = async (category) => {
    await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_CATEGORIES], 'readwrite');
        const request = transaction.objectStore(STORE_CATEGORIES).put(category);
        request.onsuccess = e => resolve(e.target.result);
        request.onerror = e => reject(e.target.error);
    });
};

export const getProducts = async () => {
    await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_PRODUCTS], 'readonly');
        const request = transaction.objectStore(STORE_PRODUCTS).getAll();
        request.onsuccess = e => resolve(e.target.result);
        request.onerror = e => reject(e.target.error);
    });
};

export const saveProduct = async (product) => {
    await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_PRODUCTS], 'readwrite');
        const request = transaction.objectStore(STORE_PRODUCTS).put(product);
        request.onsuccess = e => resolve(e.target.result);
        request.onerror = e => reject(e.target.error);
    });
};

export const deleteProduct = async (id) => {
    await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_PRODUCTS], 'readwrite');
        const request = transaction.objectStore(STORE_PRODUCTS).delete(id);
        request.onsuccess = e => resolve(e.target.result);
        request.onerror = e => reject(e.target.error);
    });
};

export const clearCatalog = async () => {
    await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_PRODUCTS, STORE_CATEGORIES], 'readwrite');

        const req1 = transaction.objectStore(STORE_PRODUCTS).clear();
        const req2 = transaction.objectStore(STORE_CATEGORIES).clear();

        transaction.oncomplete = () => resolve(true);
        transaction.onerror = e => reject(e.target.error);
    });
};

// --- EXPENSES (Petite Caisse) ---

export const getExpenses = async () => {
    await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_EXPENSES], 'readonly');
        const request = transaction.objectStore(STORE_EXPENSES).getAll();
        request.onsuccess = e => resolve(e.target.result);
        request.onerror = e => reject(e.target.error);
    });
};

export const saveExpense = async (expenseData) => {
    await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_EXPENSES], 'readwrite');
        const expense = {
            ...expenseData,
            timestamp: new Date().toISOString()
        };
        const request = transaction.objectStore(STORE_EXPENSES).add(expense);
        request.onsuccess = e => resolve(e.target.result);
        request.onerror = e => reject(e.target.error);
    });
};

export const deleteExpense = async (id) => {
    await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_EXPENSES], 'readwrite');
        const request = transaction.objectStore(STORE_EXPENSES).delete(id);
        request.onsuccess = e => resolve(e.target.result);
        request.onerror = e => reject(e.target.error);
    });
};

// --- Z REPORTS (Clôture) ---

export const getZReports = async () => {
    await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_Z_REPORTS], 'readonly');
        const request = transaction.objectStore(STORE_Z_REPORTS).getAll();
        request.onsuccess = e => resolve(e.target.result);
        request.onerror = e => reject(e.target.error);
    });
};

export const saveZReport = async (reportData) => {
    await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_Z_REPORTS], 'readwrite');
        const request = transaction.objectStore(STORE_Z_REPORTS).add({
            ...reportData,
            timestamp: new Date().toISOString(),
            date: new Date().toLocaleDateString()
        });
        request.onsuccess = e => resolve(e.target.result);
        request.onerror = e => reject(e.target.error);
    });
};

// --- CUSTOMERS (Fidélité) ---

export const getCustomers = async () => {
    await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_CUSTOMERS], 'readonly');
        const request = transaction.objectStore(STORE_CUSTOMERS).getAll();
        request.onsuccess = e => resolve(e.target.result);
        request.onerror = e => reject(e.target.error);
    });
};

export const saveCustomer = async (customerData) => {
    await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_CUSTOMERS], 'readwrite');
        const store = transaction.objectStore(STORE_CUSTOMERS);
        const request = customerData.id ? store.put(customerData) : store.add({ ...customerData, visits: 0, createdAt: new Date().toISOString() });
        request.onsuccess = e => resolve(e.target.result);
        request.onerror = e => reject(e.target.error);
    });
};

export const deleteCustomer = async (id) => {
    await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_CUSTOMERS], 'readwrite');
        const request = transaction.objectStore(STORE_CUSTOMERS).delete(id);
        request.onsuccess = e => resolve(e.target.result);
        request.onerror = e => reject(e.target.error);
    });
};

// --- ORDERS (Pré-commandes) ---

export const getOrders = async () => {
    await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_ORDERS], 'readonly');
        const request = transaction.objectStore(STORE_ORDERS).getAll();
        request.onsuccess = e => resolve(e.target.result);
        request.onerror = e => reject(e.target.error);
    });
};

export const saveOrder = async (orderData) => {
    await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_ORDERS, STORE_PRODUCTS], 'readwrite');
        const store = transaction.objectStore(STORE_ORDERS);
        const productsStore = transaction.objectStore(STORE_PRODUCTS);

        const isNew = !orderData.id;
        const request = isNew
            ? store.add({ ...orderData, createdAt: new Date().toISOString(), status: orderData.status || 'pending' })
            : store.put(orderData);

        if (isNew && orderData.type !== 'reassort' && orderData.parsedItems) {
            orderData.parsedItems.forEach(item => {
                const getReq = productsStore.get(item.id);
                getReq.onsuccess = (e) => {
                    const product = e.target.result;
                    if (product && product.stock !== undefined) {
                        product.stock = Math.max(0, product.stock - item.qty);
                        productsStore.put(product);
                    }
                };
            });
        }

        request.onsuccess = e => resolve(e.target.result);
        request.onerror = e => reject(e.target.error);
    });
};

export const deleteOrder = async (id) => {
    await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_ORDERS], 'readwrite');
        const request = transaction.objectStore(STORE_ORDERS).delete(id);
        request.onsuccess = e => resolve(e.target.result);
        request.onerror = e => reject(e.target.error);
    });
};

// --- CLEAR ALL (vidage après synchro Google Sheets) ---
// Note: le catalogue (products + categories) est conservé intentionnellement

export const clearAllSales = async () => {
    await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_SALES], 'readwrite');
        const request = transaction.objectStore(STORE_SALES).clear();
        request.onsuccess = () => resolve(true);
        request.onerror = e => reject(e.target.error);
    });
};

export const clearAllExpenses = async () => {
    await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_EXPENSES], 'readwrite');
        const request = transaction.objectStore(STORE_EXPENSES).clear();
        request.onsuccess = () => resolve(true);
        request.onerror = e => reject(e.target.error);
    });
};

export const clearAllZReports = async () => {
    await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_Z_REPORTS], 'readwrite');
        const request = transaction.objectStore(STORE_Z_REPORTS).clear();
        request.onsuccess = () => resolve(true);
        request.onerror = e => reject(e.target.error);
    });
};

export const clearAllOrders = async () => {
    await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_ORDERS], 'readwrite');
        const request = transaction.objectStore(STORE_ORDERS).clear();
        request.onsuccess = () => resolve(true);
        request.onerror = e => reject(e.target.error);
    });
};

// --- DEVIS (Gestion des devis) ---

export const getDevis = async () => {
    await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_DEVIS], 'readonly');
        const request = transaction.objectStore(STORE_DEVIS).getAll();
        request.onsuccess = e => resolve(e.target.result);
        request.onerror = e => reject(e.target.error);
    });
};

export const saveDevis = async (devisData) => {
    await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_DEVIS], 'readwrite');
        const store = transaction.objectStore(STORE_DEVIS);
        let record;
        if (devisData.id) {
            record = { ...devisData };
        } else {
            // Generate numero on first save
            const year = new Date().getFullYear();
            record = {
                ...devisData,
                createdAt: new Date().toISOString(),
                status: devisData.status || 'brouillon',
                year,
            };
        }
        const request = devisData.id ? store.put(record) : store.add(record);
        request.onsuccess = e => resolve(e.target.result);
        request.onerror = e => reject(e.target.error);
    });
};

export const deleteDevis = async (id) => {
    await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_DEVIS], 'readwrite');
        const request = transaction.objectStore(STORE_DEVIS).delete(id);
        request.onsuccess = e => resolve(e.target.result);
        request.onerror = e => reject(e.target.error);
    });
};

export const clearAllDevis = async () => {
    await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_DEVIS], 'readwrite');
        const request = transaction.objectStore(STORE_DEVIS).clear();
        request.onsuccess = () => resolve(true);
        request.onerror = e => reject(e.target.error);
    });
};
