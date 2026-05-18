/**
 * Fetch a privacy policy and store the raw text in the DB — no analysis.
 * Upserts the sites and policy_sources rows, inserts a fresh policies row.
 * Idempotent on policy_sources (UNIQUE on url) but always inserts a new
 * policies row marking previous ones is_current=false.
 *
 * Usage:
 *   npx tsx scripts/fetch-and-store.ts [--headless] \
 *     --url <policyUrl> --domain <domain> \
 *     [--policy-type privacy_policy|terms_of_service|...] \
 *     [--product <name>] [--name <site display name>]
 *
 * Prints a single-line JSON result on success:
 *   {"ok":true,"domain":"...","status":"static|headless","chars":12345,"httpStatus":200}
 * Prints "thin" status if chars < MIN_CHARS (default 1500) — caller can
 * decide whether to flag as SPA/blocked. Exits non-zero on hard fetch failure.
 */
import 'dotenv/config';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') });

import { createHash } from 'crypto';
import { crawlPolicyUrl, processRawText } from '../packages/api/src/services/crawler.js';
import { normalizeDomain } from '../packages/api/src/utils/domain.js';
import { getSiteByDomain, createSite } from '../packages/api/src/db/queries/sites.js';
import { upsertPolicySource } from '../packages/api/src/db/queries/policy_sources.js';
import { insertNewPolicy } from '../packages/api/src/db/queries/policies.js';
import { pool } from '../packages/api/src/db/client.js';

interface CrawlResult {
  text: string;
  contentHash: string;
  httpStatus: number;
  truncated: boolean;
}

const POLICY_TYPES = new Set([
  'privacy_policy',
  'terms_of_service',
  'cookie_policy',
  'data_processing_agreement',
  'acceptable_use_policy',
  'other',
]);

const MIN_CHARS = parseInt(process.env.MIN_CHARS ?? '1500', 10);

function getFlag(name: string): string | undefined {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

async function crawlHeadless(url: string): Promise<CrawlResult> {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 900 },
      locale: 'en-US',
    });
    const page = await context.newPage();
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    const httpStatus = response?.status() ?? 0;
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(500);
    const raw = await page.evaluate(() => document.body.innerText);
    const extracted = processRawText(raw, url);
    return { ...extracted, httpStatus };
  } finally {
    await browser.close();
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const headless = argv.includes('--headless');
  const url = getFlag('--url');
  const domainArg = getFlag('--domain');
  const policyType = getFlag('--policy-type') ?? 'privacy_policy';
  const product = getFlag('--product') ?? null;
  const siteName = getFlag('--name') ?? null;

  if (!url || !domainArg) {
    console.error('Usage: tsx scripts/fetch-and-store.ts [--headless] --url <policyUrl> --domain <domain> [--policy-type ...] [--product ...] [--name ...]');
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

  const crawl = headless ? await crawlHeadless(url) : await crawlPolicyUrl(url);
  const status = headless ? 'headless' : 'static';
  const thin = crawl.text.length < MIN_CHARS;

  // Always store, even if thin — record what we got plus the http status so a
  // later pass can decide what to retry.
  let site = await getSiteByDomain(domain);
  if (!site) site = await createSite(domain, siteName);
  const source = await upsertPolicySource(site.id, url, policyType as any, product);
  const contentHash = createHash('sha256').update(crawl.text).digest('hex');
  const policyRow = await insertNewPolicy(source.id, crawl.text, contentHash, crawl.httpStatus);

  const result = {
    ok: true,
    domain,
    siteId: site.id,
    policySourceId: source.id,
    policyId: policyRow.id,
    status,
    chars: crawl.text.length,
    httpStatus: crawl.httpStatus,
    truncated: crawl.truncated,
    thin,
  };
  console.log(JSON.stringify(result));

  await pool.end();
  process.exit(0);
}

main().catch(async err => {
  console.log(JSON.stringify({ ok: false, error: (err as Error).message }));
  try { await pool.end(); } catch {}
  process.exit(1);
});
