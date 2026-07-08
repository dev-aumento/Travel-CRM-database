import { Router } from 'express';
import { CrmDatabase } from '../models/CrmDatabase.js';
import { syncCollections, loadAllCollections } from '../utils/syncCollections.js';

const router = Router();
const DB_KEY = 'crm_database';

router.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'travel-crm-api' });
});

router.get('/database', async (_req, res) => {
    try {
        const record = await CrmDatabase.findOne({ key: DB_KEY }).lean();
        if (!record) {
            return res.status(404).json({ error: 'Database not initialized' });
        }
        res.json(record.data);
    } catch (error) {
        console.error('GET /api/database failed:', error);
        res.status(500).json({ error: 'Failed to load database' });
    }
});

router.get('/collections', async (_req, res) => {
    try {
        const collections = await loadAllCollections();
        const record = await CrmDatabase.findOne({ key: DB_KEY }).select('updatedAt').lean();
        res.json({ collections, updatedAt: record?.updatedAt ?? null });
    } catch (error) {
        console.error('GET /api/collections failed:', error);
        res.status(500).json({ error: 'Failed to load collections' });
    }
});

router.put('/database', async (req, res) => {
    try {
        const data = req.body;
        if (!data || typeof data !== 'object') {
            return res.status(400).json({ error: 'Invalid database payload' });
        }

        const record = await CrmDatabase.findOneAndUpdate(
            { key: DB_KEY },
            { key: DB_KEY, data },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean();

        await syncCollections(data);

        res.json({ ok: true, updatedAt: record.updatedAt });
    } catch (error) {
        console.error('PUT /api/database failed:', error);
        res.status(500).json({ error: 'Failed to save database' });
    }
});

export default router;
