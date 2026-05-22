-- Many-to-many between policy_sources and sites, so a single corporate policy
-- (e.g. The Walt Disney Company privacy statement covering disney.com,
-- disneyplus.com, espn.com, etc.) can attach to every brand site that shares
-- it. policy_sources.site_id stays as the "primary" attribution to keep the
-- existing single-site queries cheap; the junction is authoritative for
-- "which sites does this source apply to".

CREATE TABLE policy_source_sites (
  policy_source_id UUID NOT NULL REFERENCES policy_sources(id) ON DELETE CASCADE,
  site_id          UUID NOT NULL REFERENCES sites(id)          ON DELETE CASCADE,
  is_primary       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (policy_source_id, site_id)
);

CREATE INDEX idx_policy_source_sites_site_id ON policy_source_sites (site_id);
CREATE INDEX idx_policy_source_sites_source_id ON policy_source_sites (policy_source_id);

-- Backfill from the existing 1:1 site_id pointer.
INSERT INTO policy_source_sites (policy_source_id, site_id, is_primary)
SELECT id, site_id, TRUE
FROM policy_sources
ON CONFLICT DO NOTHING;
