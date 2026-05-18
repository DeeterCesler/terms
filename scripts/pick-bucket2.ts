/**
 * Pick N "category 2" policies (raw fetched but not analyzed) and dump their
 * existing raw text from the DB to /tmp/bucket2/<domain>-<policy_type>.txt.
 *
 * Outputs an index to stdout listing policy_id + url + char_count + text path
 * for each — feed each text into Claude for analysis, save the JSON, then run
 *   scripts/analyze-existing.ts --policy-id <id> --analysis-file <path>
 *
 * Usage:
 *   npx tsx scripts/pick-bucket2.ts [N=5] [--min-chars 5000] [--max-chars 200000]
 *     [--policy-type privacy_policy] [--order desc|asc]
 */
import 'dotenv/config';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') });

import { mkdirSync, writeFileSync } from 'fs';
import { pool } from '../packages/api/src/db/client.js';

function getFlag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const positional = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const n = parseInt(positional[0] ?? '5', 10);
  const minChars = parseInt(getFlag('--min-chars') ?? '5000', 10);
  const maxChars = parseInt(getFlag('--max-chars') ?? '500000', 10);
  const policyType = getFlag('--policy-type');
  const order = (getFlag('--order') ?? 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const params: any[] = [minChars, maxChars];
  let where = `p.is_current = TRUE
               AND p.char_count BETWEEN $1 AND $2
               AND NOT EXISTS (
                 SELECT 1 FROM policy_analyses pa
                 WHERE pa.policy_id = p.id AND pa.status = 'done'
               )`;
  if (policyType) {
    params.push(policyType);
    where += ` AND ps.policy_type = $${params.length}`;
  }
  params.push(n);

  const { rows } = await pool.query<{
    policy_id: string;
    site_id: string;
    policy_source_id: string;
    domain: string;
    url: string;
    policy_type: string;
    char_count: number;
    raw_text: string;
  }>(`
    SELECT
      p.id AS policy_id,
      ps.site_id,
      ps.id AS policy_source_id,
      s.domain,
      ps.url,
      ps.policy_type,
      p.char_count,
      p.raw_text
    FROM policies p
    JOIN policy_sources ps ON ps.id = p.policy_source_id
    JOIN sites s ON s.id = ps.site_id
    WHERE ${where}
    ORDER BY p.char_count ${order}
    LIMIT $${params.length}
  `, params);

  const outDir = '/tmp/bucket2';
  mkdirSync(outDir, { recursive: true });

  console.log(`Picked ${rows.length} category-2 row(s) (char_count ${order}, ${minChars}-${maxChars}${policyType ? `, type=${policyType}` : ''}):\n`);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    const safeDomain = r.domain.replace(/[^a-z0-9.-]/gi, '_');
    const textPath = `${outDir}/${safeDomain}-${r.policy_type}.txt`;
    writeFileSync(textPath, r.raw_text, 'utf8');
    console.log(`[${i + 1}] ${r.domain} (${r.policy_type}) — ${r.char_count} chars`);
    console.log(`    policy_id: ${r.policy_id}`);
    console.log(`    url:       ${r.url}`);
    console.log(`    text:      ${textPath}`);
    console.log('');
  }

  await pool.end();
}

main().catch(async err => {
  console.error(`[pick-bucket2] ${(err as Error).message}`);
  try { await pool.end(); } catch {}
  process.exit(1);
});
