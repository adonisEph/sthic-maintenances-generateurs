CREATE TABLE IF NOT EXISTS pm_base_plans (
  id TEXT PRIMARY KEY,
  month TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by_user_id TEXT,
  created_by_email TEXT,
  generated_at TEXT,
  locked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pm_base_plans_month ON pm_base_plans(month);
CREATE INDEX IF NOT EXISTS idx_pm_base_plans_status ON pm_base_plans(status);

CREATE TABLE IF NOT EXISTS pm_base_plan_items (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  site_id TEXT,
  site_code TEXT,
  site_name TEXT,
  region TEXT,
  zone TEXT,
  assigned_to TEXT,
  pair_group TEXT,
  epv_slot TEXT,
  short_description TEXT,
  recommended_maintenance_type TEXT,
  planned_date TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'Planned',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pm_base_plan_items_plan_id ON pm_base_plan_items(plan_id);
CREATE INDEX IF NOT EXISTS idx_pm_base_plan_items_plan_date ON pm_base_plan_items(plan_id, planned_date);
CREATE INDEX IF NOT EXISTS idx_pm_base_plan_items_assigned_to ON pm_base_plan_items(plan_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_pm_base_plan_items_pair_group ON pm_base_plan_items(plan_id, pair_group);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pm_base_plan_items_unique ON pm_base_plan_items(plan_id, COALESCE(site_id, ''), COALESCE(site_code, ''), planned_date, COALESCE(epv_slot, ''), COALESCE(recommended_maintenance_type, ''));
