import type { CheckResult } from '@term-checker/shared';

// In-memory cache for GET /api/v1/check/:domain responses. Keyed by the exact
// (normalized) hostname the extension sends, which keeps www-stripped but
// preserves other subdomains (e.g. open.spotify.com). Lives only in the running
// API process; ingest scripts write straight to Postgres in a separate process,
// so a fresh analysis can't clear this map on its own — the ingest flow calls
// POST /admin/cache/bust to invalidate the affected domains.
const CHECK_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CHECK_CACHE_MAX = 100;
const checkCache = new Map<string, { value: CheckResult; expiresAt: number }>();

export function getCachedCheck(domain: string): CheckResult | undefined {
  const entry = checkCache.get(domain);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    checkCache.delete(domain);
    return undefined;
  }
  // Re-insert to mark as most-recently-used (Map preserves insertion order, so
  // the oldest key is the LRU-eviction target in setCachedCheck).
  checkCache.delete(domain);
  checkCache.set(domain, entry);
  return entry.value;
}

export function setCachedCheck(domain: string, value: CheckResult): void {
  if (!value.found) return;
  if (checkCache.has(domain)) checkCache.delete(domain);
  else if (checkCache.size >= CHECK_CACHE_MAX) {
    const oldest = checkCache.keys().next().value;
    if (oldest !== undefined) checkCache.delete(oldest);
  }
  checkCache.set(domain, { value, expiresAt: Date.now() + CHECK_CACHE_TTL_MS });
}

// Drop every cached entry for the given domains. Matches a key when it equals a
// target domain OR is a subdomain of it, so busting spotify.com also clears a
// cached open.spotify.com (and busting anthropic.com clears any www-or-app
// variants). Returns the number of entries removed.
export function bustCachedCheck(domains: Iterable<string>): number {
  const targets = [...domains].map(d => d.toLowerCase()).filter(Boolean);
  if (targets.length === 0) return 0;
  let removed = 0;
  for (const key of [...checkCache.keys()]) {
    const matches = targets.some(t => key === t || key.endsWith(`.${t}`));
    if (matches && checkCache.delete(key)) removed++;
  }
  return removed;
}
