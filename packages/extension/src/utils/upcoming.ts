// Upcoming-policy block as sent by GET /check. Absent on responses for sites
// with no announced policy, and on every response from an API build that
// predates the feature.
export interface UpcomingInfo {
  effectiveAt: string;
  policyUrl: string;
  analysis?: { overallScore?: number };
}

export interface UpcomingNotice {
  // e.g. "Oct 1, 2026"
  dateLabel: string;
  href: string;
  // Present only when the server sent a score for both versions.
  scoreChange?: { from: number; to: number };
}

// Decide whether to show the "new policy takes effect" notice. Returns null
// when there is nothing trustworthy to show: no block, a date that is unparseable
// or already past (a cached payload can outlive the switch-over), or a link that
// isn't plain http(s), which is never put in an href.
export function upcomingNotice(
  upcoming: UpcomingInfo | undefined,
  currentScore: number | undefined,
  now: number = Date.now(),
): UpcomingNotice | null {
  if (!upcoming || typeof upcoming.effectiveAt !== 'string') return null;

  const effective = Date.parse(upcoming.effectiveAt);
  if (Number.isNaN(effective) || effective <= now) return null;

  let href: string;
  try {
    const url = new URL(upcoming.policyUrl);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    href = url.href;
  } catch {
    return null;
  }

  // Effective dates are stored as midnight UTC, so format in UTC or US users
  // would see the day before.
  const dateLabel = new Date(effective).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });

  const to = upcoming.analysis?.overallScore;
  const scoreChange =
    typeof to === 'number' && typeof currentScore === 'number' ? { from: currentScore, to } : undefined;

  return { dateLabel, href, ...(scoreChange ? { scoreChange } : {}) };
}
