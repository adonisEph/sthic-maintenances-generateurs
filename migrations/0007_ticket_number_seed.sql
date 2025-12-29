INSERT OR IGNORE INTO meta (meta_key, meta_value) VALUES ('ticket_number', '1179');

UPDATE meta
SET meta_value = '1179'
WHERE meta_key = 'ticket_number'
  AND CAST(meta_value AS INTEGER) < 1179;
