import 'dotenv/config';
import connectDB from '../config/db.js';
import mongoose from 'mongoose';
import { TABLE_COLLECTIONS } from '../utils/syncCollections.js';

const SEED_AGENT_IDS = new Set(['AGT-001', 'AGT-002', 'AGT-003', 'AGT-004', 'AGT-005']);

const inspect = async () => {
    await connectDB();
    const db = mongoose.connection.db;

    console.log('\n=== MongoDB Recovery Inspection ===\n');
    console.log(`Database: ${db.databaseName}`);
    console.log(`Host: ${mongoose.connection.host}\n`);

    const allCollections = await db.listCollections().toArray();
    console.log(`Collections in database (${allCollections.length}):`);
    for (const col of allCollections.sort((a, b) => a.name.localeCompare(b.name))) {
        const count = await db.collection(col.name).countDocuments();
        console.log(`  ${col.name.padEnd(22)} ${count} doc(s)`);
    }

    const snapshot = await db.collection('crmdatabases').findOne({ key: 'crm_database' });
    if (snapshot) {
        const data = snapshot.data || {};
        const agents = data.travelAgents?.data || [];
        const leads = data.leads?.data || [];
        const customAgents = agents.filter((a: any) => a?.id && !SEED_AGENT_IDS.has(String(a.id)));
        console.log('\n--- crmdatabases snapshot ---');
        console.log(`  createdAt:  ${snapshot.createdAt || 'n/a'}`);
        console.log(`  updatedAt:  ${snapshot.updatedAt || 'n/a'}`);
        console.log(`  agents:     ${agents.length} (${customAgents.length} non-demo)`);
        console.log(`  leads:      ${leads.length}`);
        console.log(`  bookings:   ${(data.bookings?.data || []).length}`);
        console.log(`  quotations: ${(data.quotations?.data || []).length}`);
        if (customAgents.length) {
            console.log('  Custom agents in snapshot:');
            customAgents.forEach((a: any) => console.log(`    - ${a.id} ${a.email} (${a.businessName || a.name})`));
        }
    } else {
        console.log('\n--- crmdatabases snapshot: NOT FOUND ---');
    }

    const agents = await db.collection('travel_agents').find({}).toArray();
    const customInCollection = agents.filter((a) => a?.id && !SEED_AGENT_IDS.has(String(a.id)));
    console.log('\n--- travel_agents collection ---');
    agents.forEach((a) => console.log(`  ${a.id}  ${a.email}  ${a.businessName || a.name}`));
    if (!customInCollection.length) {
        console.log('  (only demo seed agents — real agency data was overwritten)');
    }

    const leadSample = await db.collection('leads').find({}).limit(3).toArray();
    console.log('\n--- leads sample IDs ---');
    leadSample.forEach((l) => console.log(`  ${l.id}  agent=${l.agentId}  ${l.name}`));

    console.log('\n=== Recovery options ===');
    console.log('1. MongoDB Atlas → Backup → restore cluster to a point BEFORE npm run seed');
    console.log('2. Browser DevTools → Application → localStorage → key "crm_database" (if still present)');
    console.log('3. Import a JSON backup: npm run restore -- path/to/backup.json');
    console.log('');

    process.exit(0);
};

inspect().catch((err) => {
    console.error(err);
    process.exit(1);
});
