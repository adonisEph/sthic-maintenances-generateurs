-- Métadonnées administratives des bons HTC (BE / BS / BR / RC)
-- BE : expéditeur (client HTC ou fournisseur), N°SMR, bénéficiaire
-- BS : N°SWO (ordre de travail du demandeur)
-- BR : agent qui retourne + provenance

ALTER TABLE htc_movements ADD COLUMN sender_type TEXT NOT NULL DEFAULT '';
ALTER TABLE htc_movements ADD COLUMN smr_number TEXT NOT NULL DEFAULT '';
ALTER TABLE htc_movements ADD COLUMN swo_number TEXT NOT NULL DEFAULT '';
ALTER TABLE htc_movements ADD COLUMN beneficiary TEXT NOT NULL DEFAULT '';
ALTER TABLE htc_movements ADD COLUMN agent_name TEXT NOT NULL DEFAULT '';
ALTER TABLE htc_movements ADD COLUMN provenance TEXT NOT NULL DEFAULT '';

ALTER TABLE htc_requests ADD COLUMN swo_number TEXT NOT NULL DEFAULT '';
