import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn(async (_text: string) => ({ rows: [] }));
const releaseMock = vi.fn();
const connectMock = vi.fn(async () => ({ query: queryMock, release: releaseMock }));

vi.mock('pg', () => ({
  default: {
    Pool: vi.fn().mockImplementation(() => ({
      connect: connectMock,
      on: vi.fn(),
    })),
  },
}));

vi.mock('../config.js', () => ({
  config: { databaseUrl: 'postgres://test', adminSecret: 'test' },
}));

const { withTransaction } = await import('./client.js');

beforeEach(() => {
  queryMock.mockClear();
  releaseMock.mockClear();
  connectMock.mockClear();
  queryMock.mockImplementation(async () => ({ rows: [] }));
});

describe('withTransaction', () => {
  it('wraps fn in BEGIN/COMMIT and returns its result', async () => {
    const result = await withTransaction(async (tx) => {
      await tx.query('INSERT INTO x VALUES (1)');
      return 'done';
    });

    expect(result).toBe('done');
    const calls = queryMock.mock.calls.map(c => c[0]);
    expect(calls).toEqual(['BEGIN', 'INSERT INTO x VALUES (1)', 'COMMIT']);
  });

  it('releases the client back to the pool on success', async () => {
    await withTransaction(async () => 'ok');
    expect(releaseMock).toHaveBeenCalledTimes(1);
  });

  it('rolls back and rethrows the original error when fn throws', async () => {
    const boom = new Error('insert failed');

    await expect(
      withTransaction(async () => {
        throw boom;
      })
    ).rejects.toBe(boom);

    const calls = queryMock.mock.calls.map(c => c[0]);
    expect(calls).toEqual(['BEGIN', 'ROLLBACK']);
    expect(releaseMock).toHaveBeenCalledTimes(1);
  });

  it('still rethrows the original error if the ROLLBACK itself fails', async () => {
    const boom = new Error('insert failed');
    queryMock.mockImplementation(async (text: string) => {
      if (text === 'ROLLBACK') throw new Error('connection already gone');
      return { rows: [] };
    });

    await expect(
      withTransaction(async () => {
        throw boom;
      })
    ).rejects.toBe(boom);

    expect(releaseMock).toHaveBeenCalledTimes(1);
  });

  it('releases the client even when fn throws', async () => {
    await expect(
      withTransaction(async () => {
        throw new Error('nope');
      })
    ).rejects.toThrow('nope');

    expect(releaseMock).toHaveBeenCalledTimes(1);
  });
});
