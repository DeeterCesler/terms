import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import express from 'express';

const getSiteByDomain = vi.fn();
const getLatestAnalysis = vi.fn();
const getUpcomingAnalysis = vi.fn();
const getLatestTermsAnalysis = vi.fn();

vi.mock('../db/queries/sites.js', () => ({ getSiteByDomain }));
vi.mock('../db/queries/analyses.js', () => ({
  getLatestAnalysis,
  getLatestTermsAnalysis,
  getUpcomingAnalysis,
  getAnalysisHistory: vi.fn(),
  getRankings: vi.fn(),
}));
vi.mock('../db/queries/policy_sources.js', () => ({ getSitesForSource: vi.fn(async () => []) }));
vi.mock('../db/queries/candidates.js', () => ({
  addCandidate: vi.fn(),
  getCandidateByDomain: vi.fn(async () => null),
}));
// The real limiter pulls in config, which requires DATABASE_URL and ADMIN_SECRET.
vi.mock('../middleware/rateLimiter.js', () => ({
  requestRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const { publicRouter } = await import('./public.js');

function analysisRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'a1',
    policy_source_id: 'src1',
    policy_url: 'https://example.com/privacy',
    analyzed_at: new Date('2026-09-01T00:00:00Z'),
    shares_with_third_parties: true,
    shares_evidence: 'e',
    sells_data: false,
    sells_evidence: 'e',
    data_anonymized: null,
    anonymized_evidence: null,
    data_retention: null,
    user_rights: [],
    overall_score: 8,
    summary: 'current',
    highlights: null,
    no_meaningful_policy: false,
    ...overrides,
  };
}

let server: Server;
let base: string;
// The check cache is module-level, so each test uses its own domain.
let n = 0;
const nextDomain = () => `site${++n}.example`;

beforeAll(async () => {
  const app = express();
  app.use('/api/v1', publicRouter);
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

beforeEach(() => {
  getSiteByDomain.mockReset().mockImplementation(async (domain: string) => ({ id: `site-${domain}`, domain }));
  getLatestAnalysis.mockReset().mockImplementation(async () => analysisRow());
  getUpcomingAnalysis.mockReset().mockImplementation(async () => null);
  getLatestTermsAnalysis.mockReset().mockImplementation(async () => null);
});

describe('GET /check/:domain upcoming', () => {
  it('omits the upcoming key entirely when there is no announced policy', async () => {
    const res = await fetch(`${base}/check/${nextDomain()}`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.found).toBe(true);
    // Absent, not null: shipped extension builds must see the same payload.
    expect('upcoming' in body).toBe(false);
    expect(getUpcomingAnalysis).toHaveBeenCalledWith('src1');
  });

  it('includes effectiveAt, policyUrl and the upcoming analysis alongside the current one', async () => {
    getUpcomingAnalysis.mockImplementation(async () =>
      analysisRow({
        id: 'a2',
        overall_score: 4,
        summary: 'upcoming',
        policy_url: 'https://example.com/privacy-2026',
        effective_at: new Date('2026-10-01T00:00:00Z'),
      }),
    );

    const body = await (await fetch(`${base}/check/${nextDomain()}`)).json();

    expect(body.analysis.overallScore).toBe(8);
    expect(body.policyUrl).toBe('https://example.com/privacy');
    expect(body.upcoming).toMatchObject({
      effectiveAt: '2026-10-01T00:00:00.000Z',
      policyUrl: 'https://example.com/privacy-2026',
      analysis: { overallScore: 4, summary: 'upcoming' },
    });
  });

  it('does not look for an upcoming policy when the site is not found', async () => {
    getLatestAnalysis.mockImplementation(async () => null);

    const body = await (await fetch(`${base}/check/${nextDomain()}`)).json();

    expect(body.found).toBe(false);
    expect(getUpcomingAnalysis).not.toHaveBeenCalled();
  });
});

describe('GET /check/:domain privacy and terms', () => {
  it('labels the privacy policy and omits terms when the site has no ToS', async () => {
    getLatestAnalysis.mockImplementation(async () => analysisRow({ policy_type: 'privacy_policy' }));
    const body = await (await fetch(`${base}/check/${nextDomain()}`)).json();

    expect(body.documentType).toBe('privacy_policy');
    // Absent, not null: shipped extension builds must see the same payload.
    expect('terms' in body).toBe(false);
  });

  it('sends the ToS as terms alongside the privacy analysis', async () => {
    getLatestAnalysis.mockImplementation(async () => analysisRow({ policy_type: 'privacy_policy', overall_score: 5 }));
    getLatestTermsAnalysis.mockImplementation(async () =>
      analysisRow({
        id: 'a2',
        policy_source_id: 'src2',
        policy_type: 'terms_of_service',
        policy_url: 'https://example.com/terms',
        analyzed_at: new Date('2026-09-20T00:00:00Z'),
        overall_score: 3,
        summary: 'terms',
      }));
    const body = await (await fetch(`${base}/check/${nextDomain()}`)).json();

    // The top-level fields older extensions read are still the privacy policy.
    expect(body.analysis.overallScore).toBe(5);
    expect(body.policyUrl).toBe('https://example.com/privacy');
    expect(body.terms).toEqual({
      policyUrl: 'https://example.com/terms',
      lastAnalyzed: '2026-09-20T00:00:00.000Z',
      analysis: expect.objectContaining({ overallScore: 3, summary: 'terms' }),
    });
  });

  it('labels a ToS-only site and does not look for a second ToS', async () => {
    getLatestAnalysis.mockImplementation(async () => analysisRow({ policy_type: 'terms_of_service' }));
    const body = await (await fetch(`${base}/check/${nextDomain()}`)).json();

    expect(body.documentType).toBe('terms_of_service');
    expect('terms' in body).toBe(false);
    expect(getLatestTermsAnalysis).not.toHaveBeenCalled();
  });
});
