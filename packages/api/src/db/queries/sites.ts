import { pool, type Queryable } from '../client.js';
import type { SiteRow } from '@term-checker/shared';

export async function getSiteByDomain(
  domain: string,
  db: Queryable = pool,
): Promise<SiteRow | null> {
  const { rows } = await db.query<SiteRow>(
    'SELECT * FROM sites WHERE domain = $1',
    [domain]
  );
  return rows[0] ?? null;
}

export async function createSite(
  domain: string,
  name?: string | null,
  db: Queryable = pool,
): Promise<SiteRow> {
  const { rows } = await db.query<SiteRow>(
    `INSERT INTO sites (domain, name) VALUES ($1, $2) RETURNING *`,
    [domain, name ?? null]
  );
  return rows[0]!;
}

export async function listSites(limit = 50, offset = 0): Promise<SiteRow[]> {
  const { rows } = await pool.query<SiteRow>(
    'SELECT * FROM sites ORDER BY created_at DESC LIMIT $1 OFFSET $2',
    [limit, offset]
  );
  return rows;
}

export async function countSites(): Promise<number> {
  const { rows } = await pool.query<{ count: string }>('SELECT COUNT(*) AS count FROM sites');
  return parseInt(rows[0]!.count, 10);
}

// Every domain that shares a policy source with the given domain, including the
// domain itself. Walks the policy_source_sites junction both ways so a shared
// corporate policy (e.g. anthropic.com's notice covering claude.ai) returns all
// member brands. Used to invalidate the /check cache for every affected site
// when one of them is re-analyzed. Returns [] if the domain isn't a known site.
export async function getSiblingDomains(domain: string): Promise<string[]> {
  const { rows } = await pool.query<{ domain: string }>(
    `SELECT DISTINCT s2.domain
     FROM sites s1
     JOIN policy_source_sites pss1 ON pss1.site_id = s1.id
     JOIN policy_source_sites pss2 ON pss2.policy_source_id = pss1.policy_source_id
     JOIN sites s2 ON s2.id = pss2.site_id
     WHERE s1.domain = $1`,
    [domain]
  );
  return rows.map(r => r.domain);
}

export async function deleteSite(domain: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM sites WHERE domain = $1',
    [domain]
  );
  return (rowCount ?? 0) > 0;
}
