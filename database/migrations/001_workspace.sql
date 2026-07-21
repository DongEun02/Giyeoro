CREATE TABLE IF NOT EXISTS users (
  github_id BIGINT PRIMARY KEY,
  github_login TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT NOT NULL DEFAULT '',
  profile_url TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspace_items (
  user_id BIGINT NOT NULL REFERENCES users(github_id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('issue', 'translation')),
  status TEXT NOT NULL CHECK (status IN ('interested', 'in_progress', 'completed')),
  repo TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  difficulty TEXT NOT NULL DEFAULT '',
  work_type TEXT NOT NULL DEFAULT '',
  language_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  url TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  saved_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, item_id)
);

CREATE INDEX IF NOT EXISTS workspace_items_user_status_updated_idx
  ON workspace_items (user_id, status, updated_at DESC);
