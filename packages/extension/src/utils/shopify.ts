// Reads a Shopify-hosted merchant page (see detectShopifyHosted) to work out
// which store it belongs to and which privacy policies it points at. Split in
// two: readShopifyPage runs inside the tab and only gathers raw data;
// summarizeShopifyScan runs in the popup and makes every decision, so the
// heuristics stay unit-testable without a browser.

import { normalizeDomain, type ShopifyHosted } from './domain.js';

export interface ShopifyShopData {
  id?: string;
  name?: string;
  url?: string;
  policies?: Record<string, string>;
}

export interface ShopifyPageScan {
  // Shopify's own embedded store record (<script type="shopify/serialized-data"
  // data-serialized-id="shop-data">). Present on customer-account pages.
  shopData: ShopifyShopData | null;
  // http(s) anchors on the page, capped.
  links: Array<{ href: string; text: string }>;
  // Labels of privacy buttons/links with no real URL: these open the policy in
  // a pop-up rather than navigating to it.
  policyTriggers: string[];
  // Dialogs on the page whose text reads like a privacy policy.
  dialogs: Array<{ title: string; text: string }>;
}

export interface ShopifyMerchantInfo {
  merchantDomain: string | null;
  merchantName: string | null;
  // The merchant's own privacy policy URL, when the page tells us.
  merchantPolicyUrl: string | null;
  source: 'shop-data' | 'policy-links' | 'store-handle' | null;
  // Privacy policies linked from the page that belong to someone other than
  // the merchant (e.g. the Rokt offers widget on an order-status page).
  linkedPolicies: Array<{ url: string; domain: string; text: string }>;
  // Policy text shown in a pop-up with no URL of its own.
  inPagePolicies: Array<{ title: string; text: string }>;
  hasPolicyModal: boolean;
}

/**
 * Injected into the tab via chrome.scripting.executeScript, which serializes
 * the function source. It must stay fully self-contained: no imports, no
 * references to anything outside its own body.
 */
export function readShopifyPage(): ShopifyPageScan {
  const MAX_LINKS = 400;
  const MAX_DIALOG_CHARS = 200_000;
  const PRIVACY_RE = /privacy|privacidad|privacit|confidentialit|datenschutz|privatliv|integritet|personvern|tietosuoja|privacybeleid/i;
  const textOf = (el: Element): string =>
    ((el as HTMLElement).innerText ?? el.textContent ?? '').replace(/\s+/g, ' ').trim();

  let shopData: ShopifyShopData | null = null;
  const scripts = Array.from(document.querySelectorAll('script[type="shopify/serialized-data"]'));
  // Prefer the dedicated shop-data record, then any record shaped like one.
  scripts.sort((a, b) =>
    Number(b.getAttribute('data-serialized-id') === 'shop-data') -
    Number(a.getAttribute('data-serialized-id') === 'shop-data'));
  for (const s of scripts) {
    try {
      const parsed = JSON.parse(s.textContent ?? '');
      if (parsed && typeof parsed === 'object' && typeof parsed.url === 'string' &&
          (s.getAttribute('data-serialized-id') === 'shop-data' || typeof parsed.policies === 'object')) {
        shopData = {
          id: typeof parsed.id === 'string' ? parsed.id : undefined,
          name: typeof parsed.name === 'string' ? parsed.name : undefined,
          url: parsed.url,
          policies: parsed.policies && typeof parsed.policies === 'object' ? parsed.policies : undefined,
        };
        break;
      }
    } catch { /* not JSON, skip */ }
  }

  const links: ShopifyPageScan['links'] = [];
  const policyTriggers: string[] = [];
  for (const el of Array.from(document.querySelectorAll('a, button, [role="button"]'))) {
    // "#" and javascript: hrefs don't navigate anywhere: they open a pop-up.
    const rawHref = (el.getAttribute('href') ?? '').trim();
    const navigates = rawHref !== '' && !rawHref.startsWith('#') && !/^javascript:/i.test(rawHref);
    const href = navigates ? (el as HTMLAnchorElement).href : '';
    const text = textOf(el).slice(0, 200);
    if (/^https?:/i.test(href)) {
      if (links.length < MAX_LINKS) links.push({ href, text });
    } else if (PRIVACY_RE.test(text) || PRIVACY_RE.test(el.getAttribute('aria-label') ?? '')) {
      policyTriggers.push(text || (el.getAttribute('aria-label') ?? ''));
    }
  }

  const dialogs: ShopifyPageScan['dialogs'] = [];
  for (const el of Array.from(document.querySelectorAll('dialog, [role="dialog"], [aria-modal="true"]'))) {
    const text = textOf(el);
    if (text.length < 300 || !PRIVACY_RE.test(text.slice(0, 2000))) continue;
    const heading = el.querySelector('h1, h2, h3');
    const title = (heading ? textOf(heading) : el.getAttribute('aria-label') ?? '').slice(0, 200);
    dialogs.push({ title, text: text.slice(0, MAX_DIALOG_CHARS) });
  }

  return { shopData, links, policyTriggers, dialogs };
}

// Hosts that are never the merchant: Shopify's own properties, plus third
// parties that commonly appear on order pages. rokt.com matters most, since
// its privacy policy also lives at /policies/privacy-policy.
const NON_MERCHANT_HOSTS = [
  'shopify.com', 'shopifycdn.com', 'shopifysvc.com', 'shop.app', 'myshopify.com',
  'rokt.com', 'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'tiktok.com',
  'pinterest.com', 'youtube.com', 'linkedin.com', 'google.com', 'apple.com', 'klaviyo.com',
];

function isNonMerchantHost(domain: string): boolean {
  return NON_MERCHANT_HOSTS.some(h => domain === h || domain.endsWith(`.${h}`));
}

// The paths Shopify serves a store's legal pages from.
const SHOPIFY_POLICY_PATH_RE =
  /^\/policies\/(privacy-policy|terms-of-service|refund-policy|shipping-policy|contact-information|legal-notice|subscription-policy)\/?$/;

const PRIVACY_TEXT_RE = /privacy|privacidad|privacit|confidentialit|datenschutz|privatliv|integritet|personvern|tietosuoja|privacybeleid/i;
const PRIVACY_PATH_RE = /privacy|privacidad|confidentialit|datenschutz/i;

function safeHttpUrl(raw: string | undefined): URL | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u : null;
  } catch {
    return null;
  }
}

/**
 * Fallback when the page has no shop-data record: score each host by how many
 * distinct Shopify policy pages it links to (4 each) plus a home-page link (3).
 * Needs 7, i.e. two policy pages or one plus a home link, so a lone third-party
 * /policies/privacy-policy link cannot win on its own.
 */
function merchantFromLinks(links: ShopifyPageScan['links']): string | null {
  const scores = new Map<string, { slugs: Set<string>; home: boolean }>();
  for (const { href } of links) {
    const u = safeHttpUrl(href);
    const domain = u && normalizeDomain(u.href);
    if (!u || !domain || isNonMerchantHost(domain)) continue;
    const entry = scores.get(domain) ?? { slugs: new Set<string>(), home: false };
    const slug = SHOPIFY_POLICY_PATH_RE.exec(u.pathname)?.[1];
    if (slug) entry.slugs.add(slug);
    if (u.pathname === '/' || u.pathname === '') entry.home = true;
    scores.set(domain, entry);
  }
  let best: string | null = null;
  let bestScore = 0;
  let tied = false;
  for (const [domain, { slugs, home }] of scores) {
    const score = slugs.size * 4 + (home ? 3 : 0);
    if (score > bestScore) { best = domain; bestScore = score; tied = false; }
    else if (score === bestScore) tied = true;
  }
  return bestScore >= 7 && !tied ? best : null;
}

export function summarizeShopifyScan(scan: ShopifyPageScan | null, hosted: ShopifyHosted): ShopifyMerchantInfo {
  let merchantDomain: string | null = null;
  let merchantName: string | null = null;
  let merchantPolicyUrl: string | null = null;
  let source: ShopifyMerchantInfo['source'] = null;

  const shopUrl = safeHttpUrl(scan?.shopData?.url);
  const shopDomain = shopUrl && normalizeDomain(shopUrl.href);
  if (shopDomain && !isNonMerchantHost(shopDomain)) {
    merchantDomain = shopDomain;
    merchantName = scan?.shopData?.name?.trim() || null;
    merchantPolicyUrl = safeHttpUrl(scan?.shopData?.policies?.privacy_policy)?.href ?? null;
    source = 'shop-data';
  } else if (scan) {
    merchantDomain = merchantFromLinks(scan.links);
    if (merchantDomain) source = 'policy-links';
  }
  if (!merchantDomain && hosted.kind === 'myshopify' && hosted.storeHandle) {
    // <handle>.myshopify.com redirects to the store's primary domain, so it is
    // still a usable key for requesting an analysis.
    merchantDomain = `${hosted.storeHandle}.myshopify.com`;
    source = 'store-handle';
  }

  const linkedPolicies: ShopifyMerchantInfo['linkedPolicies'] = [];
  const seen = new Set<string>();
  for (const { href, text } of scan?.links ?? []) {
    const u = safeHttpUrl(href);
    if (!u || !(PRIVACY_TEXT_RE.test(text) || PRIVACY_PATH_RE.test(u.pathname))) continue;
    const domain = normalizeDomain(u.href);
    if (!domain) continue;
    u.hash = '';
    if (domain === merchantDomain) {
      merchantPolicyUrl ??= u.href;
      continue;
    }
    if (seen.has(u.href)) continue;
    seen.add(u.href);
    linkedPolicies.push({ url: u.href, domain, text });
  }

  const inPagePolicies = scan?.dialogs ?? [];
  return {
    merchantDomain,
    merchantName,
    merchantPolicyUrl,
    source,
    linkedPolicies,
    inPagePolicies,
    hasPolicyModal: inPagePolicies.length > 0 || (scan?.policyTriggers.length ?? 0) > 0,
  };
}

// Run readShopifyPage in the given tab. The popup's activeTab grant covers
// this without any host permission. Returns null if injection is refused.
export async function scanShopifyTab(tabId: number): Promise<ShopifyPageScan | null> {
  try {
    const [res] = await chrome.scripting.executeScript({ target: { tabId }, func: readShopifyPage });
    return (res?.result as ShopifyPageScan | undefined) ?? null;
  } catch {
    return null;
  }
}
