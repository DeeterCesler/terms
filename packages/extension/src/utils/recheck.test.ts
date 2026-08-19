import { describe, it, expect } from 'vitest';
import { recheckState } from './recheck.js';

describe('recheckState', () => {
  // An API build that predates the feature sends no refresh block at all; the
  // button must stay hidden rather than POST a request the old server would
  // treat as a first-time analysis request.
  it('hides the button when the server sends no refresh state', () => {
    expect(recheckState(undefined)).toEqual({ kind: 'hidden' });
  });

  it('hides the button while the analysis is too recent', () => {
    expect(recheckState({ pending: false, eligible: false })).toEqual({ kind: 'hidden' });
  });

  it('offers the button when the server says a re-check is eligible', () => {
    expect(recheckState({ pending: false, eligible: true })).toEqual({ kind: 'available' });
  });

  it('reports a queued re-check with its date', () => {
    expect(
      recheckState({ pending: true, eligible: false, requestedAt: '2026-08-01T00:00:00.000Z' })
    ).toEqual({ kind: 'queued', requestedAt: '2026-08-01T00:00:00.000Z' });
  });

  it('reports a queued re-check even without a date', () => {
    expect(recheckState({ pending: true, eligible: false })).toEqual({
      kind: 'queued',
      requestedAt: undefined,
    });
  });

  // Defensive: pending always wins, so a malformed payload claiming both can
  // never render a button that would duplicate queued work.
  it('prefers the queued state when the payload claims both', () => {
    expect(recheckState({ pending: true, eligible: true }).kind).toBe('queued');
  });
});
