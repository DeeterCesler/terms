-- Backlog of sites/products to eventually analyze.
-- Compare against policy_sources + policy_analyses to find what's not covered yet.

CREATE TABLE policy_candidates (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  domain       TEXT        NOT NULL,
  name         TEXT,
  product      TEXT,
  policy_type  TEXT        NOT NULL DEFAULT 'privacy_policy'
                           CHECK (policy_type IN (
                             'privacy_policy',
                             'terms_of_service',
                             'cookie_policy',
                             'data_processing_agreement',
                             'acceptable_use_policy',
                             'other'
                           )),
  url          TEXT,
  priority     SMALLINT    NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  notes        TEXT,
  added_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent duplicate entries for the same domain + type + product combo
CREATE UNIQUE INDEX idx_candidates_unique
  ON policy_candidates (domain, policy_type, COALESCE(product, ''));

CREATE INDEX idx_candidates_priority ON policy_candidates (priority, added_at);
