CREATE TABLE IF NOT EXISTS public_portfolio_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  owner_id BIGINT NOT NULL REFERENCES users(github_id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS public_portfolio_snapshots_owner_created_idx
  ON public_portfolio_snapshots (owner_id, created_at DESC);
