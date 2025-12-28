CREATE TABLE IF NOT EXISTS nh_readings (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  reading_date TEXT NOT NULL,
  nh_value INTEGER NOT NULL,
  prev_nh2_a INTEGER,
  prev_date_a TEXT,
  prev_nh1_dv INTEGER,
  prev_date_dv TEXT,
  prev_nh_offset INTEGER,
  new_nh_offset INTEGER,
  is_reset INTEGER NOT NULL DEFAULT 0,
  created_by_user_id TEXT,
  created_by_email TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_nh_readings_site_date ON nh_readings(site_id, reading_date);

ALTER TABLE sites ADD COLUMN nh_offset INTEGER NOT NULL DEFAULT 0;
