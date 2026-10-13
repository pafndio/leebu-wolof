# 📖 Wolof Njaay Neena — Léebu du jour

Application web — 100% statique, sans serveur ni base de données — qui présente des **léebu** (proverbes wolof du Sénégal) : une citation chaque jour, une bibliothèque de plus de 2 600 léebu à explorer, des favoris, et un partage en image pour les réseaux sociaux ou en statut WhatsApp/Instagram.

Installable comme une vraie application sur téléphone (PWA), avec accès hors ligne une fois ouverte une première fois.

## ✨ Fonctionnalités

- **Citation du jour** : un léebu mis en avant chaque jour, identique pour tous
- **Nouvelle citation** : parcours aléatoire sans répétition jusqu'à avoir tout lu (progression sauvegardée sur l'appareil, sans compte)
- **Explorer** : recherche et navigation dans les 2 763 léebu (wolof + traduction française quand elle existe)
- **Favoris** : mettre des léebu de côté, conservés localement
- **Partage en image** : génère une carte visuelle du léebu du jour et l'envoie directement au partage natif (réseaux sociaux, statut) ou la télécharge en PNG
- **Application installable** : « Ajouter à l'écran d'accueil » sur mobile, fonctionne hors ligne ensuite
- **Aucune donnée personnelle collectée** : tout reste dans le navigateur (localStorage)

## 📱 Pensée 100 % mobile

- Interface plein écran, barre d'onglets en bas à portée du pouce, zones sécurisées iPhone (encoche, barre d'accueil)
- **Bouton retour** du téléphone : revient à l'onglet précédent avant de quitter l'app
- **Balayage** de la carte du jour vers la gauche ou la droite pour un nouveau léebu, avec légère vibration
- Cibles tactiles ≥ 44 px, pas de zoom accidentel, pas de rebond de page
- **Raccourcis** par appui long sur l'icône (Android) : Citation du jour, Explorer, Favoris
- iPhone : guide d'installation pas à pas intégré (Safari n'a pas d'invite automatique)
- Sur ordinateur, l'app reste une colonne de téléphone centrée

## 📂 Structure du projet

```
wolof-njaay-neena-web/
├── index.html              # Page unique de l'application
├── manifest.webmanifest    # Déclaration PWA (icônes, couleurs, nom)
├── service-worker.js       # Cache hors-ligne
├── css/
│   └── styles.css
├── js/
│   └── app.js              # Toute la logique (citations, favoris, partage, image)
├── data/
│   └── citations.json      # 2 763 léebu (nettoyés, dédupliqués)
├── assets/
│   └── icons/               # Icônes de l'application (192, 512, maskable, favicon…)
├── LICENSE
└── README.md
```

## 🚀 Déployer sur GitHub Pages

### 1. Créer le dépôt

Sur [github.com/new](https://github.com/new), créez un dépôt (par exemple `wolof-njaay-neena`). Ne cochez aucune case d'initialisation (pas de README auto).

### 2. Pousser les fichiers

Depuis le dossier `wolof-njaay-neena-web` :

```bash
cd wolof-njaay-neena-web
git init
git add .
git commit -m "Wolof Njaay Neena — application web"
git branch -M main
git remote add origin https://github.com/VOTRE-COMPTE/wolof-njaay-neena.git
git push -u origin main
```

### 3. Activer GitHub Pages

1. Sur GitHub, ouvrez le dépôt → onglet **Settings**
2. Dans le menu de gauche, cliquez sur **Pages**
3. Sous « Build and deployment » → **Source**, choisissez **Deploy from a branch**
4. **Branch** : `main`, dossier `/ (root)` → **Save**
5. Attendez une minute, l'URL apparaît en haut de la page (généralement `https://VOTRE-COMPTE.github.io/wolof-njaay-neena/`)

C'est tout : le site est en ligne, sans build ni dépendance à installer.

### 4. Mettre à jour le site plus tard

```bash
git add .
git commit -m "Mise à jour"
git push
```

GitHub Pages republie automatiquement en quelques dizaines de secondes.

## 📱 Installer l'application sur un téléphone

- **Android (Chrome)** : un bandeau « Installer » apparaît automatiquement dans l'application ; sinon, menu ⋮ → **Ajouter à l'écran d'accueil**
- **iPhone (Safari)** : bouton de partage 􀈂 → **Sur l'écran d'accueil**
- **Ordinateur (Chrome/Edge)** : icône d'installation dans la barre d'adresse

Une fois installée, l'application s'ouvre en plein écran comme une app native et reste utilisable hors connexion.

## 🖼️ Partage en image

Le bouton **Image** de l'écran d'accueil dessine une carte du léebu du jour (fond nuit, bandeau tissé, typographie servant le texte wolof) directement dans le navigateur, sans serveur. Sur mobile, cela ouvre le menu de partage natif — l'image peut alors être envoyée en statut WhatsApp, story Instagram, ou tout autre réseau. Sur ordinateur, l'image est simplement téléchargée en PNG.

## 🛠️ Personnaliser

- **Citations** : éditez `data/citations.json` (tableau d'objets `{ "id": "...", "citation": "...", "traduction": "..." }`)
- **Couleurs** : variables CSS en haut de `css/styles.css` (`:root { --night, --parchment, --saffron, --brick, --green … }`)
- **Icônes** : régénérez les fichiers dans `assets/icons/` si vous changez le nom ou le symbole de l'application

## 🙏 Origine

Adapté du projet original [pafndio/wolof-njaay-neena](https://github.com/pafndio/wolof-njaay-neena) (version mobile Kivy), pour préserver et partager le patrimoine oral wolof du Sénégal.

## 📄 Licence

MIT — voir [LICENSE](LICENSE).

---

**Jërëjëf !** (Merci) 🇸🇳
