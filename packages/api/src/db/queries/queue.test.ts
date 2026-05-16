import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db client before importing queue functions
vi.mock('../client.js', () => ({
  pool: { query: vi.fn() },
}));

import { pool } from '../client.js';
import { enqueueJob, claimNextJob, completeJob, failJob } from './queue.js';

const mockQuery = pool.query as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockQuery.mockReset();
});

const pendingRow = {
  id: 'job-1',
  site_id: 'site-1',
  action: 'crawl_and_analyze',
  status: 'pending',
  triggered_by: 'api',
  created_at: new Date(),
  started_at: null,
  completed_at: null,
  error_message: null,
};

describe('enqueueJob', () => {
  it('inserts a pending row and returns it', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [pendingRow] });
    const result = await enqueueJob('site-1', 'crawl_and_analyze', 'api');
    expect(result).toEqual(pendingRow);
    expect(mockQuery).toHaveBeenCalledOnce();
  });
});

describe('claimNextJob', () => {
  it('returns null when no pending jobs exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const result = await claimNextJob();
    expect(result).toBeNull();
  });

  it('returns the claimed job row', async () => {
    const processingRow = { ...pendingRow, status: 'processing', started_at: new Date() };
    mockQuery.mockResolvedValueOnce({ rows: [processingRow] });
    const result = await claimNextJob();
    expect(result?.status).toBe('processing');
  });

  it('uses FOR UPDATE SKIP LOCKED in the query', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await claimNextJob();
    const sql: string = mockQuery.mock.calls[0][0];
    expect(sql).toMatch(/FOR UPDATE SKIP LOCKED/i);
  });
});

describe('completeJob', () => {
  it('sets status to done', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await completeJob('job-1');
    const sql: string = mockQuery.mock.calls[0][0];
    expect(sql).toMatch(/status\s*=\s*'done'/);
  });
});

describe('failJob', () => {
  it('sets status to failed with error message', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await failJob('job-1', 'something went wrong');
    const args: unknown[] = mockQuery.mock.calls[0][1];
    expect(args).toContain('job-1');
    expect(args).toContain('something went wrong');
  });
});
