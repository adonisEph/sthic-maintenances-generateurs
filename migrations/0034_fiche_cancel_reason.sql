-- Motif d'annulation des fiches (nettoyage orphelines, annulation manuelle)
ALTER TABLE fiche_history ADD COLUMN cancel_reason TEXT;
