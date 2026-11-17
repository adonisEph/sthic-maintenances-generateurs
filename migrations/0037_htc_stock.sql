-- Magasin & Stocks HTC — catalogue, demandes, bons BS/BE/BR
CREATE TABLE IF NOT EXISTS htc_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  location TEXT NOT NULL DEFAULT 'entrepot',
  unit TEXT NOT NULL DEFAULT 'pièce',
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_htc_items_location ON htc_items(location);
CREATE INDEX IF NOT EXISTS idx_htc_items_active ON htc_items(active);

CREATE TABLE IF NOT EXISTS htc_requests (
  id TEXT PRIMARY KEY,
  request_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_by_user_id TEXT,
  requester_name TEXT NOT NULL,
  requester_role TEXT NOT NULL DEFAULT 'technician',
  site_id TEXT,
  site_name TEXT,
  reason TEXT,
  notes TEXT,
  zone TEXT NOT NULL DEFAULT 'BZV/POOL',
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  processed_by TEXT,
  processed_at TEXT,
  reject_reason TEXT,
  exit_movement_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_htc_requests_status ON htc_requests(status);
CREATE INDEX IF NOT EXISTS idx_htc_requests_user ON htc_requests(requested_by_user_id);
CREATE INDEX IF NOT EXISTS idx_htc_requests_created ON htc_requests(created_at);

CREATE TABLE IF NOT EXISTS htc_request_lines (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_name TEXT,
  location TEXT,
  qty INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_htc_request_lines_req ON htc_request_lines(request_id);
CREATE INDEX IF NOT EXISTS idx_htc_request_lines_item ON htc_request_lines(item_id);

CREATE TABLE IF NOT EXISTS htc_movements (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT 'entrepot',
  movement_date TEXT NOT NULL,
  site_id TEXT,
  site_name TEXT,
  reason TEXT,
  requester_name TEXT,
  requester_role TEXT,
  requested_by_user_id TEXT,
  request_id TEXT,
  return_of_movement_id TEXT,
  signature_name TEXT,
  signature_image TEXT,
  status TEXT NOT NULL DEFAULT 'issued',
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_htc_movements_type ON htc_movements(type);
CREATE INDEX IF NOT EXISTS idx_htc_movements_location ON htc_movements(location);
CREATE INDEX IF NOT EXISTS idx_htc_movements_date ON htc_movements(movement_date);
CREATE INDEX IF NOT EXISTS idx_htc_movements_return_of ON htc_movements(return_of_movement_id);
CREATE INDEX IF NOT EXISTS idx_htc_movements_request ON htc_movements(request_id);

CREATE TABLE IF NOT EXISTS htc_movement_lines (
  id TEXT PRIMARY KEY,
  movement_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_name TEXT,
  location TEXT,
  qty INTEGER NOT NULL DEFAULT 1,
  qty_returned INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_htc_movement_lines_mov ON htc_movement_lines(movement_id);
CREATE INDEX IF NOT EXISTS idx_htc_movement_lines_item ON htc_movement_lines(item_id);
