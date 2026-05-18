/**
 * Fetch policy text only — no submit. Mirrors fetch-and-submit.ts crawl logic
 * (static via Readability, optional --headless via Playwright) and writes the
 * extracted text to <outFile> (or prints to stdout when --stdout).
 *
 * Usage:
 *   npx tsx scripts/fetch-text.ts [--headless] <policyUrl> <outFile>
 *   npx tsx scripts/fetch-text.ts [--headless] --stdout <policyUrl>
 *
 * Exits 0 on success, 1 on failure. Prints chars=, status=, truncated= to
 * stderr so callers can decide whether to retry headless.
 */
import { writeFileSync } from 'fs';
import { crawlPolicyUrl, processRawText } from '../packages/api/src/services/crawler.js';

interface CrawlResult {
  text: string;
  contentHash: string;
  httpStatus: number;
  truncated: boolean;
}

const argv = process.argv.slice(2);
const headless = argv.includes('--headless');
const toStdout = argv.includes('--stdout');
const positional = argv.filter(a => !a.startsWith('--'));
const [policyUrl, outFile] = positional;

if (!policyUrl || (!toStdout && !outFile)) {
  console.error('Usage: tsx scripts/fetch-text.ts [--headless] <policyUrl> <outFile>');
  console.error('   or: tsx scripts/fetch-text.ts [--headless] --stdout <policyUrl>');
  process.exit(1);
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
  const crawl = headless ? await crawlHeadless(policyUrl) : await crawlPolicyUrl(policyUrl);
  console.error(`status=${crawl.httpStatus} chars=${crawl.text.length} truncated=${crawl.truncated}`);
  if (toStdout) {
    process.stdout.write(crawl.text);
  } else {
    writeFileSync(outFile, crawl.text, 'utf8');
    console.error(`wrote ${crawl.text.length} chars to ${outFile}`);
  }
  process.exit(0);
}

main().catch(err => {
  console.error(`[fetch-text] ${(err as Error).message}`);
  process.exit(1);
});
