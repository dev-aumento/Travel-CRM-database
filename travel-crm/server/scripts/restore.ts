import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import connectDB from '../config/db.js';
import { CrmDatabase } from '../models/CrmDatabase.js';
import { syncCollections, listCollectionStats } from '../utils/syncCollections.js';

const DB_KEY = 'crm_database';

const TABLE_KEYS = [
    'leads', 'bookings', 'quotations', 'customers', 'destinations',
    'hotels', 'activities', 'travelAgents', 'staff', 'plans',
    'settings', 'customPresets', 'quoteTerms',
];

const isTableData = (value: unknown): value is { data: unknown[] } =>
    Boolean(value && typeof value === 'object' && Array.isArray((value as { data?: unknown }).data));

/** Accept full app DB, backup export, or browser localStorage JSON. */
const normalizeBackupPayload = (raw: unknown): Record<string, unknown> => {
    if (!raw || typeof raw !== 'object') {
        throw new Error('Backup file must contain a JSON object.');
    }

    const obj = raw as Record<string, unknown>;

    if (obj.source === 'travel-crm-backup' && obj.data && typeof obj.data === 'object') {
        return obj.data as Record<string, unknown>;
    }

    if (TABLE_KEYS.some((key) => isTableData(obj[key]))) {
        return obj;
    }

    throw new Error(
        'Unrecognized backup format. Expected app database JSON or a file from npm run backup.'
    );
};

const summarize = (data: Record<string, unknown>) => {
    const agents = isTableData(data.travelAgents) ? data.travelAgents.data.length : 0;
    const leads = isTableData(data.leads) ? data.leads.data.length : 0;
    const bookings = isTableData(data.bookings) ? data.bookings.data.length : 0;
    const quotations = isTableData(data.quotations) ? data.quotations.data.length : 0;
    return { agents, leads, bookings, quotations };
};

const restore = async () => {
    const inputPath = process.argv[2];
    if (!inputPath) {
        console.error('\nUsage: npm run restore -- <path-to-backup.json>\n');
        console.error('Examples:');
        console.error('  npm run restore -- backups/travel-crm-2026-06-25.json');
        console.error('  npm run restore -- ./localstorage-export.json\n');
        process.exit(1);
    }

    const resolved = path.resolve(inputPath);
    if (!fs.existsSync(resolved)) {
        console.error(`File not found: ${resolved}`);
        process.exit(1);
    }

    const raw = JSON.parse(fs.readFileSync(resolved, 'utf8'));
    const data = normalizeBackupPayload(raw);
    const summary = summarize(data);

    console.log('\n=== Restore preview ===');
    console.log(`File:       ${resolved}`);
    console.log(`Agents:     ${summary.agents}`);
    console.log(`Leads:      ${summary.leads}`);
    console.log(`Bookings:   ${summary.bookings}`);
    console.log(`Quotations: ${summary.quotations}`);

    if (summary.agents === 0 && summary.leads === 0) {
        console.error('\nRefusing to restore: backup appears empty.');
        process.exit(1);
    }

    const force = process.argv.includes('--force');
    if (!force) {
        console.error('\nThis will REPLACE all CRM collections in MongoDB.');
        console.error('Re-run with --force to proceed:\n');
        console.error(`  npm run restore -- "${inputPath}" --force\n`);
        process.exit(0);
    }

    await connectDB();

    await CrmDatabase.findOneAndUpdate(
        { key: DB_KEY },
        { key: DB_KEY, data },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await syncCollections(data);

    const stats = await listCollectionStats();
    console.log('\nRestore complete.\n');
    stats.forEach(({ collection, documents }) => {
        console.log(`  ${collection.padEnd(18)} ${documents} document(s)`);
    });
    console.log('\nRestart the app and clear browser cache if data still looks stale:');
    console.log('  localStorage.removeItem("crm_database"); location.reload();\n');

    process.exit(0);
};

restore().catch((error) => {
    console.error('Restore failed:', error);
    process.exit(1);
});
