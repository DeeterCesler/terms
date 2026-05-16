-- Introduce policy_sources to support multiple policies per domain
-- (e.g. Google Maps privacy policy vs. Google Search ToS)
-- content_hash already lives on policies for change detection

ALTER TABLE sites ADD COLUMN name TEXT;

CREATE TABLE policy_sources (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id      UUID        NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  url          TEXT        NOT NULL UNIQUE,
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
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_policy_sources_site_id ON policy_sources (site_id);

-- Migrate existing policy_url values into policy_sources
INSERT INTO policy_sources (site_id, url, policy_type)
SELECT id, policy_url, 'privacy_policy'
FROM sites
WHERE policy_url IS NOT NULL;

-- Wire policies to policy_sources instead of sites directly
DROP INDEX IF EXISTS idx_policies_current;
DROP INDEX IF EXISTS idx_policies_site_id;

ALTER TABLE policies ADD COLUMN policy_source_id UUID REFERENCES policy_sources(id) ON DELETE CASCADE;

UPDATE policies p
SET policy_source_id = ps.id
FROM policy_sources ps
WHERE ps.site_id = p.site_id;

ALTER TABLE policies ALTER COLUMN policy_source_id SET NOT NULL;
ALTER TABLE policies DROP COLUMN site_id;

CREATE UNIQUE INDEX idx_policies_current ON policies (policy_source_id) WHERE is_current = TRUE;
CREATE INDEX idx_policies_policy_source_id ON policies (policy_source_id);

-- Add policy_source_id to analyses; keep site_id as denorm for cheap lookups
ALTER TABLE policy_analyses ADD COLUMN policy_source_id UUID REFERENCES policy_sources(id) ON DELETE CASCADE;

UPDATE policy_analyses pa
SET policy_source_id = ps.id
FROM policy_sources ps
WHERE ps.site_id = pa.site_id;

ALTER TABLE policy_analyses ALTER COLUMN policy_source_id SET NOT NULL;

CREATE INDEX idx_analyses_policy_source_id ON policy_analyses (policy_source_id);

-- Optional: scope a queue job to a single policy source (null = all sources for the site)
ALTER TABLE processing_queue ADD COLUMN policy_source_id UUID REFERENCES policy_sources(id) ON DELETE CASCADE;

-- policy_url moves to policy_sources; drop from sites
ALTER TABLE sites DROP COLUMN policy_url;
