// Split a GET /check payload into the two documents the popup shows as tabs.
//
// The top-level `analysis` is the privacy policy whenever the site has one. The
// server labels it with `documentType`, and sends the site's Terms of Service as
// `terms` alongside. A site with only a ToS gets it at the top level with
// documentType 'terms_of_service'. Server builds that predate the tabs send
// neither field; the top-level analysis is then treated as the privacy policy,
// which is what it was presented as before.

export type DocKind = 'privacy' | 'terms';

export interface PolicyDoc {
  kind: DocKind;
  policyUrl: string;
  lastAnalyzed: string;
  analysis: any;
  // Upcoming-policy notice and re-check state belong to the top-level document
  // only; the server does not send them for `terms`.
  upcoming?: any;
  refresh?: any;
}

export interface PolicyDocs {
  privacy: PolicyDoc | null;
  terms: PolicyDoc | null;
  // The tab to open on: privacy when there is one, otherwise terms.
  initial: DocKind;
}

// True when `pathname` is `prefix` itself or a page beneath it, matching on
// whole segments so /business-hub does not catch /business-hubris.
export function pathMatches(pathname: string, prefix: string): boolean {
  const base = prefix.replace(/\/+$/, '');
  return pathname === base || pathname.startsWith(`${base}/`);
}

// The path-scoped Terms (server field `pathTerms`, longest prefix first) that
// govern this page, if any. Matching runs here so the path never leaves the device.
function pathScopedTerms(result: any, pathname: string | undefined): PolicyDoc | null {
  if (!pathname || !Array.isArray(result.pathTerms)) return null;
  const t = result.pathTerms.find(
    (e: any) => typeof e?.pathPrefix === 'string' && pathMatches(pathname, e.pathPrefix),
  );
  if (!t || !t.analysis || typeof t.analysis.overallScore !== 'number') return null;
  return { kind: 'terms', policyUrl: t.policyUrl, lastAnalyzed: t.lastAnalyzed, analysis: t.analysis };
}

// `pathname` is the current tab's path. When path-scoped Terms match it, they
// replace the site-wide Terms and the popup opens on the Terms tab, since they
// are the document that governs the page.
export function splitDocuments(result: any, pathname?: string): PolicyDocs {
  const scoped = pathScopedTerms(result, pathname);
  const top: PolicyDoc = {
    kind: result.documentType === 'terms_of_service' ? 'terms' : 'privacy',
    policyUrl: result.policyUrl,
    lastAnalyzed: result.lastAnalyzed,
    analysis: result.analysis,
    upcoming: result.upcoming,
    refresh: result.refresh,
  };

  if (top.kind === 'terms') {
    return { privacy: null, terms: scoped ?? top, initial: 'terms' };
  }
  if (scoped) return { privacy: top, terms: scoped, initial: 'terms' };

  const t = result.terms;
  const terms: PolicyDoc | null =
    t && t.analysis && typeof t.analysis.overallScore === 'number'
      ? { kind: 'terms', policyUrl: t.policyUrl, lastAnalyzed: t.lastAnalyzed, analysis: t.analysis }
      : null;

  return { privacy: top, terms, initial: 'privacy' };
}
