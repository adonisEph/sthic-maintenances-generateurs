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

// Extrait la signalétique du NOUVEAU GE depuis une description de
// remplacement : « Remplacement GE GL 20Kva par GE Elcos 30kva »
// → { groupe: 'Elcos', kva: '30 KVA' }. Vide si non identifiable.
export function parseReplacementGe(description) {
  const d = String(description || '');
  const m = d.match(/(?:\bpar\s+(?:un|le|la)?\s*|\bavec\s+(?:un|le|la)?\s*|→|->)\s*(.+)$/i);
  if (!m) return { groupe: '', kva: '' };
  const tail = m[1].replace(/[.,;].*$/, '').trim();
  const kvaM = tail.match(/(\d+)\s*kva/i);
  const kva = kvaM ? `${kvaM[1]} KVA` : '';
  const groupe = tail
    .replace(/\bG\.?E\.?\b/gi, '')
    .replace(/groupe\s+electrogene|electrogene|generateur|generatrice/gi, '')
    .replace(/\d+\s*kva/ig, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { groupe: groupe.slice(0, 40), kva };
}

// Extrait la signalétique de l'ANCIEN GE (partie avant « par »/« → ») :
// « Remplacement GE GL 20Kva par GE Elcos 30kva » → { groupe: 'GL', kva: '20 KVA' }.
// Sert à renseigner la fiche du GE remplacé quand rien d'autre ne la décrit.
export function parseReplacedGe(description) {
  const d = String(description || '');
  const m = d.match(/(.*?)(?:\bpar\b|\bavec\b|→|->)/i);
  if (!m) return { groupe: '', kva: '' };
  const head = m[1];
  const kvaM = head.match(/(\d+)\s*kva/i);
  const kva = kvaM ? `${kvaM[1]} KVA` : '';
  const gm = head.match(/\bGE\s+([A-Za-z][\w\- ]*?)\s*(?:\d+\s*kva|$)/i);
  const groupe = gm ? String(gm[1]).replace(/\d+\s*kva/ig, '').trim() : '';
  return { groupe: groupe.slice(0, 40), kva };
}
