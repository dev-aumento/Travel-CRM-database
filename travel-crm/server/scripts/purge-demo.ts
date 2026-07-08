import 'dotenv/config';
import connectDB from '../config/db.js';
import { CrmDatabase } from '../models/CrmDatabase.js';
import { syncCollections, loadAllCollections, listCollectionStats } from '../utils/syncCollections.js';
import { sanitizeWorkspaceData } from '../../src/utils/seedData.ts';

const DB_KEY = 'crm_database';

const mergeCollectionsIntoDbShape = (collections: Record<string, any[]>) => {
    const db: Record<string, { name: string; columns: string[]; data: any[] }> = {};
    for (const [key, records] of Object.entries(collections)) {
        db[key] = { name: key, columns: [], data: Array.isArray(records) ? records : [] };
    }
    return db;
};

const purge = async () => {
    await connectDB();

    const collections = await loadAllCollections();
    const merged = mergeCollectionsIntoDbShape(collections);
    const cleaned = sanitizeWorkspaceData(merged);

    await CrmDatabase.findOneAndUpdate(
        { key: DB_KEY },
        { key: DB_KEY, data: cleaned },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await syncCollections(cleaned);

    const stats = await listCollectionStats();
    console.log('\nDemo data removed from MongoDB.\n');
    stats.forEach(({ collection, documents }) => {
        console.log(`  ${collection.padEnd(18)} ${documents} document(s)`);
    });
    console.log('\nCRM collections (leads, agents, etc.) now contain only real records.');
    console.log('Clear browser cache if the UI still shows old data:');
    console.log('  localStorage.removeItem("crm_database"); location.reload();\n');

    process.exit(0);
};

purge().catch((error) => {
    console.error('Purge failed:', error);
    process.exit(1);
});
