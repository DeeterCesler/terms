import { describe, it, expect, vi, beforeEach } from 'vitest';

// Captures every SQL string the query helpers send, so these tests pin down
// which filters each public read path carries without a real database.
const queryMock = vi.fn(async (_text: string, _values?: unknown[]) => ({
  rows: [{ sites_covered: '0', sites_queued: '0', last_analyzed_at: null, last_added_domain: null }],
}));

vi.mock('../client.js', () => ({ pool: { query: queryMock } }));

const {
  IN_FORCE,
  getLatestAnalysis,
  getLatestTermsAnalysis,
  getAnalysisHistory,
  getRankings,
  getCoverageStats,
  getUpcomingAnalysis,
} = await import('./analyses.js');

const sent = () => queryMock.mock.calls.map((c) => c[0]);

beforeEach(() => {
  queryMock.mockClear();
});

// An upcoming policy is analyzed before it takes effect, so it is the newest
// analysis on its source. Any public read path that picks "the latest analysis"
// without this filter would put it live the moment it is ingested.
describe('public read paths only see policies in force', () => {
  it.each([
    ['getLatestAnalysis', () => getLatestAnalysis('site')],
    ['getLatestTermsAnalysis', () => getLatestTermsAnalysis('site')],
    ['getAnalysisHistory', () => getAnalysisHistory('site')],
    ['getRankings', () => getRankings(5)],
    ['getCoverageStats', () => getCoverageStats()],
  ])('%s', async (_name, run) => {
    await run();
    expect(sent().length).toBeGreaterThan(0);
    for (const sql of sent()) {
      expect(sql).toContain(IN_FORCE);
      // IN_FORCE references the `p` alias, so the join has to be there too.
      expect(sql).toMatch(/JOIN policies p ON p\.id = pa\.policy_id/);
    }
  });

  it('getRankings filters both the latest-per-source CTE and the outer select', async () => {
    await getRankings(5);
    for (const sql of sent()) {
      expect(sql.split(IN_FORCE).length - 1).toBeGreaterThanOrEqual(2);
    }
  });

  it('getCoverageStats filters good sources and both "last analyzed" subqueries', async () => {
    await getCoverageStats();
    const [sql] = sent();
    expect(sql!.split(IN_FORCE).length - 1).toBe(3);
  });
});

describe('getUpcomingAnalysis', () => {
  it('selects only future-dated policies, soonest first, and skips store-only types', async () => {
    await getUpcomingAnalysis('source');
    const [sql] = sent();
    expect(sql).toContain('p.effective_at > NOW()');
    expect(sql).not.toContain(IN_FORCE);
    expect(sql).toMatch(/ORDER BY p\.effective_at ASC/);
    expect(sql).toMatch(/policy_type NOT IN \('license', 'recruitment_notice', 'hipaa_notice', 'other'\)/);
  });
});

describe('getLatestAnalysis document preference', () => {
  it('ranks the privacy policy ahead of a newer terms of service', async () => {
    await getLatestAnalysis('site');
    expect(sent()[0]).toMatch(/ORDER BY \(ps\.policy_type = 'privacy_policy'\) DESC, pa\.analyzed_at DESC/);
  });

  it('getLatestTermsAnalysis only reads terms of service', async () => {
    await getLatestTermsAnalysis('site');
    expect(sent()[0]).toContain("ps.policy_type = 'terms_of_service'");
  });
});

describe('rankings and coverage are split by document type', () => {
  it.each([
    ['getRankings', () => getRankings(5, 'terms_of_service')],
    ['getCoverageStats', () => getCoverageStats('terms_of_service')],
  ])('%s passes the requested type', async (_name, run) => {
    await run();
    for (const call of queryMock.mock.calls) {
      expect(call[1]).toContain('terms_of_service');
    }
  });

  it('defaults to privacy policies', async () => {
    await getRankings(5);
    await getCoverageStats();
    for (const call of queryMock.mock.calls) {
      expect(call[1]).toContain('privacy_policy');
    }
  });
});
