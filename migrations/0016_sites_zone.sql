ALTER TABLE sites ADD COLUMN zone TEXT NOT NULL DEFAULT 'BZV/POOL';

UPDATE sites SET zone = 'BZV/POOL' WHERE zone IS NULL OR TRIM(zone) = '';

CREATE INDEX IF NOT EXISTS idx_sites_zone ON sites(zone);
CREATE INDEX IF NOT EXISTS idx_sites_zone_id_site ON sites(zone, id_site);
