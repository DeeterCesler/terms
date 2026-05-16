import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') });

const BASE = 'http://localhost:3000';
const SECRET = process.env.ADMIN_SECRET!;
const headers = { 'Content-Type': 'application/json', 'X-Admin-Secret': SECRET };

// Known stable policy URLs to test with
const TARGETS = [
  { policyUrl: 'https://policies.google.com/privacy',                     domain: 'google.com',      policyType: 'privacy_policy' },
  { policyUrl: 'https://policies.google.com/terms',                       domain: 'google.com',      policyType: 'terms_of_service' },
  { policyUrl: 'https://www.apple.com/legal/privacy/en-ww/',              domain: 'apple.com',        policyType: 'privacy_policy' },
  { policyUrl: 'https://www.reddit.com/policies/privacy-policy',          domain: 'reddit.com',       policyType: 'privacy_policy' },
  { policyUrl: 'https://twitter.com/en/privacy',                          domain: 'x.com',            policyType: 'privacy_policy' },
  { policyUrl: 'https://www.wikipedia.org/wiki/Wikipedia:Privacy_policy', domain: 'wikipedia.org',    policyType: 'privacy_policy' },
  { policyUrl: 'https://discord.com/privacy',                             domain: 'discord.com',      policyType: 'privacy_policy' },
  { policyUrl: 'https://discord.com/terms',                               domain: 'discord.com',      policyType: 'terms_of_service' },
  { policyUrl: 'https://duckduckgo.com/privacy',                          domain: 'duckduckgo.com',   policyType: 'privacy_policy' },
  { policyUrl: 'https://www.spotify.com/us/legal/privacy-policy/',        domain: 'spotify.com',      policyType: 'privacy_policy' },
];

async function queue(target: typeof TARGETS[0]) {
  const res = await fetch(`${BASE}/admin/sites`, {
    method: 'POST', headers,
    body: JSON.stringify({ policyUrl: target.policyUrl, domain: target.domain, policyType: target.policyType }),
  });
  const data = await res.json() as any;
  if (res.ok) {
    console.log(`  queued  ${target.domain} [${target.policyType}]  job=${data.jobId}`);
  } else {
    console.log(`  error   ${target.domain}: ${JSON.stringify(data.error)}`);
  }
}

async function run() {
  console.log(`\nQueuing ${TARGETS.length} crawl jobs...\n`);
  for (const t of TARGETS) await queue(t);
  console.log('\nAll queued. Worker will process them — check /admin/queue for status.');
}

run().catch(err => { console.error(err); process.exit(1); });
