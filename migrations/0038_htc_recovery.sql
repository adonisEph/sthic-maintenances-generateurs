-- Magasin & Stocks HTC — « retour terrain » : condition par ligne de mouvement
-- fonctionnel (entre en stock disponible) | defectueux | a_reparer | hs (stock « Retour Site » documenté)
ALTER TABLE htc_movement_lines ADD COLUMN item_condition TEXT NOT NULL DEFAULT 'fonctionnel';
CREATE INDEX IF NOT EXISTS idx_htc_movement_lines_cond ON htc_movement_lines(item_condition);
