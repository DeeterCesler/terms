import { pool } from '../client.js';
import type { SiteRow } from '@term-checker/shared';

export async function getSiteByDomain(domain: string): Promise<SiteRow | null> {
  const { rows } = await pool.query<SiteRow>(
    'SELECT * FROM sites WHERE domain = $1',
    [domain]
  );
  return rows[0] ?? null;
}

export async function createSite(domain: string, name?: string | null): Promise<SiteRow> {
  const { rows } = await pool.query<SiteRow>(
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

export async function deleteSite(domain: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM sites WHERE domain = $1',
    [domain]
  );
  return (rowCount ?? 0) > 0;
}
