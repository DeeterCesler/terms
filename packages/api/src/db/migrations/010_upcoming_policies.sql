-- Upcoming policies: a site announces "our updated privacy policy takes effect
-- on Oct 1" and publishes the new text ahead of time. We store and analyze it
-- now so the popup can say what changes and when.
--
-- effective_at: NULL = in force (every policy predating this column). A future
-- timestamp = announced but not yet in force. Public read paths ignore policies
-- whose effective_at is still in the future, so an upcoming analysis never
-- shadows the current one; once the date passes it wins on analyzed_at like any
-- newer analysis, with no job needed to flip it over.
--
-- Upcoming rows are inserted with is_current = FALSE so the one-current-per-
-- source unique index is untouched until the date arrives.
--
-- url: where the upcoming text lives when it differs from policy_sources.url
-- (e.g. /legal/privacy-2026). NULL = the source URL.
ALTER TABLE policies
  ADD COLUMN IF NOT EXISTS effective_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS url TEXT;

COMMENT ON COLUMN policies.effective_at IS
  'When this version takes effect. NULL = already in force. Future = announced upcoming policy, hidden from public read paths until then.';
COMMENT ON COLUMN policies.url IS
  'URL of this specific version when it differs from policy_sources.url (typically an upcoming policy page). NULL = the source URL.';

-- Partial index: upcoming policies are a tiny slice of the table and the only
-- lookup is "does this source have one pending".
CREATE INDEX IF NOT EXISTS idx_policies_effective_at
  ON policies (policy_source_id, effective_at)
  WHERE effective_at IS NOT NULL;
