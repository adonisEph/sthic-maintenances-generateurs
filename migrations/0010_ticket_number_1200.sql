UPDATE meta
SET meta_value = '1200'
WHERE meta_key = 'ticket_number'
  AND CAST(meta_value AS INTEGER) < 1200;
