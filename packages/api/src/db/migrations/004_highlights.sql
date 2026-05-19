-- Highlights: optional array of {kind: 'good'|'bad', text: string} surfaced
-- in the extension and on the rankings page. Independent of overall_score.

ALTER TABLE policy_analyses
  ADD COLUMN highlights JSONB;
