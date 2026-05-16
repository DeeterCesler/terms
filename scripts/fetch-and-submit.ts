/**
 * Fetches a policy URL locally and submits the cleaned text to the
 * deployed API's /admin/sites/:domain/analyze-raw endpoint. The Anthropic
 * call happens server-side; this script never touches an Anthropic key.
 *
 * Usage:
 *   ADMIN_SECRET=... API_BASE_URL=https://terms-vzh0.onrender.com \
 *     npx tsx scripts/fetch-and-submit.ts <policyUrl> [domain]
 */
import { crawlPolicyUrl } from '../packages/api/src/services/crawler.js';
import { extractDomainFromUrl, normalizeDomain } from '../packages/api/src/utils/domain.js';

const [, , policyUrl, domainArg] = process.argv;
if (!policyUrl) {
  console.error('Usage: tsx scripts/fetch-and-submit.ts <policyUrl> [domain]');
  process.exit(1);
}

const apiBase = process.env.API_BASE_URL;
const adminSecret = process.env.ADMIN_SECRET;
if (!apiBase || !adminSecret) {
  console.error('Missing API_BASE_URL or ADMIN_SECRET');
  process.exit(1);
}

async function main() {
  const domain = domainArg
    ? normalizeDomain(domainArg)
    : extractDomainFromUrl(policyUrl);
  if (!domain) {
    console.error(`Could not derive domain from ${policyUrl}`);
    process.exit(1);
  }

  console.log(`[fetch] ${policyUrl}`);
  const crawl = await crawlPolicyUrl(policyUrl);
  console.log(`[fetch] status=${crawl.httpStatus} chars=${crawl.text.length} truncated=${crawl.truncated}`);

  if (crawl.text.length < 1000) {
    console.warn(`[fetch] WARNING: very short text (${crawl.text.length} chars). Page may be SPA-rendered.`);
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
