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

  app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map(s => s.trim()) }));
  app.use(express.json());

  app.use('/admin-ui', express.static(join(__dirname, '../public')));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/v1', publicRateLimiter, publicRouter);
  app.use('/admin', adminAuth, adminRouter);

  app.use(errorHandler);

  return app;
}
