-- Move path scoping from the source to the site link (supersedes 013's column).
-- One document can apply site-wide on one domain and only under a path on
-- another: the Businesses in ChatGPT Terms live on openai.com but govern
-- chatgpt.com/business-hub. A link with a non-null path_prefix applies only to
-- pages under that path on that site; every domain-level read path filters on
-- policy_source_sites.path_prefix IS NULL. policy_sources.path_prefix is copied
-- here and no longer read; dropping it is a separate, confirmed step.

ALTER TABLE policy_source_sites ADD COLUMN path_prefix TEXT;
ALTER TABLE policy_source_sites ADD CONSTRAINT policy_source_sites_path_prefix_check
  CHECK (path_prefix IS NULL OR (path_prefix ~ '^/[^?#]*$' AND path_prefix <> '/'));

UPDATE policy_source_sites pss
SET path_prefix = ps.path_prefix
FROM policy_sources ps
WHERE ps.id = pss.policy_source_id AND ps.path_prefix IS NOT NULL;
