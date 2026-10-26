ALTER TABLE users
  ADD COLUMN IF NOT EXISTS pull_requests_history_cursor TEXT,
  ADD COLUMN IF NOT EXISTS pull_requests_history_complete BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pull_requests_recent_synced_at TIMESTAMPTZ;

UPDATE users
SET pull_requests_recent_synced_at = pull_requests_synced_at
WHERE pull_requests_recent_synced_at IS NULL;
