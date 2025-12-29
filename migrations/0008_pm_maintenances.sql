CREATE TABLE IF NOT EXISTS pm_months (
  id TEXT PRIMARY KEY,
  month TEXT NOT NULL,
  title TEXT,
  created_by_user_id TEXT,
  created_by_email TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pm_months_month ON pm_months(month);

CREATE TABLE IF NOT EXISTS pm_items (
  id TEXT PRIMARY KEY,
  month_id TEXT NOT NULL,
  number TEXT NOT NULL,
  site_code TEXT,
  site_name TEXT,
  region TEXT,
  zone TEXT,
  short_description TEXT,
  maintenance_type TEXT,
  scheduled_wo_date TEXT,
  assigned_to TEXT,
  state TEXT NOT NULL,
  closed_at TEXT,
  last_noc_import_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pm_items_month_number ON pm_items(month_id, number);
CREATE INDEX IF NOT EXISTS idx_pm_items_month_state ON pm_items(month_id, state);
CREATE INDEX IF NOT EXISTS idx_pm_items_month_sched ON pm_items(month_id, scheduled_wo_date);

CREATE TABLE IF NOT EXISTS pm_imports (
  id TEXT PRIMARY KEY,
  month_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  filename TEXT,
  row_count INTEGER NOT NULL DEFAULT 0,
  created_by_user_id TEXT,
  created_by_email TEXT
);

CREATE INDEX IF NOT EXISTS idx_pm_imports_month_kind ON pm_imports(month_id, kind);
CREATE INDEX IF NOT EXISTS idx_pm_imports_month_time ON pm_imports(month_id, imported_at);

CREATE TABLE IF NOT EXISTS pm_noc_rows (
  id TEXT PRIMARY KEY,
  import_id TEXT NOT NULL,
  month_id TEXT NOT NULL,
  number TEXT NOT NULL,
  state TEXT,
  closed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_pm_noc_rows_import_id ON pm_noc_rows(import_id);
CREATE INDEX IF NOT EXISTS idx_pm_noc_rows_month_number ON pm_noc_rows(month_id, number);
