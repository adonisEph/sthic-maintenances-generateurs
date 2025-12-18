# 🚀 Guide de Déploiement Détaillé

## 📋 Table des Matières
1. [Déploiement Local](#déploiement-local)
2. [Déploiement sur Netlify](#netlify)
3. [Déploiement sur Vercel](#vercel)
4. [Déploiement sur serveur personnel](#serveur-personnel)
5. [Dépannage](#dépannage)

---

## 🏠 Déploiement Local

### Installation Complète

```bash
# 1. Se placer dans le dossier
cd generator-maintenance

# 2. Installer toutes les dépendances
npm install

# 3. Lancer en mode développement
npm run dev
```

L'application sera accessible sur **http://localhost:3000**

### Mode Production Local

```bash
# Compiler pour la production
npm run build

# Prévisualiser la version production
npm run preview
```

---

## 🌐 Netlify (Méthode la Plus Simple)

### Méthode 1 : Interface Web (Recommandée)

1. **Compiler le projet**
   ```bash
   npm run build
   ```

2. **Se connecter à Netlify**
   - Aller sur [netlify.com](https://netlify.com)
   - Créer un compte gratuit

3. **Déployer**
   - Cliquer sur "Add new site" → "Deploy manually"
   - Glisser-déposer le dossier `dist/`
   - ✅ Votre site est en ligne !

4. **Personnaliser le domaine** (optionnel)
   - Site settings → Domain management
   - Changer le sous-domaine ou ajouter un domaine personnalisé

### Méthode 2 : Netlify CLI

```bash
# Installer Netlify CLI
npm install -g netlify-cli

# Se connecter
netlify login

# Compiler
npm run build

# Déployer en production
netlify deploy --prod --dir=dist
```

### Configuration Automatique avec Git

1. **Pousser sur GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/votre-username/generator-app.git
   git push -u origin main
   ```

2. **Sur Netlify**
   - "Import from Git" → Sélectionner votre repo
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Deploy !

**Avantages Netlify** :
- ✅ Gratuit
- ✅ SSL automatique (HTTPS)
- ✅ Déploiement automatique à chaque push Git
- ✅ Facile à utiliser

---

## ⚡ Vercel

### Méthode 1 : Interface Web

1. **Compiler le projet**
   ```bash
   npm run build
   ```

2. **Se connecter à Vercel**
   - Aller sur [vercel.com](https://vercel.com)
   - Créer un compte gratuit

3. **Déployer**
   - "Add New..." → "Project"
   - Glisser-déposer le dossier du projet
   - Vercel détecte automatiquement Vite
   - Deploy !

### Méthode 2 : Vercel CLI

```bash
# Installer Vercel CLI
npm install -g vercel

# Se connecter
vercel login

# Déployer
vercel

# Déployer en production
vercel --prod
```

**Avantages Vercel** :
- ✅ Gratuit
- ✅ Très performant
- ✅ Optimisations automatiques
- ✅ Support React natif

---

## 🖥️ Serveur Personnel

### Apache

1. **Compiler le projet**
   ```bash
   npm run build
   ```

2. **Copier les fichiers**
   ```bash
   # Copier le contenu de dist/ vers votre dossier web
   cp -r dist/* /var/www/html/generator-app/
   ```

3. **Créer un fichier .htaccess** (pour le routing)
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

### Nginx

1. **Compiler le projet**
   ```bash
   npm run build
   ```

2. **Configuration Nginx**
   ```nginx
   server {
     listen 80;
     server_name votre-domaine.com;
     
     root /var/www/generator-app;
     index index.html;
     
     location / {
       try_files $uri $uri/ /index.html;
     }
   }
   ```

3. **Copier les fichiers**
   ```bash
   cp -r dist/* /var/www/generator-app/
   ```

4. **Redémarrer Nginx**
   ```bash
   sudo systemctl restart nginx
   ```

---

## 🔍 Dépannage

### Problème : npm install échoue

**Solution** :
```bash
# Vérifier la version de Node.js
node --version  # Doit être >= 16

# Nettoyer le cache
npm cache clean --force

# Réinstaller
rm -rf node_modules package-lock.json
npm install
```

### Problème : Tailwind CSS ne fonctionne pas

**Solution** : Le projet utilise Tailwind via CDN dans `index.html`. Vérifiez que la ligne suivante est présente :
```html
<script src="https://cdn.tailwindcss.com"></script>
```

### Problème : Les données ne persistent pas

**Cause** : localStorage bloqué ou cookies désactivés

**Solution** :
- Vérifier que les cookies sont activés dans le navigateur
- Tester en navigation privée
- Vérifier la console (F12) pour voir les erreurs

### Problème : Import Excel ne fonctionne pas

**Solution** :
```bash
# Réinstaller xlsx
npm uninstall xlsx
npm install xlsx@0.18.5
```

### Problème : Le site ne charge pas après build

**Solution** :
```bash
# Vérifier la compilation
npm run build

# Tester en local
npm run preview

# Si ça fonctionne en local mais pas en ligne,
# vérifier la configuration du serveur web
```

### Problème : Erreur 404 sur les routes

**Cause** : Le serveur web ne redirige pas vers index.html

**Solution** : Configurer le serveur pour rediriger toutes les routes vers index.html (voir sections Apache/Nginx ci-dessus)

---

## 📊 Comparaison des Options

| Option | Gratuit | Facilité | Performance | SSL | Domaine Custom |
|--------|---------|----------|-------------|-----|----------------|
| Netlify | ✅ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ✅ | ✅ |
| Vercel | ✅ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ | ✅ |
| GitHub Pages | ✅ | ⭐⭐⭐ | ⭐⭐⭐ | ✅ | ✅ |
| Serveur Personnel | 💰 | ⭐⭐ | Variable | 🔧 | ✅ |

---

## 🎯 Recommandation

**Pour débuter** : Utilisez **Netlify** avec la méthode du glisser-déposer. C'est le plus simple et gratuit !

**Pour un usage professionnel** : **Vercel** offre les meilleures performances.

**Pour un contrôle total** : Serveur personnel avec Apache ou Nginx.

---

## 💡 Conseils

1. **Toujours tester localement** avant de déployer
2. **Faire un backup** des données (Export Excel) régulièrement
3. **Utiliser un domaine personnalisé** pour plus de professionnalisme
4. **Activer HTTPS** (automatique sur Netlify/Vercel)
5. **Monitorer les performances** avec les outils intégrés des plateformes

---

**Besoin d'aide ?** Consultez la documentation officielle :
- [Netlify Docs](https://docs.netlify.com)
- [Vercel Docs](https://vercel.com/docs)
- [Vite Docs](https://vitejs.dev)
