import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import connectDB from '../config/db.js';
import { CrmDatabase } from '../models/CrmDatabase.js';
import { syncCollections, loadAllCollections, listCollectionStats } from '../utils/syncCollections.js';

const DB_KEY = 'crm_database';

const backup = async () => {
    await connectDB();

    const snapshot = await CrmDatabase.findOne({ key: DB_KEY }).lean();
    const collections = await loadAllCollections();

    const payload = {
        exportedAt: new Date().toISOString(),
        source: 'travel-crm-backup',
        snapshotUpdatedAt: snapshot?.updatedAt ?? null,
        data: snapshot?.data ?? null,
        collections,
    };

    const dir = path.resolve('backups');
    fs.mkdirSync(dir, { recursive: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filePath = path.join(dir, `travel-crm-${stamp}.json`);
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');

    const stats = await listCollectionStats();
    console.log('\nBackup saved:', filePath);
    console.log('\nCollection counts:');
    stats.forEach(({ collection, documents }) => {
        console.log(`  ${collection.padEnd(18)} ${documents}`);
    });
    console.log('');

    process.exit(0);
};

backup().catch((error) => {
    console.error('Backup failed:', error);
    process.exit(1);
});
