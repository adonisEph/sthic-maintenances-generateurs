CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  user_id TEXT,
  email TEXT,
  role TEXT,
  action TEXT NOT NULL,
  method TEXT,
  path TEXT,
  query TEXT,
  status INTEGER,
  ip TEXT,
  user_agent TEXT,
  metadata_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_created_at_ms ON audit_logs(created_at_ms);
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
