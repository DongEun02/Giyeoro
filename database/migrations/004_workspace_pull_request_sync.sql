ALTER TABLE users
  ADD COLUMN IF NOT EXISTS pull_requests_synced_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS workspace_ignored_items (
  user_id BIGINT NOT NULL REFERENCES users(github_id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind = 'pull_request'),
  repo TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT,
  ignored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, item_id)
);

CREATE INDEX IF NOT EXISTS workspace_ignored_items_user_ignored_idx
  ON workspace_ignored_items (user_id, ignored_at DESC);
