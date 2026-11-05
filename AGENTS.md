# Notes projet

## Version bump — 3 emplacements obligatoires

À chaque release, incrémenter LES TROIS :

1. `src/App.jsx` → `const APP_VERSION = 'x.y.z'` (version affichée dans l'UI)
2. `public/app-version.json` → `{"version":"x.y.z"}` (détection de mise à jour côté client, fetch no-store)
3. `public/sw.js` → `const CACHE = 'gmga-pwa-vNNN'` (bust du cache PWA — incrémenter NNN)

`package.json` n'est PAS maintenu pour la version (dérive connue).

## Déploiement

Push sur `main` → build+deploy automatique Cloudflare Pages (`sthic-maintenances-generateurs.pages.dev`). Vérifications locales : `node --check` (Functions), `npx esbuild --loader:.jsx=jsx` (composants), `npm run build`.

## D1

Base : `sthic-maintenances-generateurs-db` (via `npx wrangler d1 execute sthic-maintenances-generateurs-db --remote --command "..."`).

## Agent Excel (Historique GE)

Auth par clé `X-Api-Key` = variable d'env `GE_AGENT_API_KEY` (Pages → Settings → Environment variables → Secret). Endpoints : `POST /api/ge-history/events`, `PATCH/DELETE /api/ge-history/events/{id}`.
