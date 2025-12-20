CREATE TABLE IF NOT EXISTS presence_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tab_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  technician_name TEXT,
  activity TEXT,
  last_seen_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_presence_last_seen ON presence_sessions(last_seen_ms);
CREATE INDEX IF NOT EXISTS idx_presence_user_id ON presence_sessions(user_id);
