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

export function splitDocuments(result: any): PolicyDocs {
  const top: PolicyDoc = {
    kind: result.documentType === 'terms_of_service' ? 'terms' : 'privacy',
    policyUrl: result.policyUrl,
    lastAnalyzed: result.lastAnalyzed,
    analysis: result.analysis,
    upcoming: result.upcoming,
    refresh: result.refresh,
  };

  if (top.kind === 'terms') {
    return { privacy: null, terms: top, initial: 'terms' };
  }

  const t = result.terms;
  const terms: PolicyDoc | null =
    t && t.analysis && typeof t.analysis.overallScore === 'number'
      ? { kind: 'terms', policyUrl: t.policyUrl, lastAnalyzed: t.lastAnalyzed, analysis: t.analysis }
      : null;

  return { privacy: top, terms, initial: 'privacy' };
}
