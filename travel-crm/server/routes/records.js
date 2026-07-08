import { Router } from 'express';
import { TABLE_COLLECTIONS } from '../utils/syncCollections.js';
import { upsertRecord, patchRecord, removeRecord } from '../utils/collectionRecords.js';

const router = Router();

const tableKeyToPath = (tableKey) => tableKey.replace(/([A-Z])/g, '-$1').toLowerCase();

const registerEntityRoutes = (path, tableKey) => {
    const collectionName = TABLE_COLLECTIONS[tableKey];

    router.post(`/${path}`, async (req, res) => {
        try {
            const record = req.body;
            if (!record || typeof record !== 'object' || !record.id) {
                return res.status(400).json({ error: 'Record body with id is required' });
            }

            await upsertRecord(collectionName, tableKey, record);
            res.status(201).json({ ok: true, id: record.id });
        } catch (error) {
            console.error(`POST /api/${path} failed:`, error);
            res.status(500).json({ error: `Failed to save ${path}` });
        }
    });

    router.patch(`/${path}/:id`, async (req, res) => {
        try {
            const { id } = req.params;
            const updates = req.body;

            if (!updates || typeof updates !== 'object') {
                return res.status(400).json({ error: 'Update payload is required' });
            }

            const updated = await patchRecord(collectionName, tableKey, id, updates);
            if (!updated) {
                return res.status(404).json({ error: 'Record not found' });
            }

            res.json({ ok: true, id });
        } catch (error) {
            console.error(`PATCH /api/${path}/:id failed:`, error);
            res.status(500).json({ error: `Failed to update ${path}` });
        }
    });

    router.delete(`/${path}/:id`, async (req, res) => {
        try {
            const { id } = req.params;
            const deleted = await removeRecord(collectionName, id);

            if (!deleted) {
                return res.status(404).json({ error: 'Record not found' });
            }

            res.json({ ok: true, id });
        } catch (error) {
            console.error(`DELETE /api/${path}/:id failed:`, error);
            res.status(500).json({ error: `Failed to delete ${path}` });
        }
    });
};

for (const tableKey of Object.keys(TABLE_COLLECTIONS)) {
    registerEntityRoutes(tableKeyToPath(tableKey), tableKey);
}

export default router;
