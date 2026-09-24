-- La colonne reason manquait au CREATE TABLE de 0030 alors que le code
-- (recordQuarantine / GET) l'utilise : chaque INSERT échouait en silence
-- et la quarantaine restait vide malgré les récaps d'import.
ALTER TABLE nh_quarantine ADD COLUMN reason TEXT;
