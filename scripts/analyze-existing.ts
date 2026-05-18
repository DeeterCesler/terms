/**
 * Insert a Claude-produced analysis for a category-2 policy — i.e. a row in
 * `policies` whose raw text is already in the DB but has no done
 * `policy_analyses` row yet. Reuses the existing policy_id/site_id/
 * policy_source_id (no new policies row, unlike insert-direct.ts).
 *
 * Usage:
 *   npx tsx scripts/analyze-existing.ts \
 *     --policy-id <uuid> \
 *     --analysis-file <path> \
 *     [--model-used claude-opus-4-7-claudecode]
 */
import 'dotenv/config';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') });

import { readFileSync } from 'fs';
import { AnalysisResultSchema, PROMPT_VERSION, type AnalysisResult } from '../packages/shared/src/index.js';
import { insertAnalysis } from '../packages/api/src/db/queries/analyses.js';
import { pool } from '../packages/api/src/db/client.js';

function getFlag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const policyId = getFlag('--policy-id');
  const analysisFile = getFlag('--analysis-file');
  const modelUsed = getFlag('--model-used') ?? 'claude-opus-4-7-claudecode';

  if (!policyId || !analysisFile) {
    console.error('Usage: tsx scripts/analyze-existing.ts --policy-id <uuid> --analysis-file <path> [--model-used ...]');
    process.exit(1);
  }

  const lookup = await pool.query<{
    site_id: string;
    policy_source_id: string;
    domain: string;
    url: string;
  }>(`
    SELECT ps.site_id, ps.id AS policy_source_id, s.domain, ps.url
    FROM policies p
    JOIN policy_sources ps ON ps.id = p.policy_source_id
    JOIN sites s ON s.id = ps.site_id
    WHERE p.id = $1
  `, [policyId]);

  const ctx = lookup.rows[0];
  if (!ctx) {
    console.error(`No policies row found for id=${policyId}`);
    process.exit(1);
  }

  const existing = await pool.query<{ id: string }>(
    `SELECT id FROM policy_analyses WHERE policy_id = $1 AND status = 'done' LIMIT 1`,
    [policyId]
  );
  if (existing.rows[0]) {
    console.error(`Policy ${policyId} already has a done analysis (${existing.rows[0].id}). Refusing to overwrite.`);
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(analysisFile, 'utf8'));
  const parsed: AnalysisResult = AnalysisResultSchema.parse(raw);

  const analysisRow = await insertAnalysis(
    policyId,
    ctx.site_id,
    ctx.policy_source_id,
    parsed,
    { source: 'claudecode-analyze-existing', analyzedAt: new Date().toISOString() },
    modelUsed,
    PROMPT_VERSION,
  );

  console.log(JSON.stringify({
    ok: true,
    domain: ctx.domain,
    url: ctx.url,
    policyId,
    siteId: ctx.site_id,
    policySourceId: ctx.policy_source_id,
    analysisId: analysisRow.id,
    overallScore: parsed.overall_score,
  }, null, 2));

  await pool.end();
}

main().catch(async err => {
  console.error(`[analyze-existing] ${(err as Error).message}`);
  try { await pool.end(); } catch {}
  process.exit(1);
});
