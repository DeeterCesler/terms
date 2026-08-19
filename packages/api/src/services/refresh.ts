import type { CheckResponse } from '@term-checker/shared';

/**
 * A user-triggered re-check costs a full fetch + analysis, so a site is only
 * eligible for one once its stored analysis has had time to go stale. The
 * per-IP requestRateLimiter can't cover this: five different users on the same
 * popular domain would otherwise each queue a refresh.
 */
export const REFRESH_MIN_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type RefreshState = NonNullable<CheckResponse['refresh']>;

/**
 * Decide what the extension should be told about re-checking a site, and
 * (via `eligible`) whether POST /request should accept one.
 *
 * A pending request always wins: the work is already queued, so there is
 * nothing to gain from accepting a second one, regardless of age.
 */
export function computeRefreshState(opts: {
  analyzedAt: Date;
  refreshRequestedAt?: Date | null;
  now?: Date;
}): RefreshState {
  const now = opts.now ?? new Date();
  const eligibleAt = new Date(opts.analyzedAt.getTime() + REFRESH_MIN_AGE_MS);
  const pending = opts.refreshRequestedAt != null;
  const eligible = !pending && eligibleAt.getTime() <= now.getTime();

  return {
    pending,
    eligible,
    ...(pending ? { requestedAt: opts.refreshRequestedAt!.toISOString() } : {}),
    ...(!pending && !eligible ? { eligibleAt: eligibleAt.toISOString() } : {}),
  };
}
