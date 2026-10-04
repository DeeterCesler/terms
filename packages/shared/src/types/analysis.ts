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

// HIPAA Notices of Privacy Practices (policy_type = 'hipaa_notice') are the
// notice a health plan or covered provider must give about protected health
// information. The relevant questions are nothing like the consumer privacy
// lens: there is no ad-tech "sale" to ask about, but there is underwriting,
// disclosure to an employer plan sponsor, reporting into insurance information
// exchanges like MIB, and whether the extra-sensitive categories (substance
// use, reproductive health, HIV, mental health) get protection above the HIPAA
// floor. Like the license and recruitment lenses, the structured result is
// stored in policy_analyses.raw_response, the privacy columns stay NULL, and
// overall_score / summary / highlights are shared with the privacy schema for
// reuse. Store-only: excluded from all public read paths, so a plan member
// notice never stands in for the insurer website's own privacy policy.
export const HipaaAnalysisResultSchema = z.object({
  // PHI used to price or underwrite coverage. Genetic information is barred
  // from underwriting by GINA, so a notice that stays silent on it is worse
  // than one that says so.
  underwriting_use: FindingSchema,
  // Disclosure to an employer sponsoring the group plan, beyond the summary
  // and enrollment data HIPAA already permits.
  plan_sponsor_disclosure: FindingSchema,
  // Marketing uses and any sale of PHI require written authorization.
  marketing_requires_authorization: FindingSchema,
  // Protections above the HIPAA floor for substance use (42 CFR Part 2),
  // reproductive and sexual health, HIV, mental health, genetic, biometric.
  sensitive_category_protections: FindingSchema,
  // Reporting into an insurance information exchange (MIB) or pulling a
  // consumer / investigative consumer report under the FCRA.
  information_exchange_reporting: FindingSchema,
  // Whether a requested restriction on use or disclosure is actually binding,
  // or the plan reserves the right to refuse it.
  restriction_requests_binding: FindingSchema,
  // The HIPAA right to an accounting of disclosures, and how far back it runs.
  accounting_of_disclosures: FindingSchema,
  // Deletion, amendment, or other rights granted under state law on top of HIPAA.
  state_law_rights: FindingSchema,
  data_retention: z.string().nullable(),
  // How the notice says a member actually exercises rights: in writing, by
  // phone, online. A written-only route is a real friction cost.
  exercise_mechanism: z.string().nullable(),
  member_rights: z.array(z.string()),
  // Legal entities the notice is issued on behalf of. A single notice often
  // covers several underwriters.
  covered_entities: z.array(z.string()),
  overall_score: z.number().int().min(1).max(10),
  summary: z.string(),
  highlights: z.array(HighlightSchema).optional(),
});

export type HipaaAnalysisResult = z.infer<typeof HipaaAnalysisResultSchema>;

// German-market lens. Germany has no separate privacy regime: the DSGVO is the
// GDPR itself. What differs is the national layer on top of it, and that layer
// is what this lens asks about: the BDSG (data protection officer threshold,
// credit scoring), the TDDDG (consent before any non-essential cookie or other
// device access, section 25), and the German habit of a Datenschutzerklaerung
// that names a legal basis and a storage period for every single purpose.
// Unlike the license, recruitment and HIPAA lenses this is not a policy type:
// it is a supplementary reading of an ordinary privacy policy, stored next to
// the standard result under raw_response.german. The privacy columns and the
// standard overall_score are untouched, so nothing on a public read path
// changes. overall_score here grades the German layer only.
export const GermanAnalysisResultSchema = z.object({
  // The Verantwortlicher is named with a full postal address (Art. 13(1)(a)),
  // not just a brand name or a contact form.
  controller_identified: FindingSchema,
  // A Datenschutzbeauftragter with contact details (Art. 13(1)(b)). Mandatory
  // under BDSG section 38 once 20 people regularly process personal data.
  dpo_named: FindingSchema,
  // An Art. 6 legal basis is cited per purpose, rather than one blanket list.
  legal_basis_per_purpose: FindingSchema,
  // Tracking, profiling or advertising rested on legitimate interest
  // (Art. 6(1)(f)) where German regulators expect consent.
  legitimate_interest_for_tracking: FindingSchema,
  // Non-essential cookies and similar device access only after opt-in consent
  // (TDDDG section 25). A policy still citing the TTDSG or TMG is out of date.
  cookie_consent_opt_in: FindingSchema,
  // Transfers outside the EU/EEA, in practice mostly to the US.
  third_country_transfers: FindingSchema,
  // The safeguard relied on for those transfers: Data Privacy Framework,
  // standard contractual clauses, an Art. 49 derogation. Null when none is given.
  transfer_safeguards: z.string().nullable(),
  // The right to complain (Art. 77) names the competent Landesbehoerde instead
  // of pointing at "a supervisory authority".
  supervisory_authority_named: FindingSchema,
  // The Widerspruchsrecht is set apart from the other rights, as Art. 21(4)
  // requires, not buried in a list.
  objection_right_separate: FindingSchema,
  // Consent can be withdrawn as easily as it was given (Art. 7(3)).
  consent_withdrawal: FindingSchema,
  // Credit checks or scoring through SCHUFA or a similar agency (BDSG
  // section 31), or other solely automated decisions under Art. 22.
  credit_scoring_or_automated_decisions: FindingSchema,
  // Storage periods. German policies usually lean on the statutory commercial
  // and tax retention duties (HGB section 257, AO section 147: 6 to 10 years).
  data_retention: z.string().nullable(),
  data_subject_rights: z.array(z.string()),
  overall_score: z.number().int().min(1).max(10),
  summary: z.string(),
  highlights: z.array(HighlightSchema).optional(),
});

export type GermanAnalysisResult = z.infer<typeof GermanAnalysisResultSchema>;

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
export const HIPAA_PROMPT_VERSION = '1.0.0';
export const GERMAN_PROMPT_VERSION = '1.0.0';
