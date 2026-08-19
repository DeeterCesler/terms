import type { AnalysisResult } from './analysis.js';

export interface CheckResponse {
  found: true;
  domain: string;
  policyUrl: string;
  lastAnalyzed: string;
  // Other domains that share the exact same source policy (corporate-wide
  // statements like Disney covering disney.com, espn.com, etc.). Optional on
  // the wire so already-shipped extension builds keep working.
  sharedDomains?: string[];
  // Whether the user can ask us to re-check this policy, and whether someone
  // already has. Optional on the wire so already-shipped extension builds,
  // which don't render a recheck button at all, keep working unchanged.
  refresh?: {
    // A re-check is already queued for this site.
    pending: boolean;
    // POST /request/:domain will be honored right now. False while the stored
    // analysis is still inside the cooldown window.
    eligible: boolean;
    // When the pending request came in (only with pending: true).
    requestedAt?: string;
    // When the cooldown lifts (only with eligible: false).
    eligibleAt?: string;
  };
  analysis: {
    sharesWithThirdParties: { value: boolean | null; evidence: string | null };
    sellsData: { value: boolean | null; evidence: string | null };
    dataAnonymized: { value: boolean | null; evidence: string | null };
    dataRetention: string | null;
    userRights: string[];
    overallScore: number;
    summary: string;
    highlights: Array<{ kind: 'good' | 'bad'; text: string }>;
    // Present and true only for sites with no meaningful privacy policy.
    // Omitted otherwise (rather than sent as false) so already-shipped extension
    // builds, which don't know the field, keep rendering unchanged.
    noMeaningfulPolicy?: boolean;
  };
}

export interface RankingsResponse {
  best: Array<{ domain: string; overallScore: number; summary: string; sharedDomains?: string[] }>;
  worst: Array<{ domain: string; overallScore: number; summary: string; sharedDomains?: string[] }>;
}

export interface CheckNotFoundResponse {
  found: false;
  domain: string;
  requested?: { at: string };
}

export type CheckResult = CheckResponse | CheckNotFoundResponse;

export interface HistoryEntry {
  analysisId: string;
  analyzedAt: string;
  promptVersion: string;
  modelUsed: string;
  analysis: CheckResponse['analysis'];
}

export interface AdminSiteListItem {
  domain: string;
  policyUrl: string;
  createdAt: string;
  lastAnalyzed: string | null;
  overallScore: number | null;
  queueStatus: 'pending' | 'processing' | 'done' | 'failed' | null;
  queueUpdatedAt: string | null;
}

export interface AdminQueueItem {
  id: string;
  domain: string;
  action: 'crawl_and_analyze' | 'reanalyze';
  status: 'pending' | 'processing' | 'done' | 'failed';
  triggeredBy: string | null;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}
