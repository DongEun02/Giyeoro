CREATE TABLE IF NOT EXISTS repository_catalog (
  full_name TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'deepwiki',
  source_rank INTEGER,
  deepwiki_url TEXT NOT NULL,
  github_url TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  primary_language TEXT,
  topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  stars INTEGER NOT NULL DEFAULT 0,
  license_spdx TEXT,
  has_issues BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  pushed_at TIMESTAMPTZ,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  source_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS repository_catalog_language_rank_idx
  ON repository_catalog (LOWER(primary_language), source_rank)
  WHERE is_enabled = TRUE AND has_issues = TRUE AND is_archived = FALSE;

CREATE INDEX IF NOT EXISTS repository_catalog_source_seen_idx
  ON repository_catalog (source, source_seen_at DESC);
