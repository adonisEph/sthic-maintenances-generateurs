CREATE TABLE IF NOT EXISTS holidays (
  id TEXT PRIMARY KEY,
  date_ymd TEXT NOT NULL,
  label TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date_ymd);
