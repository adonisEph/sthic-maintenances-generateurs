ALTER TABLE pm_items ADD COLUMN created_source TEXT;

CREATE INDEX IF NOT EXISTS idx_pm_items_month_created_source ON pm_items(month_id, created_source);
