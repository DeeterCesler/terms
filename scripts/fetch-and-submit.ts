/**
 * Fetches a policy URL locally and submits the cleaned text to the
 * deployed API's /admin/sites/:domain/analyze-raw endpoint. The Anthropic
 * call happens server-side; this script never touches an Anthropic key.
 *
 * Usage:
 *   ADMIN_SECRET=... API_BASE_URL=https://terms-vzh0.onrender.com \
 *     npx tsx scripts/fetch-and-submit.ts [--headless] <policyUrl> [domain]
 *
 * --headless: render the page in a real Chromium via Playwright (needed for
 *   SPA / JS-rendered policies). Run `npx playwright install chromium` once.
 */
import { crawlPolicyUrl, processRawText } from '../packages/api/src/services/crawler.js';
import { extractDomainFromUrl, normalizeDomain } from '../packages/api/src/utils/domain.js';

interface CrawlResult {
  text: string;
  contentHash: string;
  httpStatus: number;
  truncated: boolean;
}

const argv = process.argv.slice(2);
const headless = argv.includes('--headless');
const positional = argv.filter(a => !a.startsWith('--'));
const [policyUrl, domainArg] = positional;

if (!policyUrl) {
  console.error('Usage: tsx scripts/fetch-and-submit.ts [--headless] <policyUrl> [domain]');
  process.exit(1);
}

const apiBase = process.env.API_BASE_URL;
const adminSecret = process.env.ADMIN_SECRET;
if (!apiBase || !adminSecret) {
  console.error('Missing API_BASE_URL or ADMIN_SECRET');
  process.exit(1);
}

const COOKIE_SELECTORS = [
  '#onetrust-accept-btn-handler',
  '.optanon-allow-all',
  '#CybotCookiebotDialogBodyButtonAccept',
  '#CybotCookiebotDialogBodyLevelButtonAccept',
  '#truste-consent-button',
  'button[aria-label*="accept all" i]',
  'button[aria-label*="allow all" i]',
  'button[id*="accept" i]',
];

const COOKIE_TEXTS = ['Accept all', 'Allow all', 'I agree', 'Accept', 'OK'];

async function dismissCookieBanners(page: import('playwright').Page) {
  for (const sel of COOKIE_SELECTORS) {
    try {
      const el = await page.$(sel);
      if (el && (await el.isVisible())) {
        await el.click({ timeout: 1000 });
        console.log(`[headless] dismissed cookie banner via ${sel}`);
        await page.waitForTimeout(300);
        return;
      }
    } catch {}
  }
  for (const text of COOKIE_TEXTS) {
    try {
      const btn = page.getByRole('button', { name: new RegExp(`^${text}$`, 'i') }).first();
      if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
        await btn.click({ timeout: 1000 });
        console.log(`[headless] dismissed cookie banner via text "${text}"`);
        await page.waitForTimeout(300);
        return;
      }
    } catch {}
  }
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
    await dismissCookieBanners(page);
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(500);
    // Use rendered visible text directly: Readability over-strips on sites
    // that wrap policy content in <aside>/<header> elements.
    const raw = await page.evaluate(() => document.body.innerText);
    const extracted = processRawText(raw, url);
    return { ...extracted, httpStatus };
  } finally {
    await browser.close();
  }
}

async function main() {
  const domain = domainArg
    ? normalizeDomain(domainArg)
    : extractDomainFromUrl(policyUrl);
  if (!domain) {
    console.error(`Could not derive domain from ${policyUrl}`);
    process.exit(1);
  }

  console.log(`[fetch] ${headless ? '[headless] ' : ''}${policyUrl}`);
  const crawl = headless ? await crawlHeadless(policyUrl) : await crawlPolicyUrl(policyUrl);
  console.log(`[fetch] status=${crawl.httpStatus} chars=${crawl.text.length} truncated=${crawl.truncated}`);

  if (crawl.text.length < 1000) {
    console.warn(`[fetch] WARNING: very short text (${crawl.text.length} chars). ${headless ? 'Even headless extraction failed.' : 'Try --headless if this is SPA.'}`);
  }

  console.log(`[submit] POST ${apiBase}/admin/sites/${domain}/analyze-raw`);
  const res = await fetch(`${apiBase}/admin/sites/${domain}/analyze-raw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Secret': adminSecret!,
    },
    body: JSON.stringify({
      policyUrl,
      policyText: crawl.text,
      policyType: 'privacy_policy',
    }),
  });

  const body = await res.text();
  console.log(`[submit] HTTP ${res.status}`);
  console.log(body);
  process.exit(res.ok ? 0 : 1);
}

main();
