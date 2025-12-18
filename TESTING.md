# ✅ Guide de Test des Fonctionnalités

Ce document permet de vérifier que toutes les fonctionnalités de l'application fonctionnent correctement.

## 🔍 Checklist de Test

### 1. Installation et Lancement
- [ ] `npm install` s'exécute sans erreur
- [ ] `npm run dev` lance l'application
- [ ] L'application s'ouvre dans le navigateur sur http://localhost:3000
- [ ] Aucune erreur dans la console (F12)

### 2. Interface Utilisateur
- [ ] Le titre "Gestion Maintenance Générateurs" est affiché
- [ ] Le bouton "➕ Ajouter Site" est visible
- [ ] Les statistiques (Total Sites, Vidanges Urgentes, etc.) s'affichent
- [ ] L'interface est responsive (tester en mode mobile avec F12)

### 3. Ajout de Site
- [ ] Cliquer sur "➕ Ajouter Site"
- [ ] Le formulaire s'ouvre
- [ ] Remplir tous les champs :
  - Nom du Site: TEST-SITE-01
  - ID Site: TS001
  - Technicien: Jean Dupont
  - Générateur: KOHLER 50KVA
  - Capacité: 50KVA
  - Kit Vidange: KIT-001
  - NH1 DV: 100
  - Date DV: 01/01/2024
  - NH2 A: 200
  - Date A: 15/01/2024
- [ ] Cliquer sur "Ajouter"
- [ ] Le site apparaît dans la liste
- [ ] Les calculs sont corrects :
  - Régime calculé automatiquement
  - NH Estimé affiché
  - Dates EPV1, EPV2, EPV3 générées

### 4. Vérification des Calculs
- [ ] Le régime est calculé : (NH2 - NH1) / nombre de jours
- [ ] NH Estimé augmente avec le temps
- [ ] Les dates EPV sont dans le futur
- [ ] Le code couleur correspond à l'urgence :
  - Vert si > 7 jours
  - Orange si 4-7 jours
  - Rouge si < 3 jours

### 5. Mise à Jour de Site
- [ ] Cliquer sur le bouton "MAJ" d'un site
- [ ] Le formulaire de mise à jour s'ouvre
- [ ] Modifier NH2 A et Date A
- [ ] Cliquer sur "Mettre à jour"
- [ ] Les valeurs sont mises à jour
- [ ] Les calculs sont recalculés automatiquement

### 6. Modification de Site
- [ ] Cliquer sur le bouton "Modifier" d'un site
- [ ] Tous les champs sont modifiables
- [ ] Modifier des valeurs
- [ ] Cliquer sur "Enregistrer"
- [ ] Les modifications sont sauvegardées

### 7. Retrait de Site
- [ ] Cliquer sur "Modifier"
- [ ] Cocher "Site retiré"
- [ ] Enregistrer
- [ ] Le site devient gris
- [ ] Il n'apparaît plus dans les "Vidanges Urgentes"

### 8. Suppression de Site
- [ ] Cliquer sur "Suppr." pour un site
- [ ] Une confirmation apparaît
- [ ] Confirmer la suppression
- [ ] Le site est supprimé de la liste

### 9. Génération de Fiche PDF
- [ ] Cliquer sur "📄 Fiche" pour un site
- [ ] Le modal de configuration de bannière s'ouvre
- [ ] Uploader une image (optionnel) ou continuer sans
- [ ] Une nouvelle fiche est générée
- [ ] La fiche contient :
  - Numéro de ticket unique
  - Informations du site
  - Données de maintenance
  - Dates EPV
- [ ] Le numéro de ticket s'incrémente automatiquement

### 10. Import Excel
- [ ] Créer un fichier Excel avec les colonnes :
  - Nom du Site, ID Site, Technicien, Générateur, Capacité, Kit Vidange, NH1 DV, Date DV, NH2 A, Date A
- [ ] Cliquer sur "📤 Importer Excel"
- [ ] Sélectionner le fichier
- [ ] Les sites sont importés
- [ ] Les calculs sont effectués automatiquement

### 11. Export Excel
- [ ] Ajouter quelques sites
- [ ] Cliquer sur "📥 Exporter Excel"
- [ ] Un fichier Excel est téléchargé
- [ ] Ouvrir le fichier
- [ ] Toutes les données sont présentes et correctes

### 12. Filtre par Technicien
- [ ] Ajouter des sites avec différents techniciens
- [ ] Utiliser le filtre en haut
- [ ] Sélectionner un technicien
- [ ] Seuls les sites de ce technicien s'affichent
- [ ] Revenir à "Tous les techniciens"
- [ ] Tous les sites réapparaissent

### 13. Calendrier
- [ ] Cliquer sur "📅 Calendrier"
- [ ] Le calendrier s'affiche
- [ ] Les vidanges sont marquées sur les dates
- [ ] Naviguer entre les mois
- [ ] Les dates sont correctes

### 14. Historique des Fiches
- [ ] Générer plusieurs fiches
- [ ] Cliquer sur "📚 Historique"
- [ ] Toutes les fiches générées sont listées
- [ ] Les informations sont correctes (date, site, ticket)

### 15. Statistiques
- [ ] Les statistiques sont mises à jour en temps réel
- [ ] "Total Sites" = nombre total de sites
- [ ] "Vidanges Urgentes" = sites avec EPV1 < 7 jours
- [ ] "Sites Retirés" = nombre de sites retirés
- [ ] "Prochain Ticket" = numéro suivant

### 16. Persistance des Données
- [ ] Ajouter des sites
- [ ] Fermer l'onglet/navigateur
- [ ] Rouvrir l'application
- [ ] Les données sont toujours présentes (localStorage)

### 17. Réinitialisation
- [ ] Cliquer sur "🔄 Réinitialiser"
- [ ] Confirmer
- [ ] Toutes les données sont supprimées
- [ ] L'application revient à l'état initial

### 18. Responsive Design
- [ ] Ouvrir DevTools (F12)
- [ ] Passer en mode mobile (Toggle device toolbar)
- [ ] Tester différentes tailles d'écran :
  - [ ] Mobile (320px - 480px)
  - [ ] Tablette (768px - 1024px)
  - [ ] Desktop (1280px+)
- [ ] Tous les éléments sont utilisables
- [ ] Pas de débordement horizontal

### 19. Performance
- [ ] Ajouter 50+ sites
- [ ] L'application reste fluide
- [ ] Les calculs sont rapides
- [ ] Pas de lag dans l'interface

### 20. Gestion d'Erreurs
- [ ] Essayer d'ajouter un site sans remplir tous les champs
- [ ] Un message d'erreur apparaît
- [ ] Entrer des valeurs invalides (lettres dans NH)
- [ ] L'application gère l'erreur proprement

## 🐛 Si un test échoue

1. **Vérifier la console** (F12 → Console) pour voir les erreurs
2. **Vérifier localStorage** (F12 → Application → Local Storage)
3. **Nettoyer le cache** du navigateur
4. **Redémarrer l'application** (`npm run dev`)
5. **Réinstaller les dépendances** (`npm install`)

## ✅ Résultat Attendu

**Tous les tests doivent passer** pour considérer l'application comme fonctionnelle et prête au déploiement.

---

## 📝 Notes de Test

Date: _______________
Testeur: _______________

Tests passés: ____ / 20

Problèmes rencontrés:
- 
- 
- 

Commentaires:
