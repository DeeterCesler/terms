-- The date a document states about itself ("Last updated: March 3, 2025",
-- "Effective date: ...", "最終改定日 2024年4月1日"). normalizePolicyText strips
-- these lines before raw_text is stored, so hashing ignores date-only bumps;
-- this captures the line from the pre-normalization text instead.
--
-- Distinct from effective_at, which marks an announced upcoming version and
-- drives public read paths. stated_date is informational only.
--
-- stated_date_checked separates "never looked" (every row predating this
-- column, FALSE) from "looked and the document states no date" (TRUE with
-- stated_date_text NULL).
ALTER TABLE policies
  ADD COLUMN IF NOT EXISTS stated_date_text TEXT,
  ADD COLUMN IF NOT EXISTS stated_date DATE,
  ADD COLUMN IF NOT EXISTS stated_date_checked BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN policies.stated_date_text IS
  'The date line as written in the document, e.g. "Last updated: March 3, 2025". NULL = none found (or not checked; see stated_date_checked).';
COMMENT ON COLUMN policies.stated_date IS
  'stated_date_text parsed to a date when unambiguous (month-only dates use the 1st). NULL when absent or unparseable.';
COMMENT ON COLUMN policies.stated_date_checked IS
  'TRUE once the pre-normalization text was scanned for a stated date. FALSE = predates capture.';
