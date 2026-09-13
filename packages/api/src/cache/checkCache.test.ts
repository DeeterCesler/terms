import { describe, it, expect } from 'vitest';
import type { CheckResponse } from '@term-checker/shared';
import { checkExpiresAt } from './checkCache.js';

const WEEK = 7 * 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-09-13T00:00:00Z');

const analysis: CheckResponse['analysis'] = {
  sharesWithThirdParties: { value: null, evidence: null },
  sellsData: { value: null, evidence: null },
  dataAnonymized: { value: null, evidence: null },
  dataRetention: null,
  userRights: [],
  overallScore: 5,
  summary: '',
  highlights: [],
};

const base: CheckResponse = {
  found: true,
  domain: 'example.com',
  policyUrl: 'https://example.com/privacy',
  lastAnalyzed: '2026-09-01T00:00:00Z',
  analysis,
};

describe('checkExpiresAt', () => {
  it('uses the full TTL when there is no upcoming policy', () => {
    expect(checkExpiresAt(base, NOW)).toBe(NOW + WEEK);
  });

  it('expires at the effective date when it falls inside the TTL', () => {
    const effectiveAt = '2026-09-15T00:00:00Z';
    const value = { ...base, upcoming: { effectiveAt, policyUrl: base.policyUrl, analysis } };
    expect(checkExpiresAt(value, NOW)).toBe(Date.parse(effectiveAt));
  });

  it('keeps the full TTL when the effective date is further out', () => {
    const value = { ...base, upcoming: { effectiveAt: '2026-12-01T00:00:00Z', policyUrl: base.policyUrl, analysis } };
    expect(checkExpiresAt(value, NOW)).toBe(NOW + WEEK);
  });

  it('falls back to the full TTL on an unparseable date', () => {
    const value = { ...base, upcoming: { effectiveAt: 'nope', policyUrl: base.policyUrl, analysis } };
    expect(checkExpiresAt(value, NOW)).toBe(NOW + WEEK);
  });
});
