CREATE TABLE IF NOT EXISTS pm_assignments (
  id TEXT PRIMARY KEY,
  month TEXT NOT NULL,
  pm_number TEXT NOT NULL,
  site_id TEXT NOT NULL,
  site_code TEXT,
  planned_date TEXT NOT NULL,
  maintenance_type TEXT,
  technician_user_id TEXT NOT NULL,
  technician_name TEXT NOT NULL,
  status TEXT NOT NULL,
  sent_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pm_assignments_number ON pm_assignments(pm_number);
CREATE INDEX IF NOT EXISTS idx_pm_assignments_tech_date ON pm_assignments(technician_user_id, planned_date);
CREATE INDEX IF NOT EXISTS idx_pm_assignments_site_date ON pm_assignments(site_id, planned_date);
