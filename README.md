# 🃏 Solitaire — PWA

## Déployer sur Vercel (5 minutes)

### Étape 1 — Mettre le projet sur GitHub
1. Créez un compte sur [github.com](https://github.com) si vous n'en avez pas
2. Cliquez **"New repository"**, nommez-le `solitaire`, cliquez **Create**
3. Sur votre ordinateur, dans le dossier du projet :
```bash
git init
git add .
git commit -m "Solitaire"
git branch -M main
git remote add origin https://github.com/VOTRE_NOM/solitaire.git
git push -u origin main
```

### Étape 2 — Déployer sur Vercel
1. Allez sur [vercel.com](https://vercel.com)
2. Cliquez **"Sign up"** → connectez-vous avec GitHub
3. Cliquez **"Add New Project"**
4. Choisissez votre repo `solitaire`
5. Cliquez **Deploy** — c'est tout !

Vercel vous donnera une URL comme `solitaire-xyz.vercel.app`

### Étape 3 — Ajouter sur l'écran d'accueil iPhone
1. Ouvrez l'URL dans **Safari** (pas Chrome!)
2. Appuyez sur le bouton **Partager** (carré avec flèche)
3. Faites défiler → **"Sur l'écran d'accueil"**
4. Appuyez **Ajouter**

✅ L'application apparaît sur votre écran d'accueil avec une icône, s'ouvre en plein écran sans barre Safari — comme une vraie app !

---

## Développement local
```bash
npm install
npm run dev
```
Ouvrez [http://localhost:3000](http://localhost:3000)
