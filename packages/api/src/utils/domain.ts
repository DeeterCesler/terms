const DOMAIN_RE = /^[a-z0-9][a-z0-9\-\.]{1,251}[a-z0-9]$/i;

export function normalizeDomain(input: string): string | null {
  try {
    // If it looks like a URL, parse it
    const withScheme = input.startsWith('http') ? input : `https://${input}`;
    const url = new URL(withScheme);
    let hostname = url.hostname.toLowerCase();
    // Strip leading www.
    if (hostname.startsWith('www.')) hostname = hostname.slice(4);
    if (!DOMAIN_RE.test(hostname)) return null;
    return hostname;
  } catch {
    return null;
  }
}

export function extractDomainFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    let hostname = parsed.hostname.toLowerCase();
    if (hostname.startsWith('www.')) hostname = hostname.slice(4);
    if (!DOMAIN_RE.test(hostname)) return null;
    return hostname;
  } catch {
    return null;
  }
}

// Common multi-label public suffixes. We never want to collapse a hostname
// down to one of these (e.g. treat foo.co.uk as the registrable domain, not
// co.uk). Not exhaustive — just the suffixes likely to show up in practice.
const TWO_LABEL_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'gov.uk', 'ac.uk', 'co.jp', 'co.kr', 'co.nz', 'co.za',
  'com.au', 'com.br', 'com.cn', 'com.mx', 'com.tr', 'com.sg', 'com.hk',
]);

/**
 * Ordered list of domains to try when resolving a hostname to an analyzed
 * site, from the exact host down to its registrable (eTLD+1) domain. This lets
 * a subdomain like `open.spotify.com` resolve to the `spotify.com` analysis.
 *
 *   open.spotify.com -> ['open.spotify.com', 'spotify.com']
 *   a.b.example.com  -> ['a.b.example.com', 'b.example.com', 'example.com']
 *   foo.bar.co.uk    -> ['foo.bar.co.uk', 'bar.co.uk']  (stops at eTLD+1)
 *
 * Walking up is safe because callers only accept a parent that actually has an
 * analyzed site; bare public suffixes never match a real site.
 */
export function domainLookupCandidates(domain: string): string[] {
  const labels = domain.split('.');
  // Minimum labels in a registrable domain: 3 for a known two-label suffix
  // (foo.co.uk), otherwise 2 (example.com).
  const lastTwo = labels.slice(-2).join('.');
  const minLabels = TWO_LABEL_SUFFIXES.has(lastTwo) ? 3 : 2;
  const out: string[] = [];
  for (let i = 0; i + minLabels <= labels.length; i++) {
    out.push(labels.slice(i).join('.'));
  }
  return out.length > 0 ? out : [domain];
}
// Shopify hosts account, order-status, checkout, and Shop app pages for its
// merchants on Shopify-owned domains. Those pages belong to an unrelated store
// (a shopify.com/10021104/account/orders/... page is Oliver Cabell's, not
// Shopify's), so they must not resolve to shopify.com's own policy.
export type ShopifyHostedKind = 'account' | 'checkout' | 'myshopify' | 'shop-app';

export interface ShopifyHosted {
  kind: ShopifyHostedKind;
  // Numeric shop id from a shopify.com/<id>/... or checkout.shopify.com/<id>/... path.
  shopId?: string;
  // Store handle from <handle>.myshopify.com.
  storeHandle?: string;
}

const SHOP_ID_PATH_RE = /^\/(\d+)(?:\/|$)/;

/**
 * Detect a Shopify-hosted merchant page. Returns null for anything else,
 * including Shopify's own marketing and legal pages (shopify.com/pricing,
 * shopify.com/legal/privacy), which are about Shopify itself.
 *
 *   shopify.com/10021104/account/orders/... -> { kind: 'account', shopId: '10021104' }
 *   checkout.shopify.com/10021104/...       -> { kind: 'checkout', shopId: '10021104' }
 *   oliver-cabell.myshopify.com/...         -> { kind: 'myshopify', storeHandle: 'oliver-cabell' }
 *   shop.app/...                            -> { kind: 'shop-app' }
 */
export function detectShopifyHosted(url: string): ShopifyHosted | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  let host = parsed.hostname.toLowerCase();
  if (host.startsWith('www.')) host = host.slice(4);
  const shopId = SHOP_ID_PATH_RE.exec(parsed.pathname)?.[1];

  if (host === 'shopify.com') return shopId ? { kind: 'account', shopId } : null;
  if (host === 'checkout.shopify.com') return shopId ? { kind: 'checkout', shopId } : { kind: 'checkout' };
  if (host.endsWith('.myshopify.com')) {
    const storeHandle = host.slice(0, -'.myshopify.com'.length);
    // Only a single-label handle is a store; deeper hosts are not storefronts.
    return storeHandle && !storeHandle.includes('.') ? { kind: 'myshopify', storeHandle } : null;
  }
  if (host === 'shop.app') return { kind: 'shop-app' };
  return null;
}
