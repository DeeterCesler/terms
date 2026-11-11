-- Path-scoped policy sources. Some sites run a sub-product under its own terms
-- at a fixed path (chatgpt.com/business-hub is governed by OpenAI's Businesses
-- in ChatGPT Terms, not the consumer Terms of Use). A source with a non-null
-- path_prefix applies only to pages under that path on its linked sites:
--   * it is excluded from every domain-level read path (/check's main analysis
--     and `terms`, history, rankings, coverage), so it never shadows the
--     site's default documents;
--   * /check sends it to the extension as `pathTerms`, and the popup matches
--     the current tab's path locally, so browsing paths never leave the device.
-- NULL (every existing row) keeps today's domain-wide behavior.

ALTER TABLE policy_sources ADD COLUMN path_prefix TEXT;
ALTER TABLE policy_sources ADD CONSTRAINT policy_sources_path_prefix_check
  CHECK (path_prefix IS NULL OR (path_prefix ~ '^/[^?#]*$' AND path_prefix <> '/'));
