import { Router } from 'express';
import { z } from 'zod';
import { getSiteByDomain, countSites, deleteSite } from '../db/queries/sites.js';
import { listPolicySourcesBySite } from '../db/queries/policy_sources.js';
import { listCandidates, listPendingCandidates, addCandidate, removeCandidate } from '../db/queries/candidates.js';
import { normalizeDomain } from '../utils/domain.js';
import { pool } from '../db/client.js';
import type { PolicyType } from '@term-checker/shared';

export const adminRouter = Router();

const POLICY_TYPES = [
  'privacy_policy',
  'terms_of_service',
  'cookie_policy',
  'data_processing_agreement',
  'acceptable_use_policy',
  'other',
] as const;

adminRouter.get('/sites', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '50'), 10)));
    const offset = (page - 1) * limit;

    const [total, { rows: enriched }] = await Promise.all([
      countSites(),
      pool.query(
        `SELECT
           s.domain,
           s.name,
           s.created_at,
           a.analyzed_at      AS last_analyzed,
           a.overall_score,
           a.policy_url
         FROM sites s
         LEFT JOIN LATERAL (
           SELECT pa.analyzed_at, pa.overall_score, ps.url AS policy_url
           FROM policy_analyses pa
           JOIN policy_sources ps ON ps.id = pa.policy_source_id
           WHERE pa.site_id = s.id AND pa.status = 'done'
           ORDER BY pa.analyzed_at DESC
           LIMIT 1
         ) a ON true
         ORDER BY s.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      ),
    ]);

    const sites = enriched.map(r => ({
      domain: r.domain,
      name: r.name ?? null,
      policyUrl: r.policy_url ?? null,
      createdAt: r.created_at,
      lastAnalyzed: r.last_analyzed ?? null,
      overallScore: r.overall_score ?? null,
    }));

    res.json({ sites, page, limit, total });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/sites/:domain/sources', async (req, res, next) => {
  try {
    const domain = normalizeDomain(req.params.domain ?? '');
    if (!domain) {
      res.status(400).json({ error: 'Invalid domain' });
      return;
    }

    const site = await getSiteByDomain(domain);
    if (!site) {
      res.status(404).json({ error: 'Site not found' });
      return;
    }

    const sources = await listPolicySourcesBySite(site.id);
    res.json({ domain, sources });
  } catch (err) {
    next(err);
  }
});

adminRouter.delete('/sites/:domain', async (req, res, next) => {
  try {
    const domain = normalizeDomain(req.params.domain ?? '');
    if (!domain) {
      res.status(400).json({ error: 'Invalid domain' });
      return;
    }
    const deleted = await deleteSite(domain);
    if (!deleted) {
      res.status(404).json({ error: 'Site not found' });
      return;
    }
    res.json({ deleted: true, domain });
  } catch (err) {
    next(err);
  }
});

// --- Candidates (wishlist of sites/policies to eventually process) ---

const CandidateBody = z.object({
  domain: z.string(),
  policyType: z.enum(POLICY_TYPES).optional().default('privacy_policy'),
  name: z.string().optional().nullable(),
  product: z.string().optional().nullable(),
  url: z.string().url().optional().nullable(),
  priority: z.number().int().min(1).max(10).optional().default(5),
  notes: z.string().optional().nullable(),
});

adminRouter.get('/candidates', async (_req, res, next) => {
  try {
    const candidates = await listCandidates();
    res.json({ candidates });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/candidates/pending', async (_req, res, next) => {
  try {
    const candidates = await listPendingCandidates();
    res.json({ candidates, count: candidates.length });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/candidates', async (req, res, next) => {
  try {
    const parsed = CandidateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const { domain, policyType, name, product, url, priority, notes } = parsed.data;
    const candidate = await addCandidate(normalizeDomain(domain) || domain, policyType as PolicyType, {
      name, product, url, priority, notes,
    });

    res.status(201).json({ candidate });
  } catch (err) {
    next(err);
  }
});

adminRouter.delete('/candidates/:id', async (req, res, next) => {
  try {
    const deleted = await removeCandidate(req.params.id ?? '');
    if (!deleted) {
      res.status(404).json({ error: 'Candidate not found' });
      return;
    }
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});
