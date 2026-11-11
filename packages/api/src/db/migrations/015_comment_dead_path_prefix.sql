-- Mark policy_sources.path_prefix (013) as unused. Path scoping lives on
-- policy_source_sites.path_prefix (014); nothing reads this column. Kept until a
-- confirmed drop.

COMMENT ON COLUMN policy_sources.path_prefix IS
  'UNUSED since migration 014. Not read anywhere; set policy_source_sites.path_prefix instead. Pending a confirmed drop.';
