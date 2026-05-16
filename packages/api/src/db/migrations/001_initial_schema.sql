CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- sites: one row per registered domain
CREATE TABLE sites (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  domain        TEXT          NOT NULL UNIQUE,
  policy_url    TEXT          NOT NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sites_domain ON sites (domain);

-- policies: versioned raw text snapshots
CREATE TABLE policies (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       UUID          NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  fetched_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  content_hash  TEXT          NOT NULL,
  raw_text      TEXT          NOT NULL,
  char_count    INTEGER       NOT NULL,
  http_status   INTEGER,
  is_current    BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_policies_current ON policies (site_id) WHERE is_current = TRUE;
CREATE INDEX idx_policies_site_id ON policies (site_id);
CREATE INDEX idx_policies_fetched_at ON policies (fetched_at DESC);

-- policy_analyses: Claude's structured output per policy version
CREATE TABLE policy_analyses (
  id                        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id                 UUID          NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  site_id                   UUID          NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  analyzed_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  model_used                TEXT          NOT NULL,
  prompt_version            TEXT          NOT NULL,
  shares_with_third_parties BOOLEAN,
  shares_evidence           TEXT,
  sells_data                BOOLEAN,
  sells_evidence            TEXT,
  data_anonymized           BOOLEAN,
  anonymized_evidence       TEXT,
  data_retention            TEXT,
  user_rights               JSONB,
  overall_score             SMALLINT      CHECK (overall_score BETWEEN 1 AND 10),
  summary                   TEXT,
  raw_response              JSONB         NOT NULL,
  status                    TEXT          NOT NULL DEFAULT 'pending'
                                          CHECK (status IN ('pending','processing','done','failed')),
  error_message             TEXT,
  created_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_analyses_site_id ON policy_analyses (site_id);
CREATE INDEX idx_analyses_policy_id ON policy_analyses (policy_id);
CREATE INDEX idx_analyses_status ON policy_analyses (status);

-- processing_queue: admin-triggered work items
CREATE TABLE processing_queue (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       UUID          NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  action        TEXT          NOT NULL CHECK (action IN ('crawl_and_analyze','reanalyze')),
  status        TEXT          NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','processing','done','failed')),
  triggered_by  TEXT,
  error_message TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ
);

CREATE INDEX idx_queue_status ON processing_queue (status, created_at);
CREATE INDEX idx_queue_site_id ON processing_queue (site_id);
