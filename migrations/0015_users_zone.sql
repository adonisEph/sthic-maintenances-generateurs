ALTER TABLE users ADD COLUMN zone TEXT NOT NULL DEFAULT 'BZV/POOL';

UPDATE users SET zone = 'BZV/POOL' WHERE zone IS NULL OR TRIM(zone) = '';

CREATE INDEX IF NOT EXISTS idx_users_zone ON users(zone);
