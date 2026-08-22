-- Add 'recruitment_notice' as a policy_type so job-applicant / recruitment
-- privacy notices (e.g. Paramount Skydance's Recruitment Privacy Notice) can be
-- ingested alongside consumer privacy policies. Like 'license', recruitment
-- notices are store-only: they are analyzed through a recruitment-specific lens
-- whose structured result lives in policy_analyses.raw_response, the privacy
-- columns (shares_with_third_parties, sells_data, ...) stay NULL, and they are
-- excluded from every public read path so they never shadow a site's real
-- consumer privacy notice in /check, the rankings, or coverage stats.

ALTER TABLE policy_sources DROP CONSTRAINT IF EXISTS policy_sources_policy_type_check;
ALTER TABLE policy_sources ADD CONSTRAINT policy_sources_policy_type_check
  CHECK (policy_type IN (
    'privacy_policy',
    'terms_of_service',
    'cookie_policy',
    'data_processing_agreement',
    'acceptable_use_policy',
    'license',
    'recruitment_notice',
    'other'
  ));

ALTER TABLE policy_candidates DROP CONSTRAINT IF EXISTS policy_candidates_policy_type_check;
ALTER TABLE policy_candidates ADD CONSTRAINT policy_candidates_policy_type_check
  CHECK (policy_type IN (
    'privacy_policy',
    'terms_of_service',
    'cookie_policy',
    'data_processing_agreement',
    'acceptable_use_policy',
    'license',
    'recruitment_notice',
    'other'
  ));
