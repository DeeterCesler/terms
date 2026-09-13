import { describe, it, expect } from 'vitest';
import { normalizeDomain, extractDomainFromUrl, domainLookupCandidates, detectShopifyHosted } from './domain.js';

describe('normalizeDomain', () => {
  it('returns the hostname for a bare domain', () => {
    expect(normalizeDomain('example.com')).toBe('example.com');
  });

  it('strips www. prefix', () => {
    expect(normalizeDomain('www.example.com')).toBe('example.com');
  });

  it('strips www. from a full URL', () => {
    expect(normalizeDomain('https://www.example.com/path?q=1')).toBe('example.com');
  });

  it('lowercases the hostname', () => {
    expect(normalizeDomain('EXAMPLE.COM')).toBe('example.com');
  });

  it('returns null for an invalid domain', () => {
    expect(normalizeDomain('not a domain')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(normalizeDomain('')).toBeNull();
  });

  it('handles subdomains other than www', () => {
    expect(normalizeDomain('app.example.com')).toBe('app.example.com');
  });

  it('handles a full URL without www', () => {
    expect(normalizeDomain('https://example.com/privacy')).toBe('example.com');
  });
});

describe('extractDomainFromUrl', () => {
  it('extracts domain from a full URL', () => {
    expect(extractDomainFromUrl('https://www.example.com/privacy')).toBe('example.com');
  });

  it('returns null for a non-URL string', () => {
    expect(extractDomainFromUrl('not-a-url')).toBeNull();
  });

  it('lowercases the result', () => {
    expect(extractDomainFromUrl('https://EXAMPLE.COM/page')).toBe('example.com');
  });
});

describe('domainLookupCandidates', () => {
  it('returns the bare domain unchanged', () => {
    expect(domainLookupCandidates('example.com')).toEqual(['example.com']);
  });

  it('folds a subdomain down to the registrable domain', () => {
    expect(domainLookupCandidates('open.spotify.com')).toEqual([
      'open.spotify.com',
      'spotify.com',
    ]);
  });

  it('walks every level of a deep subdomain', () => {
    expect(domainLookupCandidates('a.b.example.com')).toEqual([
      'a.b.example.com',
      'b.example.com',
      'example.com',
    ]);
  });

  it('stops at eTLD+1 for a known two-label suffix', () => {
    expect(domainLookupCandidates('foo.bar.co.uk')).toEqual([
      'foo.bar.co.uk',
      'bar.co.uk',
    ]);
  });

  it('does not collapse a registrable two-label-suffix domain', () => {
    expect(domainLookupCandidates('bar.co.uk')).toEqual(['bar.co.uk']);
  });
});
describe('detectShopifyHosted', () => {
  it('detects a shopify.com/<shopId>/ merchant account page', () => {
    expect(
      detectShopifyHosted('https://shopify.com/10021104/account/orders/1faab89222a0ad3e1f4aa73a78864622?buyer_token_attempted=1&locale=en-US'),
    ).toEqual({ kind: 'account', shopId: '10021104' });
  });

  it('treats www.shopify.com the same', () => {
    expect(detectShopifyHosted('https://www.shopify.com/10021104/account')).toEqual({ kind: 'account', shopId: '10021104' });
  });

  it('matches a bare shop id path with no trailing segment', () => {
    expect(detectShopifyHosted('https://shopify.com/10021104')).toEqual({ kind: 'account', shopId: '10021104' });
  });

  it("ignores Shopify's own marketing and legal pages", () => {
    expect(detectShopifyHosted('https://www.shopify.com/')).toBeNull();
    expect(detectShopifyHosted('https://www.shopify.com/pricing')).toBeNull();
    expect(detectShopifyHosted('https://www.shopify.com/legal/privacy')).toBeNull();
    expect(detectShopifyHosted('https://shopify.com/2024-editions')).toBeNull();
  });

  it('ignores other shopify.com subdomains', () => {
    expect(detectShopifyHosted('https://admin.shopify.com/store/foo')).toBeNull();
    expect(detectShopifyHosted('https://help.shopify.com/en/manual')).toBeNull();
  });

  it('detects hosted checkout with and without a shop id', () => {
    expect(detectShopifyHosted('https://checkout.shopify.com/10021104/checkouts/abc')).toEqual({ kind: 'checkout', shopId: '10021104' });
    expect(detectShopifyHosted('https://checkout.shopify.com/some/path')).toEqual({ kind: 'checkout' });
  });

  it('detects a myshopify.com storefront and extracts the handle', () => {
    expect(detectShopifyHosted('https://oliver-cabell.myshopify.com/products/x')).toEqual({ kind: 'myshopify', storeHandle: 'oliver-cabell' });
    expect(detectShopifyHosted('https://OLIVER-CABELL.MYSHOPIFY.COM/')).toEqual({ kind: 'myshopify', storeHandle: 'oliver-cabell' });
  });

  it('rejects bare myshopify.com and multi-label handles', () => {
    expect(detectShopifyHosted('https://myshopify.com/')).toBeNull();
    expect(detectShopifyHosted('https://a.b.myshopify.com/')).toBeNull();
  });

  it('detects shop.app pages', () => {
    expect(detectShopifyHosted('https://shop.app/m/abc123')).toEqual({ kind: 'shop-app' });
  });

  it('does not match lookalike hosts', () => {
    expect(detectShopifyHosted('https://notshopify.com/10021104/account')).toBeNull();
    expect(detectShopifyHosted('https://evilmyshopify.com/')).toBeNull();
    expect(detectShopifyHosted('https://shop.app.example.com/')).toBeNull();
  });

  it('returns null for the merchant own domain and for junk input', () => {
    expect(detectShopifyHosted('https://olivercabell.com/policies/privacy-policy')).toBeNull();
    expect(detectShopifyHosted('not a url')).toBeNull();
    expect(detectShopifyHosted('chrome://extensions/')).toBeNull();
  });
});
