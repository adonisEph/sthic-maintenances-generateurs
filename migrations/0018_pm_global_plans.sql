CREATE TABLE IF NOT EXISTS pm_global_plans (
  id TEXT PRIMARY KEY,
  month_id TEXT NOT NULL,
  month TEXT NOT NULL,
  zone TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  filename TEXT,
  row_count INTEGER NOT NULL DEFAULT 0,
  created_by_user_id TEXT,
  created_by_email TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pm_global_plans_month_zone ON pm_global_plans(month_id, zone);
CREATE INDEX IF NOT EXISTS idx_pm_global_plans_month ON pm_global_plans(month_id);

CREATE TABLE IF NOT EXISTS pm_global_plan_items (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  month_id TEXT NOT NULL,
  month TEXT NOT NULL,
  number TEXT,
  site_code TEXT,
  site_name TEXT,
  region TEXT,
  zone TEXT,
  short_description TEXT,
  maintenance_type TEXT,
  scheduled_wo_date TEXT,
  assigned_to TEXT,
  state TEXT,
  epv2 TEXT,
  epv3 TEXT,
  pair_site_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pm_global_plan_items_plan_id ON pm_global_plan_items(plan_id);
CREATE INDEX IF NOT EXISTS idx_pm_global_plan_items_month_zone ON pm_global_plan_items(month_id, zone);
CREATE INDEX IF NOT EXISTS idx_pm_global_plan_items_month_sched ON pm_global_plan_items(month_id, scheduled_wo_date);
