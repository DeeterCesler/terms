// Split a GET /check payload into the documents the popup shows as tabs.
//
// The top-level `analysis` is the privacy policy whenever the site has one. The
// server labels it with `documentType`, and sends the site's default Terms of
// Service as `terms` alongside. A site with only a ToS gets it at the top level
// with documentType 'terms_of_service'. Server builds that predate the tabs send
// neither field; the top-level analysis is then treated as the privacy policy,
// which is what it was presented as before.
//
// Newer servers also send `termsDocs`: every Terms document for the site, site-wide
// ones first (the first is the default), then path-scoped ones (longest prefix
// first) that govern only pages under a path, such as the Businesses in ChatGPT
// Terms on chatgpt.com/business-hub. The Terms tab then opens on the document that
// matches the tab's path, or the default, and offers the rest in a switcher.

export type DocKind = 'privacy' | 'terms';

export interface PolicyDoc {
  kind: DocKind;
  policyUrl: string;
  lastAnalyzed: string;
  analysis: any;
  // Display name for a Terms document ("Terms of Service", "Seller Terms").
  label?: string;
  // Set when the document applies only to pages under this path.
  pathPrefix?: string;
  // Upcoming-policy notice and re-check state belong to the top-level document
  // only; the server does not send them for other documents.
  upcoming?: any;
  refresh?: any;
}

export interface PolicyDocs {
  privacy: PolicyDoc | null;
  // The Terms document the Terms tab opens on (null when none applies here).
  terms: PolicyDoc | null;
  // Every Terms document the switcher offers, in server order. Empty or a single
  // entry means there is nothing to switch between.
  termsOptions: PolicyDoc[];
  // The tab to open on.
  initial: DocKind;
}

// True when `pathname` is `prefix` itself or a page beneath it, matching on
// whole segments so /business-hub does not catch /business-hubris.
export function pathMatches(pathname: string, prefix: string): boolean {
  const base = prefix.replace(/\/+$/, '');
  return pathname === base || pathname.startsWith(`${base}/`);
}

function hasScore(a: any): boolean {
  return !!a && typeof a.overallScore === 'number';
}

function termsOptionsFrom(result: any): PolicyDoc[] | null {
  if (!Array.isArray(result.termsDocs)) return null;
  return result.termsDocs
    .filter((e: any) => e && hasScore(e.analysis) && typeof e.policyUrl === 'string')
    .map((e: any): PolicyDoc => ({
      kind: 'terms',
      policyUrl: e.policyUrl,
      lastAnalyzed: e.lastAnalyzed,
      analysis: e.analysis,
      label: typeof e.label === 'string' ? e.label : 'Terms of Service',
      ...(typeof e.pathPrefix === 'string' ? { pathPrefix: e.pathPrefix } : {}),
    }));
}

// `pathname` is the current tab's path.
export function splitDocuments(result: any, pathname?: string): PolicyDocs {
  const top: PolicyDoc = {
    kind: result.documentType === 'terms_of_service' ? 'terms' : 'privacy',
    policyUrl: result.policyUrl,
    lastAnalyzed: result.lastAnalyzed,
    analysis: result.analysis,
    upcoming: result.upcoming,
    refresh: result.refresh,
  };
  const privacy = top.kind === 'privacy' ? top : null;

  const options = termsOptionsFrom(result);
  if (!options) {
    // Server without termsDocs: one Terms document at most.
    if (top.kind === 'terms') return { privacy: null, terms: top, termsOptions: [top], initial: 'terms' };
    const t = result.terms;
    const terms: PolicyDoc | null = t && hasScore(t.analysis)
      ? { kind: 'terms', policyUrl: t.policyUrl, lastAnalyzed: t.lastAnalyzed, analysis: t.analysis }
      : null;
    return { privacy, terms, termsOptions: terms ? [terms] : [], initial: 'privacy' };
  }

  // A ToS-only site's top-level document is its default Terms; keep its re-check
  // and upcoming state on the matching option.
  if (top.kind === 'terms') {
    const same = options.find((o) => !o.pathPrefix && o.policyUrl === top.policyUrl);
    if (same) Object.assign(same, { upcoming: top.upcoming, refresh: top.refresh });
  }

  const scoped = pathname ? options.find((o) => o.pathPrefix && pathMatches(pathname, o.pathPrefix)) : undefined;
  const terms = scoped ?? options.find((o) => !o.pathPrefix) ?? null;
  const initial: DocKind = scoped || !privacy ? 'terms' : 'privacy';
  return { privacy, terms, termsOptions: options, initial };
}
