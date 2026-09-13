export function normalizeDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    let hostname = parsed.hostname.toLowerCase();
    if (hostname.startsWith('www.')) hostname = hostname.slice(4);
    if (!hostname || hostname.length < 3) return null;
    return hostname;
  } catch {
    return null;
  }
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
