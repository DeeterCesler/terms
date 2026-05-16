export function normalizeDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    let hostname = parsed.hostname.toLowerCase();
    if (hostname.startsWith('www.')) hostname = hostname.slice(4);
    if (!hostname || hostname.length < 3) return null;
    return hostname;
  } catch {
    return null;
  }
}
