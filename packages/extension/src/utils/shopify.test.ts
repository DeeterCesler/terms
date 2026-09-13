// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { readShopifyPage, summarizeShopifyScan, type ShopifyPageScan } from './shopify.js';
import { detectShopifyHosted, type ShopifyHosted } from './domain.js';

const ACCOUNT = detectShopifyHosted('https://shopify.com/10021104/account/orders/1faab')!;

// Trimmed from the real shopify.com/10021104 customer-account page.
const SHOP_DATA =
  '{"id":"10021104","name":"Oliver Cabell","url":"https:\\/\\/olivercabell.com",' +
  '"policies":{"privacy_policy":"https:\\/\\/olivercabell.com\\/policies\\/privacy-policy",' +
  '"terms_of_service":"https:\\/\\/olivercabell.com\\/policies\\/terms-of-service"}}';

const POLICY_BODY = 'Privacy Policy. ' + 'We collect and use personal information as described here. '.repeat(10);

describe('readShopifyPage', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  it('extracts the serialized shop-data record', () => {
    document.body.innerHTML =
      `<script type="shopify/serialized-data" data-serialized-id="translations">{"x":1}</script>` +
      `<script type="shopify/serialized-data" data-serialized-id="shop-data">${SHOP_DATA}</script>`;
    expect(readShopifyPage().shopData).toEqual({
      id: '10021104',
      name: 'Oliver Cabell',
      url: 'https://olivercabell.com',
      policies: {
        privacy_policy: 'https://olivercabell.com/policies/privacy-policy',
        terms_of_service: 'https://olivercabell.com/policies/terms-of-service',
      },
    });
  });

  it('survives malformed serialized data', () => {
    document.body.innerHTML = `<script type="shopify/serialized-data" data-serialized-id="shop-data">{not json</script>`;
    expect(readShopifyPage().shopData).toBeNull();
  });

  it('collects http links, and privacy triggers that have no real URL', () => {
    document.body.innerHTML =
      `<a href="https://www.rokt.com/policies/privacy-policy">Privacy Policy</a>` +
      `<a href="mailto:hi@example.com">Email</a>` +
      `<button type="button">Privacy policy</button>` +
      `<a href="#">Terms of service</a>` +
      `<a href="javascript:void(0)" aria-label="Open privacy notice"></a>`;
    const scan = readShopifyPage();
    expect(scan.links).toEqual([{ href: 'https://www.rokt.com/policies/privacy-policy', text: 'Privacy Policy' }]);
    expect(scan.policyTriggers).toEqual(['Privacy policy', 'Open privacy notice']);
  });

  it('captures a policy shown in a dialog, and ignores unrelated dialogs', () => {
    document.body.innerHTML =
      `<div role="dialog"><h2>Privacy policy</h2><p>${POLICY_BODY}</p></div>` +
      `<dialog><h2>Your cart</h2><p>${'Cart line item. '.repeat(40)}</p></dialog>`;
    const { dialogs } = readShopifyPage();
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0].title).toBe('Privacy policy');
    expect(dialogs[0].text).toContain('We collect and use personal information');
  });
});

function scan(partial: Partial<ShopifyPageScan>): ShopifyPageScan {
  return { shopData: null, links: [], policyTriggers: [], dialogs: [], ...partial };
}

describe('summarizeShopifyScan', () => {
  it('identifies the merchant from shop-data and lists third-party policies', () => {
    const info = summarizeShopifyScan(scan({
      shopData: JSON.parse(SHOP_DATA),
      links: [
        { href: 'https://www.rokt.com/policies/privacy-policy#top', text: 'Privacy Policy' },
        { href: 'https://www.rokt.com/policies/privacy-policy', text: 'Privacy' },
        { href: 'https://olivercabell.com/policies/privacy-policy', text: 'Privacy policy' },
        { href: 'https://olivercabell.com/', text: 'Oliver Cabell' },
      ],
    }), ACCOUNT);
    expect(info).toMatchObject({
      merchantDomain: 'olivercabell.com',
      merchantName: 'Oliver Cabell',
      merchantPolicyUrl: 'https://olivercabell.com/policies/privacy-policy',
      source: 'shop-data',
      hasPolicyModal: false,
    });
    expect(info.linkedPolicies).toEqual([
      { url: 'https://www.rokt.com/policies/privacy-policy', domain: 'rokt.com', text: 'Privacy Policy' },
    ]);
  });

  it('ignores a shop-data url pointing at a Shopify-owned host', () => {
    const info = summarizeShopifyScan(scan({ shopData: { url: 'https://shop.app/' } }), ACCOUNT);
    expect(info.merchantDomain).toBeNull();
  });

  it('rejects non-http policy URLs from shop-data', () => {
    const info = summarizeShopifyScan(scan({
      shopData: { url: 'https://olivercabell.com', policies: { privacy_policy: 'javascript:alert(1)' } },
    }), ACCOUNT);
    expect(info.merchantPolicyUrl).toBeNull();
  });

  it('falls back to Shopify policy links when shop-data is missing', () => {
    const info = summarizeShopifyScan(scan({
      links: [
        { href: 'https://olivercabell.com/policies/refund-policy', text: 'Refund policy' },
        { href: 'https://olivercabell.com/policies/privacy-policy', text: 'Privacy policy' },
        { href: 'https://www.rokt.com/policies/privacy-policy', text: 'Privacy Policy' },
      ],
    }), ACCOUNT);
    expect(info.merchantDomain).toBe('olivercabell.com');
    expect(info.source).toBe('policy-links');
    expect(info.merchantPolicyUrl).toBe('https://olivercabell.com/policies/privacy-policy');
    expect(info.linkedPolicies.map(p => p.domain)).toEqual(['rokt.com']);
  });

  it('does not crown a host from a single third-party policy link', () => {
    const info = summarizeShopifyScan(scan({
      links: [{ href: 'https://offers.example-ads.com/policies/privacy-policy', text: 'Privacy' }],
    }), ACCOUNT);
    expect(info.merchantDomain).toBeNull();
    expect(info.linkedPolicies).toHaveLength(1);
  });

  it('refuses to pick between two equally strong hosts', () => {
    const info = summarizeShopifyScan(scan({
      links: [
        { href: 'https://a-store.com/policies/refund-policy', text: 'Refunds' },
        { href: 'https://a-store.com/policies/privacy-policy', text: 'Privacy' },
        { href: 'https://b-store.com/policies/refund-policy', text: 'Refunds' },
        { href: 'https://b-store.com/policies/privacy-policy', text: 'Privacy' },
      ],
    }), ACCOUNT);
    expect(info.merchantDomain).toBeNull();
  });

  it('falls back to the myshopify handle', () => {
    const hosted: ShopifyHosted = { kind: 'myshopify', storeHandle: 'oliver-cabell' };
    const info = summarizeShopifyScan(null, hosted);
    expect(info).toMatchObject({ merchantDomain: 'oliver-cabell.myshopify.com', source: 'store-handle' });
  });

  it('reports pop-up policies with no URL', () => {
    const withDialog = summarizeShopifyScan(scan({ dialogs: [{ title: 'Privacy policy', text: POLICY_BODY }] }), ACCOUNT);
    expect(withDialog.hasPolicyModal).toBe(true);
    expect(withDialog.inPagePolicies).toHaveLength(1);
    const triggerOnly = summarizeShopifyScan(scan({ policyTriggers: ['Privacy policy'] }), ACCOUNT);
    expect(triggerOnly.hasPolicyModal).toBe(true);
    expect(triggerOnly.inPagePolicies).toEqual([]);
  });

  it('returns an empty result when injection failed', () => {
    expect(summarizeShopifyScan(null, ACCOUNT)).toEqual({
      merchantDomain: null, merchantName: null, merchantPolicyUrl: null, source: null,
      linkedPolicies: [], inPagePolicies: [], hasPolicyModal: false,
    });
  });
});
