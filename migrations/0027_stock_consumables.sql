CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  item_type TEXT NOT NULL,
  movement_type TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  zone TEXT NOT NULL DEFAULT 'BZV/POOL',
  site_id TEXT,
  site_name TEXT,
  fiche_id TEXT,
  technician_name TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_item_type ON stock_movements(item_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_zone ON stock_movements(zone);
CREATE INDEX IF NOT EXISTS idx_stock_movements_site_id ON stock_movements(site_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at);
