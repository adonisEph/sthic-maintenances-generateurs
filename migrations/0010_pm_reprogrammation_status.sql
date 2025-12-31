ALTER TABLE pm_items ADD COLUMN reprogrammation_status TEXT;

CREATE INDEX IF NOT EXISTS idx_pm_items_month_reprog_status ON pm_items(month_id, reprogrammation_status);
