-- Add 'hipaa_notice' as a policy_type so HIPAA Notices of Privacy Practices
-- (e.g. UnitedHealthcare's Health Information Notice of Privacy Practices) can
-- be ingested alongside consumer privacy policies. Like 'license' and
-- 'recruitment_notice', HIPAA notices are store-only: they are analyzed through
-- a HIPAA-specific lens whose structured result lives in
-- policy_analyses.raw_response, the privacy columns (shares_with_third_parties,
-- sells_data, ...) stay NULL, and they are excluded from every public read path.
--
-- A HIPAA NPP governs PHI held by a health plan or provider, not the data a
-- website collects from visitors. Scoring it on the consumer privacy scale and
-- surfacing it in /check would tell someone browsing uhc.com that the plan
-- member notice is the site's privacy policy, which it is not.

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
    'hipaa_notice',
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
    'hipaa_notice',
    'other'
  ));
