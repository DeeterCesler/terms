-- Add 'license' as a policy_type so software license agreements / EULAs
-- (e.g. Apple's Xcode and Apple SDKs Agreement) can be ingested alongside
-- privacy policies. License-specific findings live in policy_analyses.raw_response;
-- the privacy columns (shares_with_third_parties, sells_data, ...) stay NULL.

ALTER TABLE policy_sources DROP CONSTRAINT IF EXISTS policy_sources_policy_type_check;
ALTER TABLE policy_sources ADD CONSTRAINT policy_sources_policy_type_check
  CHECK (policy_type IN (
    'privacy_policy',
    'terms_of_service',
    'cookie_policy',
    'data_processing_agreement',
    'acceptable_use_policy',
    'license',
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
    'other'
  ));
