import mongoose from 'mongoose';

/** CRM table keys → MongoDB collection names (easy to browse in Compass). */
export const TABLE_COLLECTIONS = {
    leads: 'leads',
    bookings: 'bookings',
    quotations: 'quotations',
    customers: 'customers',
    destinations: 'destinations',
    hotels: 'hotels',
    activities: 'activities',
    travelAgents: 'travel_agents',
    staff: 'staff',
    plans: 'plans',
    settings: 'settings',
    customPresets: 'custom_presets',
    quoteTerms: 'quote_terms',
};

export const syncCollections = async (dbData) => {
    if (!dbData || typeof dbData !== 'object') return;

    const db = mongoose.connection.db;

    for (const [tableKey, collectionName] of Object.entries(TABLE_COLLECTIONS)) {
        const table = dbData[tableKey];
        const records = Array.isArray(table?.data) ? table.data : [];
        const collection = db.collection(collectionName);

        await collection.deleteMany({});

        if (records.length > 0) {
            await collection.insertMany(
                records.map((record) => ({
                    ...record,
                    _table: tableKey,
                }))
            );
        }
    }
};

export const listCollectionStats = async () => {
    const db = mongoose.connection.db;
    const stats = [];

    for (const collectionName of Object.values(TABLE_COLLECTIONS)) {
        const count = await db.collection(collectionName).countDocuments();
        stats.push({ collection: collectionName, documents: count });
    }

    const mainCount = await db.collection('crmdatabases').countDocuments();
    stats.unshift({ collection: 'crmdatabases', documents: mainCount });

    return stats;
};

const stripMongoMeta = (doc) => {
    const { _id, _table, ...record } = doc;
    return record;
};

/** Read every CRM table from its MongoDB collection (live data). */
export const loadAllCollections = async () => {
    const db = mongoose.connection.db;
    const collections = {};

    for (const [tableKey, collectionName] of Object.entries(TABLE_COLLECTIONS)) {
        const docs = await db.collection(collectionName).find({}).toArray();
        collections[tableKey] = docs.map(stripMongoMeta);
    }

    return collections;
};

export const hasCollectionData = (collections) =>
    Object.values(collections).some((records) => Array.isArray(records) && records.length > 0);
