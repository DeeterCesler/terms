import { createHash } from 'crypto';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

const MAX_CHARS = 120_000;

export interface CrawlResult {
  text: string;
  contentHash: string;
  httpStatus: number;
  truncated: boolean;
}

/**
 * Normalize policy text before hashing.
 *
 * Goal: the hash should change when the actual legal language changes,
 * NOT when any of the following change:
 *
 *   - "Last updated: January 1, 2025" → date rotates every year
 *   - "© 2024 Acme Corp" → copyright year ticks over
 *   - "Version 3.1" → version bump with no language change
 *   - Extra blank lines, indentation, or trailing spaces added by CMS
 *   - Smart quotes vs straight quotes, em-dash vs hyphen (CMS rendering artefacts)
 *
 * Rules applied in order:
 *  1. Strip "Last updated / modified / revised / reviewed / changed" lines
 *  2. Strip "Effective date / Effective as of" lines
 *  3. Strip standalone "Updated: <date>" markers
 *  4. Strip copyright notices that contain a year
 *  5. Strip bare version strings (v2.1, Version 3.0.1)
 *  6. Normalize Unicode punctuation → ASCII (smart quotes, dashes, ellipsis)
 *  7. Collapse all whitespace to a single space and trim
 */
export function normalizePolicyText(raw: string): string {
  return raw
    // 1. "Last updated/modified/revised/reviewed/changed: ..." (rest of line)
    .replace(/last\s+(updated?|modified|revised|reviewed|changed)\s*[:\-–—]?[^\n]*/gi, '')
    // 2. "Effective date: ..." / "Effective as of ..." / "Effective: <date>"
    //    Note: no \s+ before the colon since "Effective:" has no space
    .replace(/effective\s*(?:date\s*[:\-]?|as\s+of\s*[:\-]?|:?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december))[^\n]*/gi, '')
    .replace(/effective\s*:[^\n]*/gi, '')
    // 3. "Updated: <date>" or bare "Updated <Month> <D>, <YYYY>" (Apple style)
    .replace(/\bupdated?\s*:\s*[^\n]*/gi, '')
    .replace(/\bupdated?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}\b[^\n]*/gi, '')
    // 4. Copyright notices containing a year: "© 2024", "Copyright 2023–2025 Acme"
    .replace(/(?:©|copyright)\s*\d{4}(?:\s*[-–—]\s*\d{4})?[^\n]*/gi, '')
    // 5. Bare version strings: "Version 2.1", "v3.0.1", "v2"
    .replace(/\bv(?:ersion\s*)?\d+(?:\.\d+)*\b/gi, '')
    // 6a. Normalize curly/smart quotes → straight
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    // 6b. Em dash, en dash, horizontal bar → hyphen
    .replace(/[–—―]/g, '-')
    // 6c. Ellipsis character → three dots
    .replace(/…/g, '...')
    // 6d. Non-breaking space → regular space
    .replace(/ /g, ' ')
    // 7. Collapse all whitespace (newlines, tabs, runs of spaces) → single space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize + truncate + hash already-extracted raw text. Shared by the
 * JSDOM extractor below and the local headless fetcher (scripts/), which
 * gets its raw text directly from Playwright's innerText.
 */
export function processRawText(
  raw: string,
  contextUrl: string,
): { text: string; contentHash: string; truncated: boolean } {
  const text = normalizePolicyText(raw);
  const truncated = text.length > MAX_CHARS;
  if (truncated) {
    console.warn(`[crawler] Truncated policy text from ${text.length} to ${MAX_CHARS} chars for ${contextUrl}`);
  }
  const stored = truncated ? text.slice(0, MAX_CHARS) : text;
  const contentHash = createHash('sha256').update(stored).digest('hex');
  return { text: stored, contentHash, truncated };
}

/**
 * Extract clean policy text from a static HTML string via JSDOM + Readability.
 * Used by the server-side crawler (fetched without a browser).
 */
export function extractPolicyText(
  html: string,
  url: string,
): { text: string; contentHash: string; truncated: boolean } {
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;

  for (const sel of ['script', 'style', 'nav', 'header', 'footer', 'aside', 'noscript', '[role="banner"]', '[role="navigation"]', '[role="complementary"]']) {
    doc.querySelectorAll(sel).forEach(el => el.remove());
  }

  const reader = new Readability(doc);
  const article = reader.parse();

  let raw: string;
  if (article?.textContent) {
    raw = article.textContent;
  } else {
    raw = doc.body?.textContent ?? '';
  }

  return processRawText(raw, url);
}

export async function crawlPolicyUrl(url: string): Promise<CrawlResult> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'PolicyChecker/1.0 (privacy policy analyzer; contact me@deetercesler.com)',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(30_000),
  });

  const html = await response.text();
  const extracted = extractPolicyText(html, url);

  return {
    ...extracted,
    httpStatus: response.status,
  };
}
