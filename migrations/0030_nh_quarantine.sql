
CREATE TABLE IF NOT EXISTS nh_quarantine (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  zone TEXT,
  source TEXT NOT NULL,
  reason TEXT,
  proposed_nh2_a INTEGER,
  proposed_date_a TEXT,
  prev_nh1_dv INTEGER,
  prev_date_dv TEXT,
  prev_nh2_a INTEGER,
  prev_date_a TEXT,
  prev_nh_offset INTEGER,
  detail TEXT,                       
  status TEXT NOT NULL DEFAULT 'pending',
  treatment TEXT,                     
  treated_by_user_id TEXT,
  treated_by_email TEXT,
  treated_at TEXT,
  treatment_payload TEXT,             
  created_by_user_id TEXT,
  created_by_email TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_nh_quarantine_status ON nh_quarantine(status, site_id);
CREATE INDEX IF NOT EXISTS idx_nh_quarantine_site ON nh_quarantine(site_id, status);
CREATE INDEX IF NOT EXISTS idx_nh_quarantine_zone ON nh_quarantine(zone, status);


ALTER TABLE nh_readings ADD COLUMN source TEXT;
ALTER TABLE nh_readings ADD COLUMN quarantine_id TEXT;

CREATE INDEX IF NOT EXISTS idx_nh_readings_site_created ON nh_readings(site_id, created_at);
