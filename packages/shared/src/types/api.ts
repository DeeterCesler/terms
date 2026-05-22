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
  analysis: {
    sharesWithThirdParties: { value: boolean | null; evidence: string | null };
    sellsData: { value: boolean | null; evidence: string | null };
    dataAnonymized: { value: boolean | null; evidence: string | null };
    dataRetention: string | null;
    userRights: string[];
    overallScore: number;
    summary: string;
    highlights: Array<{ kind: 'good' | 'bad'; text: string }>;
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
