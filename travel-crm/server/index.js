import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import express from 'express';
import connectDB from './config/db.js';
import databaseRoutes from './routes/database.js';
import recordRoutes from './routes/records.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, '..', 'dist');
const PORT = Number(process.env.PORT) || 5000;
const isProduction = process.env.NODE_ENV === 'production';

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/api', databaseRoutes);
app.use('/api', recordRoutes);

if (isProduction) {
    app.use(express.static(distPath));
    app.get(/^(?!\/api).*/, (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

app.use((err, _req, res, _next) => {
    console.error('Unhandled API error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

const start = async () => {
    await connectDB();
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Travel CRM API running on http://0.0.0.0:${PORT}`);
    });
};

start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
