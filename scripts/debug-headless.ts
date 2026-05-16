import { chromium } from 'playwright';

async function main() {
  const url = process.argv[2] ?? 'https://values.snap.com/privacy/privacy-policy';
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
  });
  const page = await context.newPage();
  console.log(`Loading ${url}...`);
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  console.log(`HTTP ${response?.status()}`);

  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(1500);

  // Snapshot raw rendered HTML size and visible text
  const html = await page.content();
  const visibleText = await page.evaluate(() => document.body.innerText);
  console.log(`html_size=${html.length}`);
  console.log(`visible_text_size=${visibleText.length}`);
  console.log('--- first 500 chars of visible text ---');
  console.log(visibleText.slice(0, 500));

  await browser.close();
}
main();
