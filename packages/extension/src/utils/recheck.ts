// Refresh block as sent by GET /check. Absent entirely on responses from an
// API build that predates the re-request feature.
export interface RefreshInfo {
  pending: boolean;
  eligible: boolean;
  requestedAt?: string;
  eligibleAt?: string;
}

export type RecheckState =
  // Show nothing: either the server doesn't send refresh state at all, or the
  // stored analysis is too recent for a re-check to be accepted. Rendering a
  // button whose POST would be rejected (or, on an old server, silently treated
  // as a first-time request) is worse than rendering nothing.
  | { kind: 'hidden' }
  // A re-check is already queued — report it, offer no button.
  | { kind: 'queued'; requestedAt?: string }
  // Offer the button.
  | { kind: 'available' };

export function recheckState(refresh: RefreshInfo | undefined): RecheckState {
  if (!refresh) return { kind: 'hidden' };
  if (refresh.pending) return { kind: 'queued', requestedAt: refresh.requestedAt };
  if (!refresh.eligible) return { kind: 'hidden' };
  return { kind: 'available' };
}
