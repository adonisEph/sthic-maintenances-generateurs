ALTER TABLE fiche_history ADD COLUMN sent_to_warehouse_by TEXT;
ALTER TABLE fiche_history ADD COLUMN sent_to_warehouse_at TEXT;
ALTER TABLE fiche_history ADD COLUMN warehouse_flow_status TEXT;
ALTER TABLE fiche_history ADD COLUMN warehouse_finalized_by TEXT;
ALTER TABLE fiche_history ADD COLUMN warehouse_finalized_at TEXT;

CREATE INDEX IF NOT EXISTS idx_fiche_history_warehouse_flow_status ON fiche_history(warehouse_flow_status);
CREATE INDEX IF NOT EXISTS idx_fiche_history_sent_to_warehouse_at ON fiche_history(sent_to_warehouse_at);
CREATE INDEX IF NOT EXISTS idx_fiche_history_warehouse_finalized_at ON fiche_history(warehouse_finalized_at);
