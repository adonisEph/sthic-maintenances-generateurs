ALTER TABLE pm_items ADD COLUMN reprogrammation_date TEXT;
ALTER TABLE pm_items ADD COLUMN reprogrammation_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_pm_items_month_reprog_date ON pm_items(month_id, reprogrammation_date);
