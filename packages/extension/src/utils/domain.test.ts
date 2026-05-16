import { describe, it, expect } from 'vitest';
import { normalizeDomain } from './domain.js';

describe('normalizeDomain (extension)', () => {
  it('returns the hostname for a full URL', () => {
    expect(normalizeDomain('https://example.com/page')).toBe('example.com');
  });

  it('strips www. prefix', () => {
    expect(normalizeDomain('https://www.example.com')).toBe('example.com');
  });

  it('lowercases the hostname', () => {
    expect(normalizeDomain('https://EXAMPLE.COM')).toBe('example.com');
  });

  it('returns null for a non-URL string', () => {
    expect(normalizeDomain('not a url')).toBeNull();
  });

  it('returns null for a hostname that is too short', () => {
    expect(normalizeDomain('https://ab')).toBeNull();
  });

  it('preserves subdomains other than www', () => {
    expect(normalizeDomain('https://app.example.com/path')).toBe('app.example.com');
  });
});
