import { describe, it, expect } from 'vitest';
import { splitDocuments } from './documents.js';

const analysis = (overallScore: number) => ({ overallScore, summary: 's', highlights: [] });

const base = {
  found: true,
  domain: 'example.com',
  policyUrl: 'https://example.com/privacy',
  lastAnalyzed: '2026-09-01T00:00:00.000Z',
  analysis: analysis(5),
  refresh: { pending: false, eligible: true },
};

describe('splitDocuments', () => {
  it('treats the top-level analysis as privacy on servers that predate tabs', () => {
    const docs = splitDocuments(base);
    expect(docs.privacy?.analysis.overallScore).toBe(5);
    expect(docs.terms).toBeNull();
    expect(docs.initial).toBe('privacy');
  });

  it('pairs the privacy policy with the terms block', () => {
    const docs = splitDocuments({
      ...base,
      documentType: 'privacy_policy',
      terms: { policyUrl: 'https://example.com/terms', lastAnalyzed: '2026-09-20T00:00:00.000Z', analysis: analysis(3) },
    });
    expect(docs.privacy?.analysis.overallScore).toBe(5);
    expect(docs.terms?.analysis.overallScore).toBe(3);
    expect(docs.terms?.policyUrl).toBe('https://example.com/terms');
    expect(docs.initial).toBe('privacy');
  });

  it('keeps refresh and upcoming on the top-level document only', () => {
    const docs = splitDocuments({
      ...base,
      upcoming: { effectiveAt: '2026-12-01T00:00:00.000Z', policyUrl: 'u' },
      terms: { policyUrl: 't', lastAnalyzed: 'x', analysis: analysis(3) },
    });
    expect(docs.privacy?.refresh).toBeDefined();
    expect(docs.privacy?.upcoming).toBeDefined();
    expect(docs.terms?.refresh).toBeUndefined();
    expect(docs.terms?.upcoming).toBeUndefined();
  });

  it('opens on terms for a site with only a ToS', () => {
    const docs = splitDocuments({ ...base, documentType: 'terms_of_service', analysis: analysis(3) });
    expect(docs.privacy).toBeNull();
    expect(docs.terms?.analysis.overallScore).toBe(3);
    expect(docs.terms?.refresh).toBeDefined();
    expect(docs.initial).toBe('terms');
  });

  it('ignores a malformed terms block', () => {
    const docs = splitDocuments({ ...base, terms: { policyUrl: 't' } });
    expect(docs.terms).toBeNull();
  });
});

describe('path-scoped terms', () => {
  const withPath = {
    ...base,
    documentType: 'privacy_policy',
    terms: { policyUrl: 'https://example.com/terms', lastAnalyzed: 'x', analysis: analysis(6) },
    pathTerms: [
      { pathPrefix: '/business-hub', policyUrl: 'https://example.com/biz-terms', lastAnalyzed: 'y', analysis: analysis(2) },
    ],
  };

  it('swaps in the scoped terms and opens on Terms under the prefix', () => {
    for (const p of ['/business-hub', '/business-hub/', '/business-hub/agents/1']) {
      const docs = splitDocuments(withPath, p);
      expect(docs.terms?.analysis.overallScore).toBe(2);
      expect(docs.terms?.policyUrl).toBe('https://example.com/biz-terms');
      expect(docs.privacy?.analysis.overallScore).toBe(5);
      expect(docs.initial).toBe('terms');
    }
  });

  it('keeps the site-wide terms elsewhere, matching whole segments only', () => {
    for (const p of [undefined, '/', '/c/abc', '/business-hubris', '/en/business-hub']) {
      const docs = splitDocuments(withPath, p);
      expect(docs.terms?.analysis.overallScore).toBe(6);
      expect(docs.initial).toBe('privacy');
    }
  });

  it('applies scoped terms when the site has only a ToS', () => {
    const docs = splitDocuments({ ...withPath, documentType: 'terms_of_service', terms: undefined }, '/business-hub');
    expect(docs.privacy).toBeNull();
    expect(docs.terms?.analysis.overallScore).toBe(2);
  });

  it('ignores malformed pathTerms entries', () => {
    const docs = splitDocuments({ ...withPath, pathTerms: [{ pathPrefix: '/business-hub' }, null] }, '/business-hub');
    expect(docs.terms?.analysis.overallScore).toBe(6);
  });
});
