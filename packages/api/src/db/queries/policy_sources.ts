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
  return rows[0]!;
}
