import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { publicRateLimiter } from './middleware/rateLimiter.js';
import { adminAuth } from './middleware/adminAuth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { publicRouter } from './routes/public.js';
import { adminRouter } from './routes/admin.js';
import { config } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  // Render and most managed hosts terminate TLS at a proxy; trust the first
  // hop so express-rate-limit sees the real client IP instead of bucketing
  // every request under the proxy's address.
  app.set('trust proxy', 1);

  app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map(s => s.trim()) }));
  app.use(express.json());

  app.use('/admin-ui', express.static(join(__dirname, '../public')));

  app.get('/privacy', (_req, res) => {
    res.sendFile(join(__dirname, '../public/privacy.html'));
  });

  app.get('/rankings', (_req, res) => {
    res.sendFile(join(__dirname, '../public/rankings.html'));
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/v1', publicRateLimiter, publicRouter);
  app.use('/admin', adminAuth, adminRouter);

  app.use(errorHandler);

  return app;
}
