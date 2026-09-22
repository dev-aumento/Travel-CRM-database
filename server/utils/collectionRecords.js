import mongoose from 'mongoose';

export const upsertRecord = async (collectionName, tableKey, record) => {
    if (!record?.id) {
        throw new Error('Record must include an id');
    }

    const collection = mongoose.connection.db.collection(collectionName);
    await collection.replaceOne(
        { id: record.id },
        { ...record, _table: tableKey },
        { upsert: true }
    );
};

export const patchRecord = async (collectionName, tableKey, id, updates) => {
    const collection = mongoose.connection.db.collection(collectionName);
    const result = await collection.updateOne(
        { id },
        { $set: { ...updates, _table: tableKey } }
    );

    if (result.matchedCount === 0) {
        return false;
    }

    return true;
};

export const removeRecord = async (collectionName, id) => {
    const collection = mongoose.connection.db.collection(collectionName);
    const result = await collection.deleteOne({ id });
    return result.deletedCount > 0;
};
