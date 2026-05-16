/**
 * Tests the crawler + normalization pipeline directly, no AI analysis.
 * Useful for verifying hash stability without burning API quota.
 */
import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') });

import { crawlPolicyUrl, normalizePolicyText } from '../packages/api/src/services/crawler.js';

const URLS = [
  { label: 'Google Privacy',    url: 'https://policies.google.com/privacy' },
  { label: 'Apple Privacy',     url: 'https://www.apple.com/legal/privacy/en-ww/' },
  { label: 'Reddit Privacy',    url: 'https://www.reddit.com/policies/privacy-policy' },
  { label: 'Discord Privacy',   url: 'https://discord.com/privacy' },
  { label: 'DuckDuckGo Privacy', url: 'https://duckduckgo.com/privacy' },
];

async function run() {
  for (const { label, url } of URLS) {
    process.stdout.write(`Crawling ${label}... `);
    try {
      const result = await crawlPolicyUrl(url);
      console.log(`✓`);
      console.log(`  status:    ${result.httpStatus}`);
      console.log(`  chars:     ${result.text.length.toLocaleString()}${result.truncated ? ' (truncated)' : ''}`);
      console.log(`  hash:      ${result.contentHash}`);
      console.log(`  preview:   ${result.text.slice(0, 120)}...`);
      console.log();
    } catch (err) {
      console.log(`✗  ${(err as Error).message}`);
      console.log();
    }
  }
}

run();
