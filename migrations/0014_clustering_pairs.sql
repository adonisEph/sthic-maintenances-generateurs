CREATE TABLE IF NOT EXISTS clustering_pairs (
  id TEXT PRIMARY KEY,
  technician_user_id TEXT NOT NULL,
  site_id_1 TEXT NOT NULL,
  site_id_2 TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_clustering_pairs_tech ON clustering_pairs(technician_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clustering_pairs_unique ON clustering_pairs(technician_user_id, site_id_1, site_id_2);
