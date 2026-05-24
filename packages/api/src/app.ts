import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readFile } from 'fs/promises';
import express from 'express';
import cors from 'cors';
import { publicRateLimiter } from './middleware/rateLimiter.js';
import { adminAuth } from './middleware/adminAuth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { publicRouter } from './routes/public.js';
import { adminRouter } from './routes/admin.js';
import { config } from './config.js';
import { getRankings, getCoverageStats } from './db/queries/analyses.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => HTML_ESCAPES[c]!);
}

function tierClass(score: number): string {
  if (score >= 8) return 'good';
  if (score >= 5) return 'fair';
  return 'poor';
}

function renderRankingRows(list: Array<{ domain: string; overall_score: number; summary: string; shared_domains: string[] }>): string {
  if (!list.length) return '<p class="empty">No sites yet.</p>';
  return list.map((item, i) => {
    const sharedBadge = item.shared_domains.length > 0
      ? `<div class="shared-with">Also covers: ${item.shared_domains.map(escapeHtml).join(', ')}</div>`
      : '';
    return `<div class="row">` +
      `<div class="rank">#${i + 1}</div>` +
      `<div class="badge ${tierClass(item.overall_score)}">${item.overall_score}</div>` +
      `<div class="meta">` +
        `<div class="domain">${escapeHtml(item.domain)}</div>` +
        `<div class="summary">${escapeHtml(item.summary ?? '')}</div>` +
        sharedBadge +
      `</div>` +
    `</div>`;
  }).join('');
}

function formatRelativeUpdate(d: Date | null): string {
  if (!d) return 'No analyses yet';
  const diffMs = Date.now() - d.getTime();
  const day = 86400_000;
  if (diffMs < day) return 'Updated today';
  if (diffMs < 2 * day) return 'Updated yesterday';
  if (diffMs < 30 * day) return `Updated ${Math.floor(diffMs / day)} days ago`;
  return `Updated ${d.toISOString().slice(0, 10)}`;
}

function renderStatsStrip(stats: { sites_covered: number; sites_queued: number; last_analyzed_at: Date | null }): string {
  const sites = stats.sites_covered.toLocaleString();
  const queued = stats.sites_queued.toLocaleString();
  const updated = escapeHtml(formatRelativeUpdate(stats.last_analyzed_at));
  return (
    `<div class="stat"><span class="stat-value">${sites}</span><span class="stat-label">Sites analyzed</span></div>` +
    `<div class="stat"><span class="stat-value">${queued}</span><span class="stat-label">Sites queued</span></div>` +
    `<div class="stat"><span class="stat-value stat-text">${updated}</span><span class="stat-label">Most recent</span></div>`
  );
}

async function renderRankingsPage(): Promise<string> {
  const [template, { best, worst }, stats] = await Promise.all([
    readFile(join(__dirname, '../public/rankings.html'), 'utf8'),
    getRankings(5),
    getCoverageStats(),
  ]);
  return template
    .replace('<!--STATS_STRIP-->', renderStatsStrip(stats))
    .replace('<!--BEST_ROWS-->', renderRankingRows(best))
    .replace('<!--WORST_ROWS-->', renderRankingRows(worst));
}

export function createApp() {
  const app = express();

  // Render and most managed hosts terminate TLS at a proxy; trust the first
  // hop so express-rate-limit sees the real client IP instead of bucketing
  // every request under the proxy's address.
  app.set('trust proxy', 1);

  app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map(s => s.trim()) }));
  app.use(express.json());

  app.use('/admin-ui', express.static(join(__dirname, '../public')));
  app.use('/icons', express.static(join(__dirname, '../public/icons')));

  app.get('/favicon.ico', (_req, res) => {
    res.type('image/png').sendFile(join(__dirname, '../public/icons/icon128.png'));
  });

  app.get('/privacy', (_req, res) => {
    res.sendFile(join(__dirname, '../public/privacy.html'));
  });

  const rankingsHandler: express.RequestHandler = async (_req, res, next) => {
    try {
      const html = await renderRankingsPage();
      res.type('html').send(html);
    } catch (err) {
      next(err);
    }
  };
  app.get('/', rankingsHandler);
  app.get('/rankings', rankingsHandler);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/v1', publicRateLimiter, publicRouter);
  app.use('/admin', adminAuth, adminRouter);

  app.use(errorHandler);

  return app;
}
