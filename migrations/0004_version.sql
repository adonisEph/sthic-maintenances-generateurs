-- Add a meta key to support version-based sync

INSERT OR IGNORE INTO meta (meta_key, meta_value) VALUES ('last_updated_at', '1970-01-01T00:00:00.000Z');
