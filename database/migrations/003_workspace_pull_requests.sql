ALTER TABLE workspace_items
  DROP CONSTRAINT IF EXISTS workspace_items_kind_check;

ALTER TABLE workspace_items
  ADD CONSTRAINT workspace_items_kind_check
  CHECK (kind IN ('issue', 'translation', 'pull_request'));
