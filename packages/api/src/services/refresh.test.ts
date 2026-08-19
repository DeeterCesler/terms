import { describe, it, expect } from 'vitest';
import { computeRefreshState, REFRESH_MIN_AGE_MS } from './refresh.js';

const NOW = new Date('2026-08-19T12:00:00.000Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

describe('computeRefreshState', () => {
  it('offers a re-check once the analysis is past the cooldown', () => {
    const state = computeRefreshState({ analyzedAt: daysAgo(31), now: NOW });
    expect(state).toEqual({ pending: false, eligible: true });
  });

  it('withholds a re-check while the analysis is still fresh', () => {
    const state = computeRefreshState({ analyzedAt: daysAgo(3), now: NOW });
    expect(state.eligible).toBe(false);
    expect(state.pending).toBe(false);
  });

  it('tells the caller when a withheld re-check becomes available', () => {
    const analyzedAt = daysAgo(3);
    const state = computeRefreshState({ analyzedAt, now: NOW });
    expect(state.eligibleAt).toBe(
      new Date(analyzedAt.getTime() + REFRESH_MIN_AGE_MS).toISOString()
    );
  });

  it('is eligible exactly at the cooldown boundary', () => {
    const analyzedAt = new Date(NOW.getTime() - REFRESH_MIN_AGE_MS);
    expect(computeRefreshState({ analyzedAt, now: NOW }).eligible).toBe(true);
  });

  it('is not eligible one millisecond before the boundary', () => {
    const analyzedAt = new Date(NOW.getTime() - REFRESH_MIN_AGE_MS + 1);
    expect(computeRefreshState({ analyzedAt, now: NOW }).eligible).toBe(false);
  });

  it('reports a pending request instead of offering another', () => {
    const requestedAt = daysAgo(1);
    const state = computeRefreshState({
      analyzedAt: daysAgo(90),
      refreshRequestedAt: requestedAt,
      now: NOW,
    });
    expect(state).toEqual({
      pending: true,
      eligible: false,
      requestedAt: requestedAt.toISOString(),
    });
  });

  // A queued re-check on a long-stale site would otherwise satisfy the age test
  // and be accepted a second time, duplicating the fetch + analysis.
  it('keeps a pending request from being re-queued no matter how stale', () => {
    const state = computeRefreshState({
      analyzedAt: daysAgo(3650),
      refreshRequestedAt: daysAgo(200),
      now: NOW,
    });
    expect(state.eligible).toBe(false);
  });

  it('treats a null refresh timestamp as no pending request', () => {
    const state = computeRefreshState({
      analyzedAt: daysAgo(31),
      refreshRequestedAt: null,
      now: NOW,
    });
    expect(state.pending).toBe(false);
    expect(state.eligible).toBe(true);
  });

  it('omits eligibleAt once the site is eligible', () => {
    const state = computeRefreshState({ analyzedAt: daysAgo(31), now: NOW });
    expect(state.eligibleAt).toBeUndefined();
  });
});
