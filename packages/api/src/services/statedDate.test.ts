import { describe, it, expect } from 'vitest';
import { extractStatedDate, parseStatedDate } from './statedDate.js';
import { extractPolicyText, processRawText } from './crawler.js';

describe('extractStatedDate', () => {
  it.each([
    ['Privacy Policy\nLast updated: March 3, 2025\nWe collect...', '2025-03-03'],
    ['Effective Date: 1 January 2024', '2024-01-01'],
    ['Effective as of Sept. 12, 2023.', '2023-09-12'],
    ['Updated February 2025', '2025-02-01'],
    ['Last Revised on 2024-11-30', '2024-11-30'],
    ['最終改定日：2024年4月1日', '2024-04-01'],
    ['2023年10月1日 改定', '2023-10-01'],
    ['시행일자: 2024년 5월 1일', '2024-05-01'],
  ])('reads %j', (text, date) => {
    expect(extractStatedDate(text)?.date).toBe(date);
  });

  it('keeps the text but no date when the format is ambiguous or non-English', () => {
    expect(extractStatedDate('Last updated: 03/04/2025')).toEqual({ text: 'Last updated: 03/04/2025', date: null });
    expect(extractStatedDate('Stand: 1. März 2025')?.date).toBeNull();
    expect(extractStatedDate('Dernière mise à jour le 12 mars 2024')?.text).toContain('12 mars 2024');
  });

  it('prefers an effective date over an updated date', () => {
    const r = extractStatedDate('Last updated: May 1, 2025\nEffective date: June 1, 2025');
    expect(r?.date).toBe('2025-06-01');
  });

  it('crosses a line break between label and date', () => {
    expect(extractStatedDate('Last updated\nMarch 3, 2025')?.date).toBe('2025-03-03');
  });

  it('ignores dates with no label next to them', () => {
    expect(extractStatedDate('DuckDuckGo has been independent since our founding in 2008.')).toBeNull();
    expect(extractStatedDate('Nevada Revised Statutes Chapter 603A')).toBeNull();
    expect(extractStatedDate('We will post a notice when our policy is updated.')).toBeNull();
  });

  it('does not match labels inside other words', () => {
    expect(extractStatedDate('an outdated March 2020 browser')).toBeNull();
    expect(extractStatedDate('we understand, January 2020')).toBeNull();
  });

  it('rejects impossible calendar dates', () => {
    expect(parseStatedDate('February 30, 2025')).toBeNull();
  });
});

describe('crawler stated date capture', () => {
  it('captures the date that normalization strips from stored text', () => {
    const r = processRawText('Privacy Policy\nLast updated: March 3, 2025\nWe collect your email.', 'https://x.test');
    expect(r.text).not.toContain('2025');
    expect(r.statedDate?.date).toBe('2025-03-03');
  });

  it('finds a date in a <header> that extraction removes, without altering stored text', () => {
    const html = '<html><body><header><h1>Privacy Policy</h1><p>Effective date: January 5, 2026</p></header>'
      + '<main><article><h2>What we collect</h2><p>' + 'We collect your name and email. '.repeat(40) + '</p></article></main></body></html>';
    const withDate = extractPolicyText(html, 'https://x.test/privacy');
    const withoutDate = extractPolicyText(html.replace('<p>Effective date: January 5, 2026</p>', ''), 'https://x.test/privacy');
    expect(withDate.statedDate?.date).toBe('2026-01-05');
    expect(withDate.contentHash).toBe(withoutDate.contentHash);
  });

  it('returns null when the page states no date', () => {
    const html = '<html><body><article><p>' + 'We collect your email. '.repeat(40) + '</p></article></body></html>';
    expect(extractPolicyText(html, 'https://x.test/privacy').statedDate).toBeNull();
  });
});
