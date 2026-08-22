import { z } from 'zod';

export const FindingSchema = z.object({
  value: z.boolean().nullable(),
  evidence: z.string().nullable(),
});

export const HighlightSchema = z.object({
  kind: z.enum(['good', 'bad']),
  text: z.string().min(1),
});

export const AnalysisResultSchema = z.object({
  shares_with_third_parties: FindingSchema,
  sells_data: FindingSchema,
  data_anonymized: FindingSchema,
  data_retention: z.string().nullable(),
  user_rights: z.array(z.string()),
  overall_score: z.number().int().min(1).max(10),
  summary: z.string(),
  highlights: z.array(HighlightSchema).optional(),
  // TRUE when the site publishes no meaningful privacy policy: nothing at all,
  // or a generated boilerplate template that grants no statutory rights, sets no
  // retention period, and offers no access or deletion route. The other fields
  // stay populated (a template still says something about cookies and ad tech);
  // this just marks that there is no real policy behind them. Optional, so every
  // existing analysis JSON keeps parsing.
  no_meaningful_policy: z.boolean().optional(),
});

export type Finding = z.infer<typeof FindingSchema>;
export type Highlight = z.infer<typeof HighlightSchema>;
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

// License agreements / EULAs (policy_type = 'license') are analyzed through a
// different lens than privacy policies. The structured result is stored in
// policy_analyses.raw_response; the privacy columns stay NULL. overall_score,
// summary, and highlights are shared with the privacy schema for reuse.
export const LicenseAnalysisResultSchema = z.object({
  reverse_engineering_restricted: FindingSchema,
  redistribution_restricted: FindingSchema,
  commercial_use_restricted: FindingSchema,
  warranty_disclaimed: FindingSchema,
  liability_limited: FindingSchema,
  telemetry_data_collection: FindingSchema,
  ip_ownership: z.string().nullable(),
  termination_terms: z.string().nullable(),
  license_scope: z.string().nullable(),
  overall_score: z.number().int().min(1).max(10),
  summary: z.string(),
  highlights: z.array(HighlightSchema).optional(),
});

export type LicenseAnalysisResult = z.infer<typeof LicenseAnalysisResultSchema>;

// Recruitment / job-applicant privacy notices (policy_type = 'recruitment_notice')
// are analyzed through their own lens, distinct from the consumer privacy lens:
// the relevant questions are about applicant data (sensitive categories, background
// checks, AI-assisted hiring) rather than ad-tech sale/sharing. Like the license
// lens, the structured result is stored in policy_analyses.raw_response, the
// privacy columns stay NULL, and overall_score / summary / highlights are shared
// with the privacy schema for reuse. Store-only: excluded from all public read paths.
export const RecruitmentAnalysisResultSchema = z.object({
  sells_or_shares_for_advertising: FindingSchema,
  collects_sensitive_information: FindingSchema,
  background_checks: FindingSchema,
  ai_or_automated_tools: FindingSchema,
  third_party_data_sources: FindingSchema,
  shares_with_affiliates: FindingSchema,
  international_transfers: FindingSchema,
  data_retention: z.string().nullable(),
  applicant_rights: z.array(z.string()),
  overall_score: z.number().int().min(1).max(10),
  summary: z.string(),
  highlights: z.array(HighlightSchema).optional(),
});

export type RecruitmentAnalysisResult = z.infer<typeof RecruitmentAnalysisResultSchema>;

export const SCORE_TIERS = {
  GOOD: { min: 8, max: 10, label: 'Good', color: '#22c55e' },
  FAIR: { min: 5, max: 7, label: 'Fair', color: '#f59e0b' },
  POOR: { min: 1, max: 4, label: 'Poor', color: '#ef4444' },
} as const;

export function getScoreTier(score: number) {
  if (score >= SCORE_TIERS.GOOD.min) return SCORE_TIERS.GOOD;
  if (score >= SCORE_TIERS.FAIR.min) return SCORE_TIERS.FAIR;
  return SCORE_TIERS.POOR;
}

export const PROMPT_VERSION = '1.0.0';
export const LICENSE_PROMPT_VERSION = '1.0.0';
export const RECRUITMENT_PROMPT_VERSION = '1.0.0';
