import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn(async (_text: string, _values?: unknown[]) => ({ rows: [] as unknown[] }));
vi.mock('../client.js', () => ({ pool: { query: queryMock, connect: vi.fn() } }));

const { getCurrentPolicy, insertUpcomingPolicy } = await import('./policies.js');

beforeEach(() => {
  queryMock.mockReset();
  queryMock.mockImplementation(async () => ({ rows: [] }));
});

describe('getCurrentPolicy', () => {
  it('considers upcoming policies whose effective date has passed', async () => {
    await getCurrentPolicy('source');
    const [sql] = queryMock.mock.calls[0]!;
    expect(sql).toMatch(/is_current = TRUE OR \(effective_at IS NOT NULL AND effective_at <= NOW\(\)\)/);
    // A refresh stored after the switch-over must still beat the promoted row.
    expect(sql).toMatch(/ORDER BY CASE WHEN is_current THEN created_at ELSE effective_at END DESC/);
    expect(sql).toMatch(/LIMIT 1/);
  });
});

describe('insertUpcomingPolicy', () => {
  const effective = new Date('2026-10-01T00:00:00Z');

  it('inserts as not current, with the effective date and url, without demoting anything', async () => {
    queryMock
      .mockImplementationOnce(async () => ({ rows: [] }))
      .mockImplementationOnce(async () => ({ rows: [{ id: 'new' }] }));

    const out = await insertUpcomingPolicy('source', 'text', 'hash', 200, effective, 'https://x.test/new');

    expect(out).toEqual({ policy: { id: 'new' }, created: true });
    const sqls = queryMock.mock.calls.map((c) => c[0]);
    expect(sqls.some((s) => /UPDATE policies/.test(s))).toBe(false);
    const [insertSql, values] = queryMock.mock.calls[1]!;
    expect(insertSql).toMatch(/VALUES \(\$1, \$2, \$3, \$4, \$5, FALSE, \$6, \$7\)/);
    expect(values).toEqual(['source', 'text', 'hash', 4, 200, effective, 'https://x.test/new']);
  });

  it('returns the existing row on a re-run instead of inserting a duplicate', async () => {
    queryMock.mockImplementationOnce(async () => ({ rows: [{ id: 'existing' }] }));

    const out = await insertUpcomingPolicy('source', 'text', 'hash', 200, effective, null);

    expect(out).toEqual({ policy: { id: 'existing' }, created: false });
    expect(queryMock).toHaveBeenCalledTimes(1);
  });
});
