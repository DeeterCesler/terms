-- Flag for sites that publish no meaningful privacy policy: either nothing at
-- all, or a generated boilerplate template that grants no statutory rights, sets
-- no retention period, and offers no access/deletion route (the free
-- "privacy policy generator" text, typically reciting CalOPPA/COPPA/CAN-SPAM
-- rather than committing to anything). Jungle Jim's is the first of these.
--
-- Deliberately NOT a policy_type: those categorize the document, and store-only
-- types are hidden from every public read path. This is the opposite - the whole
-- point is that visitors SEE it, with a bad score, in /check and the rankings.
-- It rides alongside the normal privacy columns, which stay populated (a
-- template policy still says something about cookies, sharing, and ad tech).
--
-- Nullable with no default: NULL means "not assessed" for the ~1,600 analyses
-- that predate this column, which is distinct from an explicit FALSE.
ALTER TABLE policy_analyses
  ADD COLUMN IF NOT EXISTS no_meaningful_policy BOOLEAN;

COMMENT ON COLUMN policy_analyses.no_meaningful_policy IS
  'TRUE when the site publishes no real privacy policy (absent, or a boilerplate template with no statutory rights/retention/deletion). NULL = not assessed.';

-- Partial index: the flagged set is tiny relative to the table, and the only
-- queries that care are "show me the flagged ones".
CREATE INDEX IF NOT EXISTS idx_analyses_no_meaningful_policy
  ON policy_analyses (site_id)
  WHERE no_meaningful_policy = TRUE;
