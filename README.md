# Boutique Telegram — MVP

Bot Telegram e-commerce avec catégories, panier, commande et paiement crypto manuel (BTC / USDT).
Stack : **Node.js + Telegraf** · **Express** (webhook) · **Prisma** (SQLite en dev, MySQL en prod).

## 1. Installation locale

```bash
# 1. Dépendances
npm install

# 2. Variables d'environnement
cp .env.example .env
# Édite .env : BOT_TOKEN, ADMIN_ID, BTC_WALLET, USDT_WALLET

# 3. Base de données (SQLite)
npm run db:migrate -- --name init
npm run db:seed

# 4. Lancement en mode polling (dev local — pas besoin de domaine)
npm run dev
```

Pour récupérer ton **BOT_TOKEN** : ouvre Telegram, parle à `@BotFather`, fais `/newbot`.
Pour récupérer ton **ADMIN_ID** : parle à `@userinfobot`, copie le numérique.

## 2. Tester le bot

Dans Telegram, ouvre ton bot puis envoie `/start`.

Parcours :

1. Choisis une catégorie (ex. *Mode → Homme → Sneakers*).
2. Ouvre un produit, *Ajouter au panier*.
3. *🛒 Voir Panier* → *✅ Commander*.
4. Saisis nom, adresse, notes.
5. Choisis **BTC** ou **USDT**.
6. Le bot affiche le wallet ; envoie capture / hash → relayé à l'admin.

L'admin (toi, via `ADMIN_ID`) reçoit en MP :
- la nouvelle commande (récap + client + montant)
- la preuve de paiement (forward du message du client)

## 3. Déploiement sur Hostinger (sans VPS)

Hostinger en mutualisé peut héberger Node.js — il faut activer **Node.js** dans hPanel :

1. **Crée un sous-domaine** dédié, ex. `bot.monshop.com`, avec SSL activé.
2. Dans hPanel → **Avancé → Node.js** :
   - Version Node : 18+
   - Application root : dossier où tu uploades ce projet
   - Application URL : `bot.monshop.com`
   - Startup file : `src/index.js`
3. Upload du projet (FTP, Git, ou Gestionnaire de fichiers).
4. SSH ou terminal Node : `npm install --omit=dev`
5. Crée `.env` sur le serveur :
   ```env
   BOT_TOKEN=...
   ADMIN_ID=...
   BOT_MODE=webhook
   WEBHOOK_DOMAIN=https://bot.monshop.com
   WEBHOOK_PATH=/api/telegram/webhook
   WEBHOOK_SECRET=une_chaine_aleatoire
   DATABASE_URL="mysql://USER:PASS@srv-host:3306/u123_shop"
   BTC_WALLET=bc1q...
   USDT_WALLET=T...
   USDT_NETWORK=TRC20
   ```
6. **Bascule Prisma sur MySQL** : édite `prisma/schema.prisma` et change `provider = "mysql"`.
7. Migrations + seed sur la base Hostinger :
   ```bash
   npm run db:deploy
   npm run db:seed
   ```
8. Démarre l'app via hPanel (bouton *Restart*).
9. Vérifie : `https://bot.monshop.com/health` doit répondre `{ "ok": true }`.

Telegram appellera automatiquement `https://bot.monshop.com/api/telegram/webhook` — la route est créée par Telegraf au démarrage.

> 💡 Si Hostinger n'accepte pas Node.js sur ton offre, l'alternative la plus simple est de déployer le bot sur **Railway / Render / Fly.io** (free tier) et de laisser Hostinger héberger juste le dashboard admin plus tard.

## 4. Commandes utiles

| Commande | Effet |
|----------|-------|
| `npm run dev` | Bot en polling (dev) |
| `npm start` | Bot en mode configuré par `BOT_MODE` |
| `npm run db:migrate` | Crée/applique les migrations Prisma |
| `npm run db:seed` | Insère catégories/produits de démo |
| `npm run db:studio` | Interface graphique Prisma (utile pour ajouter des produits manuellement avant le dashboard) |

## 5. Architecture

```
src/
├── index.js              # Express + bot (polling ou webhook)
├── config.js             # Chargement .env
├── bot/
│   ├── bot.js            # Instance Telegraf + middleware user/session/scenes
│   ├── keyboards.js      # Claviers inline réutilisables
│   ├── handlers/
│   │   ├── start.js      # /start + menu d'accueil
│   │   ├── categories.js # Navigation catégories/sous-catégories
│   │   ├── products.js   # Fiche produit + ajout panier
│   │   ├── cart.js       # Affichage et modification du panier
│   │   └── payment.js    # Choix BTC/USDT, création commande, capture preuve
│   └── scenes/
│       └── checkout.js   # Multi-étapes nom/adresse/notes
├── services/
│   ├── cart.service.js   # Logique panier
│   ├── order.service.js  # Création commande + décrément stock (transactionnel)
│   └── notify.service.js # Notifications admin
└── db/
    └── client.js         # Singleton Prisma
```

## 6. Étapes suivantes (post-MVP)

- 🎛️ **Dashboard admin Next.js** (`apps/admin/`) pour gérer produits/commandes/stocks.
- 💸 **Paiement automatique** via NOWPayments / Coinbase Commerce (webhook IPN).
- 🔎 Recherche produit, favoris, coupons promo.
- 🌍 Multi-langue (FR/EN).
- 📦 Suivi commande (statut payé / expédié / livré).
- 📊 Statistiques de ventes, produits populaires.
