-- Ajoute technician_user_id sur fiche_history pour un matching technicien robuste
-- (le champ texte `technician` varie en casse/accents selon la saisie du site).

ALTER TABLE fiche_history ADD COLUMN technician_user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_fiche_history_tech_user ON fiche_history(technician_user_id);
