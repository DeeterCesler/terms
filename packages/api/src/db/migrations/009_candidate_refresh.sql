-- Re-request support: lets a user ask us to re-check a site we already have.
--
-- addCandidate upserts on (domain, policy_type, COALESCE(product,'')), and its
-- DO UPDATE only touched name/url/priority/notes, so a re-request on an
-- already-analyzed domain was indistinguishable from the original request:
-- added_at stayed at the first one and every batch query filters on "no done
-- analysis for this domain", making the row invisible forever.
--
-- refresh_requested_at is the counterpart to that "uncovered" predicate: a
-- covered domain becomes visible to the refresh queue when this is non-NULL,
-- and is cleared once the re-check runs (changed or not).
ALTER TABLE policy_candidates
  ADD COLUMN IF NOT EXISTS refresh_requested_at TIMESTAMPTZ;

COMMENT ON COLUMN policy_candidates.refresh_requested_at IS
  'Set when a user asks us to re-check a site we have already analyzed. NULL = no pending refresh. Cleared by the refresh runner after the source is re-fetched, whether or not the content changed.';

-- Partial index: pending refreshes are a tiny slice of the candidate table and
-- the only query that cares is "which ones are waiting".
CREATE INDEX IF NOT EXISTS idx_candidates_refresh_requested
  ON policy_candidates (refresh_requested_at)
  WHERE refresh_requested_at IS NOT NULL;
