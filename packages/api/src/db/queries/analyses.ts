import { pool } from '../client.js';
import type { PolicyAnalysisRow, AnalysisResult } from '@term-checker/shared';

export async function getLatestAnalysis(
  siteId: string,
): Promise<(PolicyAnalysisRow & { policy_url: string }) | null> {
  const { rows } = await pool.query<PolicyAnalysisRow & { policy_url: string }>(
    `SELECT pa.*, ps.url AS policy_url
     FROM policy_analyses pa
     JOIN policy_sources ps ON ps.id = pa.policy_source_id
     WHERE pa.site_id = $1 AND pa.status = 'done'
     ORDER BY pa.analyzed_at DESC
     LIMIT 1`,
    [siteId]
  );
  return rows[0] ?? null;
}

export async function getAnalysisHistory(siteId: string): Promise<PolicyAnalysisRow[]> {
  const { rows } = await pool.query<PolicyAnalysisRow>(
    `SELECT * FROM policy_analyses
     WHERE site_id = $1 AND status = 'done'
     ORDER BY analyzed_at DESC`,
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

export async function getRankings(limit: number): Promise<{
  best: Array<{ domain: string; overall_score: number; summary: string }>;
  worst: Array<{ domain: string; overall_score: number; summary: string }>;
}> {
  // Latest done analysis per site, then top/bottom by overall_score.
  // Ties broken by most recent analysis (so freshly-rescored sites win).
  const { rows: best } = await pool.query<{ domain: string; overall_score: number; summary: string }>(
    `SELECT s.domain, pa.overall_score, pa.summary
     FROM policy_analyses pa
     JOIN sites s ON s.id = pa.site_id
     JOIN (
       SELECT site_id, MAX(analyzed_at) AS latest
       FROM policy_analyses
       WHERE status = 'done' AND overall_score IS NOT NULL
       GROUP BY site_id
     ) latest ON latest.site_id = pa.site_id AND latest.latest = pa.analyzed_at
     WHERE pa.status = 'done' AND s.domain <> 'terms-vzh0.onrender.com'
     ORDER BY pa.overall_score DESC, pa.analyzed_at DESC
     LIMIT $1`,
    [limit]
  );
  const { rows: worst } = await pool.query<{ domain: string; overall_score: number; summary: string }>(
    `SELECT s.domain, pa.overall_score, pa.summary
     FROM policy_analyses pa
     JOIN sites s ON s.id = pa.site_id
     JOIN (
       SELECT site_id, MAX(analyzed_at) AS latest
       FROM policy_analyses
       WHERE status = 'done' AND overall_score IS NOT NULL
       GROUP BY site_id
     ) latest ON latest.site_id = pa.site_id AND latest.latest = pa.analyzed_at
     WHERE pa.status = 'done' AND s.domain <> 'terms-vzh0.onrender.com'
     ORDER BY pa.overall_score ASC, pa.analyzed_at DESC
     LIMIT $1`,
    [limit]
  );
  return { best, worst };
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
