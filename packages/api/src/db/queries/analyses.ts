import { pool } from '../client.js';
import type { PolicyAnalysisRow, AnalysisResult } from '@term-checker/shared';

export async function getLatestAnalysis(
  siteId: string,
): Promise<(PolicyAnalysisRow & { policy_url: string }) | null> {
  // Join through policy_source_sites so shared corporate policies (e.g. Disney
  // covering espn.com, disneyplus.com, etc.) surface for every brand site.
  const { rows } = await pool.query<PolicyAnalysisRow & { policy_url: string }>(
    `SELECT pa.*, ps.url AS policy_url
     FROM policy_analyses pa
     JOIN policy_sources ps ON ps.id = pa.policy_source_id
     JOIN policy_source_sites pss ON pss.policy_source_id = pa.policy_source_id
     WHERE pss.site_id = $1 AND pa.status = 'done'
     ORDER BY pa.analyzed_at DESC
     LIMIT 1`,
    [siteId]
  );
  return rows[0] ?? null;
}

export async function getAnalysisHistory(siteId: string): Promise<PolicyAnalysisRow[]> {
  const { rows } = await pool.query<PolicyAnalysisRow>(
    `SELECT DISTINCT pa.*
     FROM policy_analyses pa
     JOIN policy_source_sites pss ON pss.policy_source_id = pa.policy_source_id
     WHERE pss.site_id = $1 AND pa.status = 'done'
     ORDER BY pa.analyzed_at DESC`,
    [siteId]
  );
  return rows;
}

export async function insertAnalysis(
  policyId: string,
  siteId: string,
  policySourceId: string,
  result: AnalysisResult,
  rawResponse: unknown,
  modelUsed: string,
  promptVersion: string,
): Promise<PolicyAnalysisRow> {
  const { rows } = await pool.query<PolicyAnalysisRow>(
    `INSERT INTO policy_analyses (
       policy_id, site_id, policy_source_id, model_used, prompt_version,
       shares_with_third_parties, shares_evidence,
       sells_data, sells_evidence,
       data_anonymized, anonymized_evidence,
       data_retention, user_rights, overall_score, summary, highlights,
       raw_response, status
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'done')
     RETURNING *`,
    [
      policyId, siteId, policySourceId, modelUsed, promptVersion,
      result.shares_with_third_parties.value, result.shares_with_third_parties.evidence,
      result.sells_data.value, result.sells_data.evidence,
      result.data_anonymized.value, result.data_anonymized.evidence,
      result.data_retention,
      JSON.stringify(result.user_rights),
      result.overall_score,
      result.summary,
      result.highlights && result.highlights.length > 0 ? JSON.stringify(result.highlights) : null,
      JSON.stringify(rawResponse),
    ]
  );
  return rows[0]!;
}

export async function updateAnalysisHighlights(
  analysisId: string,
  highlights: Array<{ kind: 'good' | 'bad'; text: string }>,
): Promise<void> {
  await pool.query(
    `UPDATE policy_analyses SET highlights = $1 WHERE id = $2`,
    [highlights.length > 0 ? JSON.stringify(highlights) : null, analysisId]
  );
}

// Phrases the analyzer uses when the fetched text isn't a real privacy policy
// (homepage shell, 404, parking page, support center, etc.). Excluding these
// from the worst-5 list keeps fetch failures from being charged against the
// site they're standing in for.
const FETCH_ISSUE_REGEX =
  '(fetched (content|text)|not (a|the) privacy policy|404 error|marketing homepage|landing page|re-?fetch|re-?mapped|hugedomains|domain[- ]for[- ]sale|support center menu|legals?[- ]index|table of contents|shell html|product nav|cookie banner|nav garbage|broken fetch|wrong document|domain redirected)';

export interface RankingRow {
  domain: string;
  overall_score: number;
  summary: string;
  shared_domains: string[];
}

export async function getRankings(limit: number): Promise<{
  best: RankingRow[];
  worst: RankingRow[];
}> {
  // Dedupe by policy_source_id so a shared corporate policy (Disney covering
  // disney.com, disneyplus.com, espn.com) is one row, not three. The primary
  // site (policy_source_sites.is_primary) is what gets displayed; the other
  // member domains travel along as shared_domains for the "Also covers" badge.
  // Ties broken by most recent analysis (so freshly-rescored sites win). Bad
  // fetches (homepage shells, 404s, parking pages) are excluded from the worst
  // list. Same filter runs on best for symmetry.
  const baseQuery = (direction: 'DESC' | 'ASC') => `
    WITH latest AS (
      SELECT policy_source_id, MAX(analyzed_at) AS latest_at
      FROM policy_analyses
      WHERE status = 'done' AND overall_score IS NOT NULL
      GROUP BY policy_source_id
    ),
    primary_site AS (
      SELECT pss.policy_source_id, s.domain
      FROM policy_source_sites pss
      JOIN sites s ON s.id = pss.site_id
      WHERE pss.is_primary = TRUE
    ),
    shared AS (
      SELECT pss.policy_source_id,
             COALESCE(
               array_agg(s.domain ORDER BY s.domain) FILTER (WHERE pss.is_primary = FALSE),
               ARRAY[]::text[]
             ) AS others
      FROM policy_source_sites pss
      JOIN sites s ON s.id = pss.site_id
      GROUP BY pss.policy_source_id
    )
    SELECT ps_site.domain,
           pa.overall_score,
           pa.summary,
           shared.others AS shared_domains
    FROM policy_analyses pa
    JOIN latest ON latest.policy_source_id = pa.policy_source_id AND latest.latest_at = pa.analyzed_at
    JOIN policies p ON p.id = pa.policy_id
    JOIN primary_site ps_site ON ps_site.policy_source_id = pa.policy_source_id
    JOIN shared ON shared.policy_source_id = pa.policy_source_id
    WHERE pa.status = 'done'
      AND ps_site.domain <> 'terms-vzh0.onrender.com'
      AND p.char_count >= 2000
      AND COALESCE(pa.summary, '') !~* $2
    ORDER BY pa.overall_score ${direction}, pa.analyzed_at DESC
    LIMIT $1`;

  const { rows: best } = await pool.query<RankingRow>(
    baseQuery('DESC'),
    [limit, FETCH_ISSUE_REGEX]
  );
  const { rows: worst } = await pool.query<RankingRow>(
    baseQuery('ASC'),
    [limit, FETCH_ISSUE_REGEX]
  );
  return { best, worst };
}

export interface CoverageStats {
  sites_covered: number;
  shared_families: number;
  last_analyzed_at: Date | null;
}

export async function getCoverageStats(): Promise<CoverageStats> {
  // Counts "good" coverage only: same quality filter as getRankings (no thin
  // policies, no fetch-issue summaries, no self-domain). Keeps the public
  // total honest about what visitors can actually look up.
  const { rows } = await pool.query<{
    sites_covered: string;
    shared_families: string;
    last_analyzed_at: Date | null;
  }>(
    `WITH good_sources AS (
       SELECT DISTINCT pa.policy_source_id
       FROM policy_analyses pa
       JOIN policies p ON p.id = pa.policy_id
       WHERE pa.status = 'done'
         AND pa.overall_score IS NOT NULL
         AND p.char_count >= 2000
         AND COALESCE(pa.summary, '') !~* $1
     ),
     covered_sites AS (
       SELECT DISTINCT pss.site_id
       FROM policy_source_sites pss
       JOIN sites s ON s.id = pss.site_id
       WHERE pss.policy_source_id IN (SELECT policy_source_id FROM good_sources)
         AND s.domain <> 'terms-vzh0.onrender.com'
     ),
     family_sizes AS (
       SELECT pss.policy_source_id, COUNT(*) AS site_count
       FROM policy_source_sites pss
       WHERE pss.policy_source_id IN (SELECT policy_source_id FROM good_sources)
       GROUP BY pss.policy_source_id
     )
     SELECT
       (SELECT COUNT(*) FROM covered_sites) AS sites_covered,
       (SELECT COUNT(*) FROM family_sizes WHERE site_count >= 2) AS shared_families,
       (SELECT MAX(pa.analyzed_at)
          FROM policy_analyses pa
          WHERE pa.status = 'done'
            AND pa.policy_source_id IN (SELECT policy_source_id FROM good_sources)
       ) AS last_analyzed_at`,
    [FETCH_ISSUE_REGEX]
  );
  const row = rows[0]!;
  return {
    sites_covered: Number(row.sites_covered),
    shared_families: Number(row.shared_families),
    last_analyzed_at: row.last_analyzed_at,
  };
}

export async function insertFailedAnalysis(
  policyId: string,
  siteId: string,
  policySourceId: string,
  errorMessage: string,
  rawResponse: unknown,
  modelUsed: string,
  promptVersion: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO policy_analyses (
       policy_id, site_id, policy_source_id, model_used, prompt_version,
       raw_response, status, error_message
     ) VALUES ($1,$2,$3,$4,$5,$6,'failed',$7)`,
    [policyId, siteId, policySourceId, modelUsed, promptVersion, JSON.stringify(rawResponse), errorMessage]
  );
}
