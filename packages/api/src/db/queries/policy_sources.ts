import { pool } from '../client.js';
import type { PolicySourceRow, PolicyType } from '@term-checker/shared';

export async function getPolicySourceByUrl(url: string): Promise<PolicySourceRow | null> {
  const { rows } = await pool.query<PolicySourceRow>(
    'SELECT * FROM policy_sources WHERE url = $1',
    [url]
  );
  return rows[0] ?? null;
}

export async function listPolicySourcesBySite(siteId: string): Promise<PolicySourceRow[]> {
  const { rows } = await pool.query<PolicySourceRow>(
    'SELECT * FROM policy_sources WHERE site_id = $1 ORDER BY created_at ASC',
    [siteId]
  );
  return rows;
}

export async function upsertPolicySource(
  siteId: string,
  url: string,
  policyType: PolicyType,
  product?: string | null,
): Promise<PolicySourceRow> {
  const { rows } = await pool.query<PolicySourceRow>(
    `INSERT INTO policy_sources (site_id, url, policy_type, product)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (url) DO UPDATE SET
       policy_type = EXCLUDED.policy_type,
       product     = EXCLUDED.product,
       updated_at  = NOW()
     RETURNING *`,
    [siteId, url, policyType, product ?? null]
  );
  const source = rows[0]!;
  // Always mirror into the junction so the M:N table is authoritative for
  // "which sites does this source apply to". is_primary=TRUE on the row whose
  // site_id matches the original upserting site.
  await pool.query(
    `INSERT INTO policy_source_sites (policy_source_id, site_id, is_primary)
     VALUES ($1, $2, TRUE)
     ON CONFLICT (policy_source_id, site_id) DO NOTHING`,
    [source.id, siteId]
  );
  return source;
}

export async function linkSiteToSource(sourceId: string, siteId: string): Promise<void> {
  await pool.query(
    `INSERT INTO policy_source_sites (policy_source_id, site_id, is_primary)
     VALUES ($1, $2, FALSE)
     ON CONFLICT (policy_source_id, site_id) DO NOTHING`,
    [sourceId, siteId]
  );
}

export async function unlinkSiteFromSource(sourceId: string, siteId: string): Promise<void> {
  await pool.query(
    `DELETE FROM policy_source_sites WHERE policy_source_id = $1 AND site_id = $2`,
    [sourceId, siteId]
  );
}

export async function getSitesForSource(
  sourceId: string,
): Promise<Array<{ id: string; domain: string; name: string | null; is_primary: boolean }>> {
  const { rows } = await pool.query<{ id: string; domain: string; name: string | null; is_primary: boolean }>(
    `SELECT s.id, s.domain, s.name, pss.is_primary
     FROM policy_source_sites pss
     JOIN sites s ON s.id = pss.site_id
     WHERE pss.policy_source_id = $1
     ORDER BY pss.is_primary DESC, s.domain ASC`,
    [sourceId]
  );
  return rows;
}
