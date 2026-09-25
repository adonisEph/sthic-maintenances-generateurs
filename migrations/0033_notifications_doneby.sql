-- Traçabilité du clôturant + notifications in-app (option B)
-- done_by_* : qui a réellement clôturé l'intervention (manager/admin quand le
-- technicien est absent — sinon attribution silencieuse au technicien assigné).
ALTER TABLE interventions ADD COLUMN done_by_user_id TEXT;
ALTER TABLE interventions ADD COLUMN done_by_email TEXT;
ALTER TABLE interventions ADD COLUMN done_by_role TEXT;

-- Notifications adressées par audience/zone ; état de lecture par utilisateur
-- (watermark last_seen_at — pas de copie par utilisateur).
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  zone TEXT NOT NULL DEFAULT 'BZV/POOL',
  audience TEXT NOT NULL DEFAULT 'managers',
  title TEXT NOT NULL,
  body TEXT,
  site_id TEXT,
  ref_id TEXT,
  actor_user_id TEXT,
  actor_email TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_zone_created ON notifications(zone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

CREATE TABLE IF NOT EXISTS notification_state (
  user_id TEXT PRIMARY KEY,
  last_seen_at TEXT NOT NULL DEFAULT ''
);
