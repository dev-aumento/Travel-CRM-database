import 'dotenv/config';
import connectDB from '../config/db.js';
import { CrmDatabase } from '../models/CrmDatabase.js';
import { listCollectionStats, syncCollections } from '../utils/syncCollections.js';
import { buildSeededDatabase } from '../../src/context/DatabaseContext.tsx';

const DB_KEY = 'crm_database';

const seed = async () => {
    await connectDB();

    const data = buildSeededDatabase();

    await CrmDatabase.findOneAndUpdate(
        { key: DB_KEY },
        { key: DB_KEY, data },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await syncCollections(data);

    const stats = await listCollectionStats();

    console.log('\nMongoDB seeded successfully.\n');
    console.log('Database: Travel-crm');
    console.log('Collections created:\n');
    stats.forEach(({ collection, documents }) => {
        console.log(`  - ${collection.padEnd(18)} ${documents} document(s)`);
    });
    console.log('\nView data with MongoDB Compass or mongosh (see README in server/scripts).');

    process.exit(0);
};

seed().catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
});
