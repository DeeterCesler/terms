/**
 * Prints a three-bucket snapshot of every candidate / policy / analysis in
 * the DB:
 *
 *   1. CANDIDATES NOT STARTED — policy_candidates rows with no matching
 *      sites row (still on the wishlist).
 *   2. RAW FETCHED BUT NOT ANALYZED — policies rows with no associated
 *      policy_analyses row in status='done' (insert-direct.ts failed
 *      midway, or an old worker-era fetch never finished).
 *   3. ANALYZED — head of policy_analyses where status='done'.
 *
 * Usage:
 *   npx tsx scripts/status.ts
 *   npx tsx scripts/status.ts --limit 30      # cap the lists
 *   npx tsx scripts/status.ts --all           # print all rows, no head
 */
import 'dotenv/config';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') });

import { pool } from '../packages/api/src/db/client.js';

const argv = process.argv.slice(2);
const showAll = argv.includes('--all');
const limitFlagIdx = argv.indexOf('--limit');
const LIMIT = showAll
  ? Number.MAX_SAFE_INTEGER
  : (limitFlagIdx >= 0 ? parseInt(argv[limitFlagIdx + 1] ?? '15', 10) : 15);

function head<T>(rows: T[]): { shown: T[]; rest: number } {
  if (rows.length <= LIMIT) return { shown: rows, rest: 0 };
  return { shown: rows.slice(0, LIMIT), rest: rows.length - LIMIT };
}

async function main() {
  const candidatesNotStarted = await pool.query<{
    domain: string;
    priority: number;
    policy_type: string;
    product: string | null;
    name: string | null;
  }>(`
    SELECT pc.domain, pc.priority, pc.policy_type, pc.product, pc.name
    FROM policy_candidates pc
    LEFT JOIN sites s ON s.domain = pc.domain
    WHERE s.id IS NULL
    ORDER BY pc.priority ASC, pc.domain ASC
  `);

  const rawWithoutAnalysis = await pool.query<{
    domain: string;
    url: string;
    policy_type: string;
    fetched_at: Date;
    char_count: number;
    last_status: string | null;
    last_error: string | null;
  }>(`
    SELECT
      s.domain,
      ps.url,
      ps.policy_type,
      p.fetched_at,
      p.char_count,
      (
        SELECT pa.status FROM policy_analyses pa
        WHERE pa.policy_id = p.id
        ORDER BY pa.created_at DESC
        LIMIT 1
      ) AS last_status,
      (
        SELECT pa.error_message FROM policy_analyses pa
        WHERE pa.policy_id = p.id
        ORDER BY pa.created_at DESC
        LIMIT 1
      ) AS last_error
    FROM policies p
    JOIN policy_sources ps ON ps.id = p.policy_source_id
    JOIN sites s ON s.id = ps.site_id
    WHERE NOT EXISTS (
      SELECT 1 FROM policy_analyses pa
      WHERE pa.policy_id = p.id AND pa.status = 'done'
    )
    ORDER BY p.fetched_at DESC
  `);

  const analyzed = await pool.query<{
    domain: string;
    overall_score: number | null;
    analyzed_at: Date;
    url: string;
  }>(`
    SELECT s.domain, pa.overall_score, pa.analyzed_at, ps.url
    FROM policy_analyses pa
    JOIN sites s ON s.id = pa.site_id
    JOIN policy_sources ps ON ps.id = pa.policy_source_id
    WHERE pa.status = 'done'
    ORDER BY pa.analyzed_at DESC
  `);

  const totals = await pool.query<{ sites: string; sources: string; policies: string }>(`
    SELECT
      (SELECT COUNT(*) FROM sites)::text AS sites,
      (SELECT COUNT(*) FROM policy_sources)::text AS sources,
      (SELECT COUNT(*) FROM policies)::text AS policies
  `);

  const t = totals.rows[0]!;
  console.log(`DB totals: ${t.sites} sites, ${t.sources} policy sources, ${t.policies} raw policies on file`);
  console.log('');

  console.log(`=== 1. CANDIDATES NOT STARTED — ${candidatesNotStarted.rows.length} ===`);
  const c = head(candidatesNotStarted.rows);
  for (const r of c.shown) {
    console.log(`  p${r.priority} ${r.domain}${r.product ? ' / ' + r.product : ''} (${r.policy_type})`);
  }
  if (c.rest) console.log(`  ...and ${c.rest} more (use --limit N or --all)`);
  console.log('');

  console.log(`=== 2. RAW FETCHED BUT NOT ANALYZED — ${rawWithoutAnalysis.rows.length} ===`);
  const r = head(rawWithoutAnalysis.rows);
  for (const row of r.shown) {
    const tag = row.last_status
      ? `[${row.last_status}${row.last_error ? ': ' + String(row.last_error).slice(0, 80) : ''}]`
      : '[no analysis row yet]';
    console.log(`  ${row.domain} — ${row.char_count} chars — ${tag}`);
  }
  if (r.rest) console.log(`  ...and ${r.rest} more`);
  console.log('');

  console.log(`=== 3. ANALYZED (status='done') — ${analyzed.rows.length} ===`);
  const a = head(analyzed.rows);
  for (const row of a.shown) {
    const date = row.analyzed_at.toISOString().slice(0, 10);
    const score = row.overall_score ?? '-';
    console.log(`  score=${score} ${row.domain} (${date})`);
  }
  if (a.rest) console.log(`  ...and ${a.rest} more`);

  await pool.end();
}

main().catch(async err => {
  console.error('[status] ' + (err as Error).message);
  try { await pool.end(); } catch {}
  process.exit(1);
});
