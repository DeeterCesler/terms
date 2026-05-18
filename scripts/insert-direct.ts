/**
 * Insert a Claude-analyzed policy directly into Neon — bypasses the Render
 * /admin/sites/:domain/analyze-raw handler when its Anthropic-side analyzer
 * is broken. Mirrors the upsert chain that admin.ts does, except the
 * analysis JSON is supplied (analyzed externally) rather than computed.
 *
 * Usage:
 *   npx tsx scripts/insert-direct.ts \
 *     --domain <domain> \
 *     --url <policyUrl> \
 *     --text-file <path> \
 *     --analysis-file <path> \
 *     [--policy-type privacy_policy|terms_of_service|...] \
 *     [--product <name>] \
 *     [--model-used <label>]
 */
import 'dotenv/config';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') });

import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { z } from 'zod';
import { AnalysisResultSchema, PROMPT_VERSION, type AnalysisResult } from '../packages/shared/src/index.js';
import { normalizeDomain } from '../packages/api/src/utils/domain.js';
import { getSiteByDomain, createSite } from '../packages/api/src/db/queries/sites.js';
import { upsertPolicySource } from '../packages/api/src/db/queries/policy_sources.js';
import { insertNewPolicy } from '../packages/api/src/db/queries/policies.js';
import { insertAnalysis } from '../packages/api/src/db/queries/analyses.js';
import { pool } from '../packages/api/src/db/client.js';

type Flag =
  | '--domain'
  | '--url'
  | '--text-file'
  | '--analysis-file'
  | '--policy-type'
  | '--product'
  | '--model-used'
  | '--name';

function getFlag(name: Flag): string | undefined {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

const POLICY_TYPES = new Set([
  'privacy_policy',
  'terms_of_service',
  'cookie_policy',
  'data_processing_agreement',
  'acceptable_use_policy',
  'other',
]);

async function main() {
  const domainArg = getFlag('--domain');
  const policyUrl = getFlag('--url');
  const textFile = getFlag('--text-file');
  const analysisFile = getFlag('--analysis-file');
  const policyType = getFlag('--policy-type') ?? 'privacy_policy';
  const product = getFlag('--product') ?? null;
  const modelUsed = getFlag('--model-used') ?? 'claude-opus-4-7-claudecode';
  const siteName = getFlag('--name') ?? null;

  if (!domainArg || !policyUrl || !textFile || !analysisFile) {
    console.error('Missing required flag. See header for usage.');
    process.exit(1);
  }
  if (!POLICY_TYPES.has(policyType)) {
    console.error(`Invalid --policy-type: ${policyType}`);
    process.exit(1);
  }

  const domain = normalizeDomain(domainArg);
  if (!domain) {
    console.error(`Invalid domain: ${domainArg}`);
    process.exit(1);
  }

  const policyText = readFileSync(textFile, 'utf8');
  const analysisRaw = JSON.parse(readFileSync(analysisFile, 'utf8'));

  const parsed: AnalysisResult = AnalysisResultSchema.parse(analysisRaw);

  let site = await getSiteByDomain(domain);
  if (!site) {
    site = await createSite(domain, siteName);
  }

  const source = await upsertPolicySource(site.id, policyUrl, policyType as any, product);
  const contentHash = createHash('sha256').update(policyText).digest('hex');
  const policy = await insertNewPolicy(source.id, policyText, contentHash, null);

  const analysisRow = await insertAnalysis(
    policy.id,
    site.id,
    source.id,
    parsed,
    { source: 'claudecode-direct', analyzedAt: new Date().toISOString() },
    modelUsed,
    PROMPT_VERSION,
  );

  console.log(JSON.stringify({
    ok: true,
    domain,
    siteId: site.id,
    policySourceId: source.id,
    policyId: policy.id,
    analysisId: analysisRow.id,
    overallScore: parsed.overall_score,
  }, null, 2));

  await pool.end();
}

main().catch(async err => {
  console.error(`[insert-direct] ${(err as Error).message}`);
  try { await pool.end(); } catch {}
  process.exit(1);
});
