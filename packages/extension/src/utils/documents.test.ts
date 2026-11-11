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

describe('termsDocs', () => {
  const doc = (label: string, score: number, extra: Record<string, unknown> = {}) =>
    ({ label, policyUrl: `https://example.com/${score}`, lastAnalyzed: 'x', analysis: analysis(score), ...extra });
  const withDocs = {
    ...base,
    documentType: 'privacy_policy',
    terms: { policyUrl: 'https://example.com/6', lastAnalyzed: 'x', analysis: analysis(6) },
    termsDocs: [
      doc('Terms of Service', 6),
      doc('Seller Terms', 4),
      doc('Businesses in ChatGPT Terms', 2, { pathPrefix: '/business-hub' }),
    ],
  };

  it('opens on the path-scoped terms under the prefix', () => {
    for (const p of ['/business-hub', '/business-hub/', '/business-hub/agents/1']) {
      const docs = splitDocuments(withDocs, p);
      expect(docs.terms?.label).toBe('Businesses in ChatGPT Terms');
      expect(docs.privacy?.analysis.overallScore).toBe(5);
      expect(docs.initial).toBe('terms');
      expect(docs.termsOptions).toHaveLength(3);
    }
  });

  it('defaults to the first site-wide terms elsewhere, matching whole segments only', () => {
    for (const p of [undefined, '/', '/business-hubris', '/en/business-hub']) {
      const docs = splitDocuments(withDocs, p);
      expect(docs.terms?.label).toBe('Terms of Service');
      expect(docs.initial).toBe('privacy');
    }
  });

  it('selects nothing when only path-scoped terms exist and the path does not match', () => {
    const docs = splitDocuments({ ...withDocs, terms: undefined, termsDocs: [withDocs.termsDocs[2]] }, '/');
    expect(docs.terms).toBeNull();
    expect(docs.termsOptions).toHaveLength(1);
    expect(docs.initial).toBe('privacy');
  });

  it('keeps re-check state on the default terms of a ToS-only site', () => {
    const docs = splitDocuments(
      { ...withDocs, documentType: 'terms_of_service', policyUrl: 'https://example.com/6', analysis: analysis(6), terms: undefined },
      '/',
    );
    expect(docs.privacy).toBeNull();
    expect(docs.terms?.refresh).toEqual(base.refresh);
    expect(docs.initial).toBe('terms');
  });

  it('drops malformed entries', () => {
    const docs = splitDocuments({ ...withDocs, termsDocs: [null, { label: 'x' }, doc('Terms of Service', 6)] });
    expect(docs.termsOptions).toHaveLength(1);
  });

  it('falls back to the single terms block on servers without termsDocs', () => {
    const { termsDocs: _drop, ...legacy } = withDocs;
    const docs = splitDocuments(legacy, '/business-hub');
    expect(docs.terms?.analysis.overallScore).toBe(6);
    expect(docs.termsOptions).toHaveLength(1);
    expect(docs.initial).toBe('privacy');
  });
});
