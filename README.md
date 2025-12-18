# 🔧 Application de Gestion de Maintenance des Générateurs

Application web moderne pour gérer la maintenance préventive des générateurs avec calculs automatiques des vidanges.

## ✨ Fonctionnalités

- ✅ Gestion complète des sites (CRUD)
- 📊 Calculs automatiques : régime, NH estimé, dates de vidange (EPV)
- 📄 Génération de fiches d'intervention PDF
- 📅 Calendrier des maintenances
- 📈 Statistiques et alertes d'urgence
- 💾 Import/Export Excel
- 🎨 Interface responsive et intuitive
- 🔔 Code couleur selon l'urgence des interventions

## 🚀 Installation Locale

### Prérequis
- Node.js (version 16 ou supérieure)
- npm ou yarn

### Étapes d'installation

1. **Extraire le dossier du projet**
   ```bash
   cd generator-maintenance
   ```

2. **Installer les dépendances**
   ```bash
   npm install
   ```

3. **Lancer en mode développement**
   ```bash
   npm run dev
   ```
   L'application sera accessible sur `http://localhost:3000`

4. **Compiler pour la production**
   ```bash
   npm run build
   ```
   Les fichiers compilés seront dans le dossier `dist/`

## 🌐 Déploiement en Ligne

### Option 1 : Netlify (Recommandé - Gratuit)

1. **Via l'interface Netlify**
   - Créer un compte sur [netlify.com](https://netlify.com)
   - Glisser-déposer le dossier `dist/` après avoir fait `npm run build`
   - Votre site sera en ligne en quelques secondes !

2. **Via Netlify CLI**
   ```bash
   npm install -g netlify-cli
   npm run build
   netlify deploy --prod
   ```

### Option 2 : Vercel (Gratuit)

1. **Via l'interface Vercel**
   - Créer un compte sur [vercel.com](https://vercel.com)
   - Importer le projet depuis GitHub ou glisser-déposer le dossier
   - Vercel détecte automatiquement Vite et déploie

2. **Via Vercel CLI**
   ```bash
   npm install -g vercel
   vercel
   ```

### Option 3 : GitHub Pages

1. **Modifier vite.config.js**
   ```javascript
   export default defineConfig({
     base: '/nom-de-votre-repo/',
     // ... reste de la config
   });
   ```

2. **Installer gh-pages**
   ```bash
   npm install --save-dev gh-pages
   ```

3. **Ajouter dans package.json**
   ```json
   "scripts": {
     "deploy": "npm run build && gh-pages -d dist"
   }
   ```

4. **Déployer**
   ```bash
   npm run deploy
   ```

### Option 4 : Hébergement simple (serveur web)

Après `npm run build`, copier le contenu du dossier `dist/` sur n'importe quel serveur web (Apache, Nginx, etc.)

## 📁 Structure du Projet

```
generator-maintenance/
├── src/
│   ├── App.jsx              # Composant principal
│   ├── main.jsx             # Point d'entrée
│   ├── hooks/
│   │   └── useStorage.js    # Gestion du localStorage
│   └── utils/
│       └── calculations.js  # Logique métier (calculs)
├── public/                  # Assets statiques
├── index.html              # Template HTML
├── vite.config.js          # Configuration Vite
└── package.json            # Dépendances
```

## 💾 Stockage des Données

- Les données sont sauvegardées automatiquement dans le **localStorage** du navigateur
- Persistance locale uniquement (pas de serveur backend requis)
- Export/Import Excel disponibles pour sauvegardes externes

## 🔧 Technologies Utilisées

- **React 18** - Framework UI
- **Vite** - Build tool rapide
- **Tailwind CSS** - Styling (via CDN)
- **Lucide React** - Icônes
- **XLSX** - Import/Export Excel
- **jsPDF** - Génération de PDFs

## 📝 Notes Importantes

### Calculs Automatiques
- **Régime** : Calculé automatiquement basé sur NH1, NH2 et les dates
- **NH Estimé** : Mis à jour quotidiennement en fonction du régime
- **EPV (Échéances Prochaines Vidanges)** : Calculées automatiquement avec seuil de 250H

### Codes Couleur
- 🔴 Rouge : Retard ou moins de 3 jours
- 🟠 Orange : 4-7 jours
- 🟢 Vert : Plus de 7 jours
- ⚪ Gris : Site retiré

## 🆘 Support

Pour toute question ou problème :
- Vérifier que Node.js est bien installé : `node --version`
- Vérifier les dépendances : `npm install`
- Consulter les logs de la console navigateur (F12)

## 📜 Licence

Application développée pour la gestion de maintenance industrielle.

---

**Version** : 1.0.0  
**Dernière mise à jour** : Décembre 2024
