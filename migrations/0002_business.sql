CREATE TABLE IF NOT EXISTS meta (
  meta_key TEXT PRIMARY KEY,
  meta_value TEXT NOT NULL
);

INSERT OR IGNORE INTO meta (meta_key, meta_value) VALUES ('ticket_number', '1179');


CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  name_site TEXT NOT NULL,
  id_site TEXT NOT NULL,
  technician TEXT NOT NULL,
  generateur TEXT NOT NULL,
  capacite TEXT NOT NULL,
  kit_vidange TEXT NOT NULL,
  nh1_dv INTEGER NOT NULL,
  date_dv TEXT NOT NULL,
  nh2_a INTEGER NOT NULL,
  date_a TEXT NOT NULL,
  regime INTEGER NOT NULL,
  nh_estimated INTEGER NOT NULL,
  diff_nhs INTEGER NOT NULL,
  diff_estimated INTEGER NOT NULL,
  seuil INTEGER NOT NULL,
  retired INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sites_id_site ON sites(id_site);
CREATE INDEX IF NOT EXISTS idx_sites_technician ON sites(technician);

CREATE TABLE IF NOT EXISTS fiche_history (
  id TEXT PRIMARY KEY,
  ticket_number TEXT,
  site_id TEXT NOT NULL,
  site_name TEXT NOT NULL,
  technician TEXT NOT NULL,
  date_generated TEXT NOT NULL,
  status TEXT NOT NULL,
  planned_date TEXT,
  epv_type TEXT,
  created_by TEXT,
  date_completed TEXT,
  interval_hours INTEGER,
  contract_seuil INTEGER,
  is_within_contract INTEGER,
  intervention_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fiche_history_site_id ON fiche_history(site_id);
CREATE INDEX IF NOT EXISTS idx_fiche_history_status ON fiche_history(status);
CREATE INDEX IF NOT EXISTS idx_fiche_history_planned_date ON fiche_history(planned_date);

CREATE TABLE IF NOT EXISTS interventions (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  planned_date TEXT NOT NULL,
  epv_type TEXT NOT NULL,
  technician_user_id TEXT,
  technician_name TEXT NOT NULL,
  status TEXT NOT NULL,
  sent_at TEXT,
  done_at TEXT,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_interventions_unique ON interventions(site_id, planned_date, epv_type);
CREATE INDEX IF NOT EXISTS idx_interventions_tech_date ON interventions(technician_user_id, planned_date);
CREATE INDEX IF NOT EXISTS idx_interventions_status_date ON interventions(status, planned_date);
