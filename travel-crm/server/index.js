import 'dotenv/config';
import fs from 'fs';
import http from 'http';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import express from 'express';
import connectDB from './config/db.js';
import databaseRoutes from './routes/database.js';
import recordRoutes from './routes/records.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, '..', 'dist');
const indexFile = path.join(distPath, 'index.html');
const PORT = Number(process.env.PORT) || 5000;
const VITE_PORT = Number(process.env.VITE_PORT) || 5173;
const isProduction = process.env.NODE_ENV === 'production';
const HOP_BY_HOP_HEADERS = new Set([
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailers',
    'transfer-encoding',
    'upgrade',
]);

const app = express();
const distStatic = express.static(distPath);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/api', databaseRoutes);
app.use('/api', recordRoutes);

const sendDevHelpPage = (res) => {
    res.status(503).type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Travel CRM API</title>
    <style>
      body { font-family: sans-serif; max-width: 40rem; margin: 4rem auto; line-height: 1.5; color: #0f172a; }
      code { background: #f1f5f9; padding: 0.1rem 0.35rem; border-radius: 0.25rem; }
      a { color: #2563eb; }
    </style>
  </head>
  <body>
    <h1>Travel CRM API is running</h1>
    <p>The frontend is not available on this port yet.</p>
    <p>Start the app with <code>npm run dev</code> and open
      <a href="http://localhost:${VITE_PORT}">http://localhost:${VITE_PORT}</a>,
      or run <code>npm run build</code> and restart this server.</p>
  </body>
</html>`);
};

const proxyToVite = (req, res) =>
    new Promise((resolve) => {
        const headers = { ...req.headers, host: `127.0.0.1:${VITE_PORT}` };
        delete headers['accept-encoding'];

        const proxyReq = http.request(
            {
                hostname: '127.0.0.1',
                port: VITE_PORT,
                path: req.originalUrl,
                method: req.method,
                headers,
            },
            (proxyRes) => {
                const responseHeaders = {};
                for (const [key, value] of Object.entries(proxyRes.headers)) {
                    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase()) && value != null) {
                        responseHeaders[key] = value;
                    }
                }
                res.writeHead(proxyRes.statusCode || 502, responseHeaders);
                proxyRes.pipe(res);
                resolve(true);
            }
        );

        proxyReq.on('error', () => resolve(false));
        req.pipe(proxyReq);
    });

const serveSpaFromDist = () => {
    app.use(distStatic);
    app.get(/^(?!\/api).*/, (_req, res) => {
        res.sendFile(indexFile);
    });
};

const serveFromViteThenDist = async (req, res, next) => {
    if (req.path.startsWith('/api')) return next();

    try {
        const proxied = await proxyToVite(req, res);
        if (proxied) return;

        if (fs.existsSync(indexFile)) {
            distStatic(req, res, () => {
                res.sendFile(indexFile);
            });
            return;
        }

        sendDevHelpPage(res);
    } catch (error) {
        next(error);
    }
};

if (isProduction) {
    serveSpaFromDist();
} else {
    app.use(serveFromViteThenDist);
}

app.use((err, _req, res, _next) => {
    console.error('Unhandled API error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

const start = async () => {
    await connectDB();
    const onListen = () => {
        console.log(`Travel CRM API running on http://localhost:${PORT}`);
        if (!isProduction) {
            console.log(`Frontend: http://localhost:${PORT} (same as Fly) or http://localhost:${VITE_PORT}`);
        }
    };

    // Fly needs 0.0.0.0. Locally, the default bind accepts both IPv4 and IPv6 localhost.
    const server = isProduction ? app.listen(PORT, '0.0.0.0', onListen) : app.listen(PORT, onListen);

    if (!isProduction) {
        server.on('upgrade', (req, socket, head) => {
            if (req.url?.startsWith('/api')) {
                socket.destroy();
                return;
            }

            const proxy = net.connect(VITE_PORT, '127.0.0.1', () => {
                const headerLines = Object.entries(req.headers)
                    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
                    .join('\r\n');
                proxy.write(`${req.method} ${req.url} HTTP/1.1\r\n${headerLines}\r\n\r\n`);
                if (head?.length) proxy.write(head);
                proxy.pipe(socket);
                socket.pipe(proxy);
            });

            proxy.on('error', () => socket.destroy());
            socket.on('error', () => proxy.destroy());
        });
    }

    server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
            console.warn(`Port ${PORT} is already in use. Using the existing API process.`);
            process.exit(0);
        }
        console.error('Failed to start server:', error);
        process.exit(1);
    });
};

start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
