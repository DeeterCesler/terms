export type PolicyType =
  | 'privacy_policy'
  | 'terms_of_service'
  | 'cookie_policy'
  | 'data_processing_agreement'
  | 'acceptable_use_policy'
  | 'license'
  | 'recruitment_notice'
  | 'other';

export interface SiteRow {
  id: string;
  domain: string;
  name: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PolicySourceRow {
  id: string;
  site_id: string;
  url: string;
  product: string | null;
  policy_type: PolicyType;
  created_at: Date;
  updated_at: Date;
}

export interface PolicyRow {
  id: string;
  policy_source_id: string;
  fetched_at: Date;
  content_hash: string;
  raw_text: string;
  char_count: number;
  http_status: number | null;
  is_current: boolean;
  // NULL = in force. Future = announced upcoming policy (migration 010).
  effective_at: Date | null;
  // Version-specific URL when it differs from the source URL. NULL = source URL.
  url: string | null;
  // Date the document states about itself, captured before normalization
  // strips it (migration 011). Checked = FALSE means the row predates capture.
  stated_date_text: string | null;
  stated_date: Date | null;
  stated_date_checked: boolean;
  created_at: Date;
}

export interface PolicyAnalysisRow {
  id: string;
  policy_id: string;
  site_id: string;
  policy_source_id: string;
  analyzed_at: Date;
  model_used: string;
  prompt_version: string;
  shares_with_third_parties: boolean | null;
  shares_evidence: string | null;
  sells_data: boolean | null;
  sells_evidence: string | null;
  data_anonymized: boolean | null;
  anonymized_evidence: string | null;
  data_retention: string | null;
  user_rights: string[] | null;
  overall_score: number | null;
  summary: string | null;
  highlights: Array<{ kind: 'good' | 'bad'; text: string }> | null;
  // NULL = not assessed (every analysis predating migration 008).
  no_meaningful_policy: boolean | null;
  raw_response: unknown;
  status: 'pending' | 'processing' | 'done' | 'failed';
  error_message: string | null;
  created_at: Date;
}

export interface PolicyCandidateRow {
  id: string;
  domain: string;
  name: string | null;
  product: string | null;
  policy_type: PolicyType;
  url: string | null;
  priority: number;
  notes: string | null;
  added_at: Date;
  // Non-NULL when a user asked us to re-check a site we already analyzed.
  // Cleared once the refresh runner re-fetches the source.
  refresh_requested_at: Date | null;
}

export interface ProcessingQueueRow {
  id: string;
  site_id: string;
  policy_source_id: string | null;
  action: 'crawl_and_analyze' | 'reanalyze';
  status: 'pending' | 'processing' | 'done' | 'failed';
  triggered_by: string | null;
  error_message: string | null;
  created_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
}
