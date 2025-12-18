# 🔧 Guide de Dépannage Rapide

## 🚨 Problèmes Courants et Solutions

### 1. L'application ne démarre pas

#### Symptôme
```bash
npm run dev
# Erreur ou rien ne se passe
```

#### Solutions
```bash
# Solution 1: Vérifier Node.js
node --version  # Doit afficher v16 ou supérieur

# Solution 2: Réinstaller les dépendances
rm -rf node_modules package-lock.json
npm install

# Solution 3: Nettoyer le cache
npm cache clean --force
npm install

# Solution 4: Utiliser une version spécifique de Node
nvm use 18  # Si vous utilisez nvm
```

---

### 2. Erreur "Module not found"

#### Symptôme
```
Error: Cannot find module 'lucide-react'
ou
Error: Cannot find module 'xlsx'
```

#### Solutions
```bash
# Installer les dépendances manquantes
npm install

# Ou installer spécifiquement
npm install lucide-react xlsx jspdf

# Vérifier package.json
cat package.json  # Vérifier que toutes les dépendances sont listées
```

---

### 3. Les styles ne s'appliquent pas

#### Symptôme
L'application s'affiche sans couleurs, tout est noir et blanc

#### Solutions
1. **Vérifier index.html** - La ligne Tailwind doit être présente:
   ```html
   <script src="https://cdn.tailwindcss.com"></script>
   ```

2. **Vérifier la connexion internet** (pour charger Tailwind CDN)

3. **Solution alternative**: Installer Tailwind localement
   ```bash
   npm install -D tailwindcss postcss autoprefixer
   npx tailwindcss init -p
   ```

---

### 4. Les données ne persistent pas

#### Symptôme
Les sites ajoutés disparaissent après rechargement de la page

#### Solutions

1. **Vérifier localStorage**
   - Ouvrir DevTools (F12)
   - Aller dans Application → Local Storage
   - Vérifier que 'generator-sites' existe

2. **Vérifier que les cookies sont autorisés**
   - Paramètres navigateur → Confidentialité
   - Autoriser les cookies et données de site

3. **Tester en navigation normale** (pas en navigation privée)

4. **Vérifier la console pour erreurs**
   ```javascript
   // Dans la console du navigateur
   localStorage.getItem('generator-sites')
   // Doit afficher les données ou null
   ```

---

### 5. L'import Excel ne fonctionne pas

#### Symptôme
Erreur lors de l'import de fichier Excel

#### Solutions

1. **Vérifier le format du fichier**
   - Le fichier doit être .xlsx ou .xls
   - Les colonnes doivent correspondre exactement

2. **Réinstaller XLSX**
   ```bash
   npm uninstall xlsx
   npm install xlsx@0.18.5
   ```

3. **Vérifier les données**
   - Pas de cellules vides dans les colonnes obligatoires
   - Les dates doivent être au format reconnaissable
   - Les nombres doivent être des nombres (pas du texte)

---

### 6. Le build échoue

#### Symptôme
```bash
npm run build
# Erreur de compilation
```

#### Solutions

1. **Vérifier les erreurs de syntaxe**
   ```bash
   # Vérifier les fichiers un par un
   node --check src/App.jsx
   node --check src/main.jsx
   ```

2. **Nettoyer et rebuilder**
   ```bash
   rm -rf dist node_modules
   npm install
   npm run build
   ```

3. **Vérifier la version de Node**
   ```bash
   node --version  # >= 16.0.0
   ```

---

### 7. Erreur 404 après déploiement

#### Symptôme
L'application fonctionne en local mais affiche 404 en ligne

#### Solutions

1. **Pour Netlify**: Créer `_redirects` dans le dossier public
   ```
   /*    /index.html   200
   ```

2. **Pour Vercel**: Créer `vercel.json` à la racine
   ```json
   {
     "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
   }
   ```

3. **Pour Apache**: Créer `.htaccess` dans dist/
   ```apache
   <IfModule mod_rewrite.c>
     RewriteEngine On
     RewriteBase /
     RewriteRule ^index\.html$ - [L]
     RewriteCond %{REQUEST_FILENAME} !-f
     RewriteCond %{REQUEST_FILENAME} !-d
     RewriteRule . /index.html [L]
   </IfModule>
   ```

---

### 8. Port déjà utilisé

#### Symptôme
```
Error: Port 3000 is already in use
```

#### Solutions

1. **Tuer le processus**
   ```bash
   # Linux/Mac
   lsof -ti:3000 | xargs kill -9
   
   # Windows
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F
   ```

2. **Utiliser un autre port**
   ```bash
   # Modifier vite.config.js
   server: {
     port: 3001  # Changer le port
   }
   ```

---

### 9. Erreur de mémoire (heap out of memory)

#### Symptôme
```
FATAL ERROR: Reached heap limit
```

#### Solutions

```bash
# Augmenter la mémoire allouée
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build

# Ou dans package.json
"build": "NODE_OPTIONS='--max-old-space-size=4096' vite build"
```

---

### 10. Les calculs sont incorrects

#### Symptôme
Les dates EPV ou le régime calculé semblent faux

#### Solutions

1. **Vérifier les données saisies**
   - NH2 doit être > NH1
   - Date A doit être après Date DV
   - Vérifier que ce sont bien des nombres

2. **Vérifier la console**
   - F12 → Console
   - Chercher des warnings ou erreurs de calcul

3. **Tester avec des valeurs simples**
   ```
   NH1: 100
   Date DV: 01/01/2024
   NH2: 200
   Date A: 11/01/2024
   
   Régime attendu: (200-100)/(11-1) = 10 H/jour
   ```

---

## 🛠️ Commandes de Diagnostic

```bash
# Vérifier l'installation
node --version
npm --version

# Vérifier les dépendances
npm list

# Nettoyer complètement
rm -rf node_modules package-lock.json dist
npm cache clean --force
npm install

# Tester la compilation
npm run build

# Vérifier les erreurs
npm run dev 2>&1 | grep -i error
```

---

## 📞 Support Avancé

### Vérifier les logs

```bash
# Logs détaillés
npm run dev --verbose

# Logs de build
npm run build --verbose
```

### Réinitialisation Complète

```bash
#!/bin/bash
# Script de réinitialisation totale

# 1. Nettoyer tout
rm -rf node_modules package-lock.json dist

# 2. Nettoyer le cache npm
npm cache clean --force

# 3. Réinstaller
npm install

# 4. Tester
npm run dev
```

---

## 🔍 Checklist de Dépannage

Avant de demander de l'aide, vérifier:

- [ ] Node.js version >= 16
- [ ] npm install exécuté sans erreur
- [ ] Aucune erreur dans la console (F12)
- [ ] localStorage activé dans le navigateur
- [ ] Connexion internet active (pour Tailwind CDN)
- [ ] Pas en mode navigation privée
- [ ] Fichiers bien placés selon la structure
- [ ] Port 3000 disponible
- [ ] Antivirus ne bloque pas Node.js

---

## 💡 Conseils de Prévention

1. **Toujours commit avant de modifier**
2. **Garder Node.js à jour**
3. **Sauvegarder les données** (Export Excel régulier)
4. **Tester en local avant de déployer**
5. **Lire les messages d'erreur complets**

---

## 📝 Rapporter un Bug

Si le problème persiste, noter:
1. Version de Node.js: `node --version`
2. Système d'exploitation
3. Message d'erreur exact
4. Étapes pour reproduire
5. Capture d'écran de la console (F12)
