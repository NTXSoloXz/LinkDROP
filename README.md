# LinkDrop V1 — prototype local

Mini App de recrutement de livreurs : formulaire, préférences, base SQLite locale et espace administrateur.

## Prérequis
- Node.js LTS
- npm

## Installation Windows (PowerShell)
1. Extrais le ZIP dans un dossier, par exemple `C:\Users\TON_USER\linkdrop-v1`.
2. Ouvre PowerShell dans ce dossier.
3. Exécute :

```powershell
Copy-Item .env.example .env
notepad .env
```

Dans `.env`, remplace `ADMIN_PASSWORD` par un mot de passe long et unique et `SESSION_SECRET` par une longue chaîne aléatoire. Pour un test local, laisse `ALLOW_LOCAL_TEST=true`.

Puis :

```powershell
npm install
npm run dev
```

Ouvre `http://localhost:5173`.

## Espace admin
Clique sur `ADMIN` dans l'en-tête. Le mot de passe est celui de `ADMIN_PASSWORD` dans `.env`. Les candidatures sont stockées localement dans `server/data/linkdrop.sqlite`.

## Limites importantes
- Ceci est une V1 de développement, pas encore une mise en production.
- En mode local, `ALLOW_LOCAL_TEST=true` permet d'envoyer des candidatures sans Telegram. Ne laisse pas cette option activée en production.
- Pour connecter Telegram, configure le token du bot dans `TELEGRAM_BOT_TOKEN`, crée la Mini App via BotFather, puis configure son URL HTTPS. L'API valide alors `initData` si celui-ci est fourni.
- Avant de collecter de vraies données, ajoute une notice de confidentialité complète, une durée de conservation, une procédure de suppression/export et une sécurisation production (HTTPS, cookies sécurisés, rate limiting, gestion des secrets, sauvegardes et hébergement adapté).
- Les photos sont stockées localement dans `server/uploads`. Prévois des règles d'accès et de conservation avant mise en ligne.
- Pas de marketplace, pas de commandes client et pas de paiement actif : cela reste hors périmètre V1.
