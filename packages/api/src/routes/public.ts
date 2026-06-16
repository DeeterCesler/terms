import { Router } from 'express';
import { z } from 'zod';
import { getSiteByDomain } from '../db/queries/sites.js';
import { getLatestAnalysis, getAnalysisHistory, getRankings } from '../db/queries/analyses.js';
import { getSitesForSource } from '../db/queries/policy_sources.js';
import { addCandidate, getCandidateByDomain } from '../db/queries/candidates.js';
import { normalizeDomain, domainLookupCandidates } from '../utils/domain.js';
import { requestRateLimiter } from '../middleware/rateLimiter.js';
import { getCachedCheck, setCachedCheck, bustCachedCheck } from '../cache/checkCache.js';
import type { CheckResult, HistoryEntry, PolicyAnalysisRow, RankingsResponse } from '@term-checker/shared';

export const publicRouter = Router();

function rowToAnalysis(row: PolicyAnalysisRow | null) {
  if (!row) return null;
  return {
    sharesWithThirdParties: { value: row.shares_with_third_parties, evidence: row.shares_evidence },
    sellsData: { value: row.sells_data, evidence: row.sells_evidence },
    dataAnonymized: { value: row.data_anonymized, evidence: row.anonymized_evidence },
    dataRetention: row.data_retention,
    userRights: (row.user_rights as string[]) ?? [],
    overallScore: row.overall_score!,
    summary: row.summary ?? '',
    highlights: (row.highlights as Array<{ kind: 'good' | 'bad'; text: string }>) ?? [],
  };
}

publicRouter.get('/rankings', async (_req, res, next) => {
  try {
    const { best, worst } = await getRankings(5);
    const mapRow = (r: { domain: string; overall_score: number; summary: string; shared_domains: string[] }) => ({
      domain: r.domain,
      overallScore: r.overall_score,
      summary: r.summary,
      ...(r.shared_domains.length > 0 ? { sharedDomains: r.shared_domains } : {}),
    });
    const result: RankingsResponse = {
      best: best.map(mapRow),
      worst: worst.map(mapRow),
    };
    res.json(result);
  } catch (err) {
    next(err);
  }
});

publicRouter.get('/check/:domain', async (req, res, next) => {
  try {
    const domain = normalizeDomain(req.params.domain ?? '');
    if (!domain) {
      res.status(400).json({ error: 'Invalid domain' });
      return;
    }

    const cached = getCachedCheck(domain);
    if (cached) {
      res.json(cached);
      return;
    }

    // Resolve the hostname to an analyzed site, folding subdomains down to the
    // registrable domain so e.g. open.spotify.com matches spotify.com's
    // analysis. Server-side so already-shipped extension builds benefit.
    let analysis: Awaited<ReturnType<typeof getLatestAnalysis>> = null;
    let matchedDomain = domain;
    for (const candidate of domainLookupCandidates(domain)) {
      const site = await getSiteByDomain(candidate);
      if (!site) continue;
      const found = await getLatestAnalysis(site.id);
      if (found) { analysis = found; matchedDomain = candidate; break; }
    }

    if (!analysis) {
      const candidate = await getCandidateByDomain(domain);
      const result: CheckResult = candidate
        ? { found: false, domain, requested: { at: candidate.added_at.toISOString() } }
        : { found: false, domain };
      setCachedCheck(domain, result);
      res.json(result);
      return;
    }

    const sharedSites = await getSitesForSource(analysis.policy_source_id);
    const sharedDomains = sharedSites
      .map(s => s.domain)
      .filter(d => d !== domain && d !== matchedDomain);

    const result: CheckResult = {
      found: true,
      domain,
      policyUrl: analysis.policy_url,
      lastAnalyzed: analysis.analyzed_at.toISOString(),
      ...(sharedDomains.length > 0 ? { sharedDomains } : {}),
      analysis: rowToAnalysis(analysis)!,
    };
    setCachedCheck(domain, result);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

publicRouter.get('/check/:domain/history', async (req, res, next) => {
  try {
    const domain = normalizeDomain(req.params.domain ?? '');
    if (!domain) {
      res.status(400).json({ error: 'Invalid domain' });
      return;
    }

    const site = await getSiteByDomain(domain);
    if (!site) {
      res.json({ domain, history: [] });
      return;
    }

    const rows = await getAnalysisHistory(site.id);
    const history: HistoryEntry[] = rows.map(row => ({
      analysisId: row.id,
      analyzedAt: row.analyzed_at.toISOString(),
      promptVersion: row.prompt_version,
      modelUsed: row.model_used,
      analysis: rowToAnalysis(row)!,
    }));

    res.json({ domain, history });
  } catch (err) {
    next(err);
  }
});

const RequestBody = z.object({
  url: z.string().url().optional(),
});

publicRouter.post('/request/:domain', requestRateLimiter, async (req, res, next) => {
  try {
    const domain = normalizeDomain(req.params.domain ?? '');
    if (!domain) {
      res.status(400).json({ error: 'Invalid domain' });
      return;
    }

    const parsed = RequestBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const candidate = await addCandidate(domain, 'privacy_policy', {
      url: parsed.data.url ?? null,
      notes: 'requested via extension',
    });

    bustCachedCheck([domain]);

    res.status(202).json({ domain, candidateId: candidate.id, status: 'requested' });
  } catch (err) {
    next(err);
  }
});
