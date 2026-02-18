CREATE TABLE IF NOT EXISTS intelligent_plans (
  id TEXT PRIMARY KEY,
  month TEXT NOT NULL,
  zone TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  created_by_user_id TEXT,
  created_by_email TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_intelligent_plans_month_zone ON intelligent_plans(month, zone);
CREATE INDEX IF NOT EXISTS idx_intelligent_plans_month ON intelligent_plans(month);

CREATE TABLE IF NOT EXISTS intelligent_plan_items (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  month TEXT NOT NULL,
  zone TEXT NOT NULL,
  site_id TEXT NOT NULL,
  site_code TEXT,
  site_name TEXT,
  region TEXT,
  short_description TEXT,
  number TEXT,
  assigned_to TEXT,
  technician_user_id TEXT,
  scheduled_wo_date TEXT,
  date_of_closing TEXT,
  state TEXT,
  epv2 TEXT,
  epv3 TEXT,
  pair_site_code TEXT,
  pair_site_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_intelligent_plan_items_plan_id ON intelligent_plan_items(plan_id);
CREATE INDEX IF NOT EXISTS idx_intelligent_plan_items_month_zone ON intelligent_plan_items(month, zone);
CREATE INDEX IF NOT EXISTS idx_intelligent_plan_items_month_sched ON intelligent_plan_items(month, scheduled_wo_date);
CREATE INDEX IF NOT EXISTS idx_intelligent_plan_items_tech ON intelligent_plan_items(technician_user_id);
