import { Router } from 'express';
import { z } from 'zod';
import { getSiteByDomain } from '../db/queries/sites.js';
import { getLatestAnalysis, getAnalysisHistory } from '../db/queries/analyses.js';
import { addCandidate } from '../db/queries/candidates.js';
import { normalizeDomain } from '../utils/domain.js';
import type { CheckResult, HistoryEntry, PolicyAnalysisRow } from '@term-checker/shared';

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
  };
}

publicRouter.get('/check/:domain', async (req, res, next) => {
  try {
    const domain = normalizeDomain(req.params.domain ?? '');
    if (!domain) {
      res.status(400).json({ error: 'Invalid domain' });
      return;
    }

    const site = await getSiteByDomain(domain);
    if (!site) {
      const result: CheckResult = { found: false, domain };
      res.json(result);
      return;
    }

    const analysis = await getLatestAnalysis(site.id);
    if (!analysis) {
      const result: CheckResult = { found: false, domain };
      res.json(result);
      return;
    }

    const result: CheckResult = {
      found: true,
      domain,
      policyUrl: analysis.policy_url,
      lastAnalyzed: analysis.analyzed_at.toISOString(),
      analysis: rowToAnalysis(analysis)!,
    };
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

publicRouter.post('/request/:domain', async (req, res, next) => {
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
      notes: 'requested from extension',
    });

    res.status(202).json({ domain, candidateId: candidate.id, status: 'requested' });
  } catch (err) {
    next(err);
  }
});
