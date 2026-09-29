-- ============================================================
-- Migration 0036 — Index de performance (quota D1 "rows read")
-- ------------------------------------------------------------
-- fiche_history(intervention_id) : utilisé par la liste des
-- interventions (lookup de la fiche liée) et les JOIN/EXISTS
-- fh.intervention_id — avant : scan complet de fiche_history
-- (~200k lignes) à chaque appel.
-- fiche_history(date_generated) : la liste /api/fiche-history
-- trie par date_generated DESC LIMIT 500 — l'index permet de
-- lire dans l'ordre et de s'arrêter à 500 lignes.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_fiche_history_intervention
  ON fiche_history(intervention_id, id);

CREATE INDEX IF NOT EXISTS idx_fiche_history_date_generated
  ON fiche_history(date_generated);
