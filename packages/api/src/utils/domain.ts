const DOMAIN_RE = /^[a-z0-9][a-z0-9\-\.]{1,251}[a-z0-9]$/i;

export function normalizeDomain(input: string): string | null {
  try {
    // If it looks like a URL, parse it
    const withScheme = input.startsWith('http') ? input : `https://${input}`;
    const url = new URL(withScheme);
    let hostname = url.hostname.toLowerCase();
    // Strip leading www.
    if (hostname.startsWith('www.')) hostname = hostname.slice(4);
    if (!DOMAIN_RE.test(hostname)) return null;
    return hostname;
  } catch {
    return null;
  }
}

export function extractDomainFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    let hostname = parsed.hostname.toLowerCase();
    if (hostname.startsWith('www.')) hostname = hostname.slice(4);
    if (!DOMAIN_RE.test(hostname)) return null;
    return hostname;
  } catch {
    return null;
  }
}
