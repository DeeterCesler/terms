import { pool } from '../client.js';
import type { PolicyCandidateRow, PolicyType } from '@term-checker/shared';

export async function listCandidates(): Promise<PolicyCandidateRow[]> {
  const { rows } = await pool.query<PolicyCandidateRow>(
    'SELECT * FROM policy_candidates ORDER BY priority, added_at'
  );
  return rows;
}

export async function listPendingCandidates(): Promise<PolicyCandidateRow[]> {
  // Candidates that don't yet have a completed analysis.
  // Matched against policy_sources by URL (if known) or by domain + type + product.
  const { rows } = await pool.query<PolicyCandidateRow>(`
    SELECT c.*
    FROM policy_candidates c
    WHERE NOT EXISTS (
      SELECT 1
      FROM policy_sources ps
      JOIN sites s ON s.id = ps.site_id
      JOIN policy_analyses pa ON pa.policy_source_id = ps.id AND pa.status = 'done'
      WHERE
        s.domain = c.domain
        AND ps.policy_type = c.policy_type
        AND ps.product IS NOT DISTINCT FROM c.product
        AND (c.url IS NULL OR ps.url = c.url)
    )
    ORDER BY c.priority, c.added_at
  `);
  return rows;
}

export async function getCandidateByDomain(
  domain: string,
  policyType: PolicyType = 'privacy_policy',
): Promise<PolicyCandidateRow | null> {
  const { rows } = await pool.query<PolicyCandidateRow>(
    `SELECT * FROM policy_candidates
     WHERE domain = $1 AND policy_type = $2
     ORDER BY added_at ASC
     LIMIT 1`,
    [domain, policyType]
  );
  return rows[0] ?? null;
}

export async function addCandidate(
  domain: string,
  policyType: PolicyType,
  opts: {
    name?: string | null;
    product?: string | null;
    url?: string | null;
    priority?: number;
    notes?: string | null;
    // Mark the row as awaiting a re-check. Only meaningful for domains we have
    // already analyzed; a first-time request leaves it NULL.
    refreshRequested?: boolean;
  } = {},
): Promise<PolicyCandidateRow> {
  const { rows } = await pool.query<PolicyCandidateRow>(
    `INSERT INTO policy_candidates (domain, policy_type, name, product, url, priority, notes, refresh_requested_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $8::boolean THEN NOW() ELSE NULL END)
     ON CONFLICT (domain, policy_type, COALESCE(product, ''))
     DO UPDATE SET
       name     = COALESCE(EXCLUDED.name,    policy_candidates.name),
       url      = COALESCE(EXCLUDED.url,     policy_candidates.url),
       priority = EXCLUDED.priority,
       notes    = COALESCE(EXCLUDED.notes,   policy_candidates.notes),
       -- Keep the first pending refresh timestamp: repeat clicks shouldn't
       -- push the row to the back of an added_at-ordered queue.
       refresh_requested_at = COALESCE(policy_candidates.refresh_requested_at, EXCLUDED.refresh_requested_at)
     RETURNING *`,
    [
      domain,
      policyType,
      opts.name ?? null,
      opts.product ?? null,
      opts.url ?? null,
      opts.priority ?? 5,
      opts.notes ?? null,
      opts.refreshRequested === true,
    ]
  );
  return rows[0]!;
}

// Rows a user asked us to re-check. Unlike listPendingCandidates these are
// domains we already have an analysis for, so the "uncovered" predicate every
// batch query uses will never surface them.
export async function listRefreshRequested(): Promise<PolicyCandidateRow[]> {
  const { rows } = await pool.query<PolicyCandidateRow>(
    `SELECT * FROM policy_candidates
     WHERE refresh_requested_at IS NOT NULL
     ORDER BY refresh_requested_at ASC`
  );
  return rows;
}

// Called by the refresh runner once the source has been re-fetched, whether or
// not the content actually changed - the request has been serviced either way.
export async function clearRefreshRequest(id: string): Promise<void> {
  await pool.query(
    'UPDATE policy_candidates SET refresh_requested_at = NULL WHERE id = $1',
    [id]
  );
}

export async function removeCandidate(id: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM policy_candidates WHERE id = $1',
    [id]
  );
  return (rowCount ?? 0) > 0;
}
