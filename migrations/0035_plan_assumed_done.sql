-- Trace des vidanges du mois courant déclarées lors de la génération
-- intelligente (baseline simulée utilisée pour positionner le site dans le
-- mois cible à sa vraie date projetée plutôt qu'en slot "urgent").
ALTER TABLE intelligent_plan_items ADD COLUMN assumed_done_at TEXT;
