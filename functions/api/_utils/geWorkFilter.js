// Filtre de pertinence GE — les fiches Historique GE ne doivent recevoir que
// les travaux relatifs au générateur (liste du cahier des charges + termes
// du domaine GE). Les lignes NOC hors périmètre (télécom, tenants, IT…) sont
// écartées à l'ingestion.

// Tokens courts : frontière de mot requise (évite 'SPI' dans 'hospital'…).
const GE_WORD_TOKENS = /\b(GE|SPI|DSE|AVR|KVA)\b/;

// Sous-chaînes longues : présence suffisante.
const GE_SUBSTRINGS = [
  // Liste cahier des charges
  'VIDANGE',
  'COURROIE', 'VENTILATION', 'VENTIL',
  'ALTERNATEUR', 'GENERATRICE',
  'DEMARREUR', 'DEMARRE', 'STARTER',
  'FILTRE', 'FILTRATION',
  'BATTERIE', 'BATTER',
  'FUITE', 'HUILE',
  'CHARGEUR',
  'JOINT',
  'CARTER',
  'CULASSE',
  // Cycle de vie + identification GE
  'POSE', 'DEPOSE',
  'GENERATEUR', 'ELECTROGENE', 'GROUPE ELECTRO',
  // Composants GE (domaine — extensions du cahier des charges)
  'MOTEUR', 'RADIATEUR', 'TURBO', 'INJECT', 'POMPE',
  'REGULATEUR', 'PARAFOUDRE', 'AUTOMATE', 'DEEPSEA', 'DEEP SEA',
  'CARBURANT', 'GASOIL', 'G.O.', 'FUEL',
  'DISJONCTEUR', 'CONTACTEUR', 'EMBRAYAGE',
  'KIT VIDANGE', 'ROBINET', 'DURITE'
];

function normText(s) {
  return String(s || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isGeRelatedWork(description) {
  const t = normText(description);
  if (!t) return false;
  if (GE_WORD_TOKENS.test(t)) return true;
  return GE_SUBSTRINGS.some((k) => t.includes(k));
}

// true si la description signifie un remplacement complet du GE
// (≈ depose + pose) — sans exiger les mots POSE/DEPOSE.
export function isGeReplacement(description) {
  const t = normText(description);
  return /\b(REMPLACEMENT|RPLCEMENT|RPLCMENT|REMPLT|RPL|CHANGEMENT)\s+(DU\s+|DE\s+|D[EU']\s*)?GE\b/.test(t);
}
