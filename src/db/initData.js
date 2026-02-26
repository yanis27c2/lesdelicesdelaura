import { getCategories, saveCategory, getProducts, saveProduct } from './indexedDB';
import { categories as mockCategories, products as mockProducts } from '../data/mockProducts';

export const seedDatabaseIfEmpty = async () => {
    try {
        const existingCategories = await getCategories();
        if (existingCategories.length === 0) {
            console.log('Seeding categories...');
            for (const cat of mockCategories) {
                await saveCategory(cat);
            }
        }

        const existingProducts = await getProducts();
        if (existingProducts.length === 0) {
            console.log('Seeding products...');
            for (const prod of mockProducts) {
                // Add a default stock of 50 for testing
                await saveProduct({ ...prod, stock: 50 });
            }
        }
    } catch (err) {
        console.error('Failed to seed DB', err);
    }
};
