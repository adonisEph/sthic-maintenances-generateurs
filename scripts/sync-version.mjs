// Garde public/app-version.json synchronisé avec APP_VERSION (src/App.jsx).
// La bannière "mise à jour" compare ce fichier servi côté client à la
// version embarquée dans le bundle — sans synchro, elle ne s'affiche plus.
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('src/App.jsx', 'utf8');
const m = src.match(/APP_VERSION\s*=\s*'([^']+)'/);
if (!m) {
  console.error("APP_VERSION introuvable dans src/App.jsx");
  process.exit(1);
}
writeFileSync('public/app-version.json', JSON.stringify({ version: m[1] }) + '\n');
console.log(`app-version.json synchronisé → ${m[1]}`);
