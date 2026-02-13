ALTER TABLE fiche_history ADD COLUMN signature_typed_name TEXT;
ALTER TABLE fiche_history ADD COLUMN signature_drawn_png TEXT;
ALTER TABLE fiche_history ADD COLUMN signed_by_email TEXT;
ALTER TABLE fiche_history ADD COLUMN signed_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_fiche_history_ticket_number_unique ON fiche_history(ticket_number);