import { describe, it, expect } from 'vitest';
import { normalizeDomain, extractDomainFromUrl } from './domain.js';

describe('normalizeDomain', () => {
  it('returns the hostname for a bare domain', () => {
    expect(normalizeDomain('example.com')).toBe('example.com');
  });

  it('strips www. prefix', () => {
    expect(normalizeDomain('www.example.com')).toBe('example.com');
  });

  it('strips www. from a full URL', () => {
    expect(normalizeDomain('https://www.example.com/path?q=1')).toBe('example.com');
  });

  it('lowercases the hostname', () => {
    expect(normalizeDomain('EXAMPLE.COM')).toBe('example.com');
  });

  it('returns null for an invalid domain', () => {
    expect(normalizeDomain('not a domain')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(normalizeDomain('')).toBeNull();
  });

  it('handles subdomains other than www', () => {
    expect(normalizeDomain('app.example.com')).toBe('app.example.com');
  });

  it('handles a full URL without www', () => {
    expect(normalizeDomain('https://example.com/privacy')).toBe('example.com');
  });
});

describe('extractDomainFromUrl', () => {
  it('extracts domain from a full URL', () => {
    expect(extractDomainFromUrl('https://www.example.com/privacy')).toBe('example.com');
  });

  it('returns null for a non-URL string', () => {
    expect(extractDomainFromUrl('not-a-url')).toBeNull();
  });

  it('lowercases the result', () => {
    expect(extractDomainFromUrl('https://EXAMPLE.COM/page')).toBe('example.com');
  });
});
