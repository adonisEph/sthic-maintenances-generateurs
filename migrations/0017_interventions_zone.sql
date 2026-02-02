ALTER TABLE interventions ADD zone TEXT NOT NULL DEFAULT 'BZV/POOL';

UPDATE interventions
SET zone = COALESCE((SELECT s.zone FROM sites s WHERE s.id = interventions.site_id), 'BZV/POOL')
WHERE zone IS NULL OR TRIM(zone) = '';

CREATE INDEX IF NOT EXISTS idx_interventions_zone_date ON interventions(zone, planned_date);
