import { describe, it, expect } from 'vitest';
import { upcomingNotice } from './upcoming.js';

const NOW = Date.parse('2026-09-13T12:00:00Z');
const base = {
  effectiveAt: '2026-10-01T00:00:00.000Z',
  policyUrl: 'https://example.com/privacy-2026',
  analysis: { overallScore: 4 },
};

describe('upcomingNotice', () => {
  it('returns null when the server sends no upcoming block', () => {
    expect(upcomingNotice(undefined, 8, NOW)).toBeNull();
  });

  it('formats the date in UTC so midnight-UTC dates do not slip a day', () => {
    expect(upcomingNotice(base, 8, NOW)?.dateLabel).toBe('Oct 1, 2026');
  });

  it('includes the score change when both scores are known', () => {
    expect(upcomingNotice(base, 8, NOW)?.scoreChange).toEqual({ from: 8, to: 4 });
  });

  it('omits the score change when the upcoming analysis has no score', () => {
    expect(upcomingNotice({ ...base, analysis: undefined }, 8, NOW)?.scoreChange).toBeUndefined();
  });

  it('hides the notice once the effective date has passed', () => {
    expect(upcomingNotice(base, 8, Date.parse('2026-10-01T00:00:01Z'))).toBeNull();
  });

  it('hides the notice on an unparseable date', () => {
    expect(upcomingNotice({ ...base, effectiveAt: 'soon' }, 8, NOW)).toBeNull();
  });

  it('never links to a non-http(s) URL', () => {
    expect(upcomingNotice({ ...base, policyUrl: 'javascript:alert(1)' }, 8, NOW)).toBeNull();
    expect(upcomingNotice({ ...base, policyUrl: 'not a url' }, 8, NOW)).toBeNull();
  });
});
