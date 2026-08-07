# Leçons cumulées — Carboniq

---

### [2026-03-31] Leçon : Supabase free tier se met en pause
Contexte : L'app affichait "Application Error" — la DB Supabase ne répondait plus
Erreur : On a cherché un problème de code alors que c'était l'infra (DB en pause)
Règle : Toujours vérifier la connectivité Supabase en premier si l'app crash en prod. Envisager UptimeRobot pour garder la DB éveillée.

### [2026-03-31] Leçon : connection_limit=1 obligatoire pour Vercel + Supabase
Contexte : Prisma timeout "Timed out fetching a new connection from the connection pool"
Erreur : DATABASE_URL sans `&connection_limit=1` saturait le pool de connexions
Règle : Toujours ajouter `?pgbouncer=true&connection_limit=1` à la DATABASE_URL en serverless (Vercel).

### [2026-03-31] Leçon : Scripts Prisma locaux ne touchent pas la DB prod
Contexte : On a modifié le plan Shop via un script Node local, mais ça n'a pas changé en prod
Erreur : Le .env local pointe vers une DB différente de Supabase prod
Règle : Pour modifier la DB prod, utiliser le SQL Editor de Supabase directement. Ne jamais supposer que le script local touche la prod.

### [2026-03-31] Leçon : Shopify teste /webhooks pour la vérification HMAC
Contexte : La vérification "Signatures HMAC" échouait avec un 404
Erreur : Les webhooks étaient sur /webhooks/products/create etc., mais Shopify teste /webhooks directement
Règle : Toujours créer une route catch-all /webhooks qui utilise authenticate.webhook() pour satisfaire le test HMAC de Shopify.

### [2026-03-31] Leçon : Vercel doit être connecté au bon repo GitHub
Contexte : Les commits étaient pushés sur carboniq-carbon/carboniq mais Vercel surveillait SezerPro/carboniq
Erreur : Les redéploiements Vercel restaient sur un ancien commit
Règle : Vérifier que Vercel pointe vers le bon repo GitHub. Si on change de repo, reconnecter Vercel.

### [2026-03-31 → mis à jour 2026-05-11] Leçon : Billing API + boutique dev — flag `test` obligatoire
Contexte : Impossible d'upgrader le plan via l'app sur la boutique de développement
Erreur initiale : On envoyait `test: false` à `appSubscriptionCreate` parce que `process.env.NODE_ENV === "production"` côté Vercel — Shopify rejette les charges réelles sur les dev stores. On contournait en modifiant la DB à la main.
Résolution (commit 9fd96e8) : Détecter le type de boutique via GraphQL (`shop.plan.partnerDevelopment`) et passer `test: true` automatiquement pour les Partner Dev Stores, indépendamment de NODE_ENV.
Règle : Le flag `test` de `appSubscriptionCreate` doit dépendre du **type de boutique** (dev vs prod), jamais de NODE_ENV. Helper `isDevelopmentStore()` dans `billing.server.ts`.

### [2026-08-08] Leçon : Prisma + Supabase = tables publiques par défaut
Contexte : Alerte critique Supabase « rls_disabled_in_public » sur le projet carboniq
(ekbwnncenxbstpfcyxwq). Les 15 tables du schéma `public` — dont `Session` et `Shop`,
qui stockent les **access tokens Shopify** de chaque marchand, plus les emails clients
de `Certificate` / `CarbonOffset` — étaient exposées en lecture ET écriture via
l'API Data (`/rest/v1/<Table>`) à quiconque détenait la clé anon du projet.
Erreur : on a supposé qu'utiliser Prisma via le pooler Postgres mettait la DB à l'abri.
C'est faux — Supabase expose `public` via PostgREST **en parallèle** de la connexion
Postgres, et son `ALTER DEFAULT PRIVILEGES` accorde tous les droits à `anon` /
`authenticated` sur chaque table créée. Prisma, lui, n'active jamais la RLS.
Règle : toute migration créant une table finit par `ENABLE ROW LEVEL SECURITY`, sans
policy (Carboniq n'utilise pas l'API Data). Jamais de `FORCE ROW LEVEL SECURITY` :
Prisma se connecte en `postgres`, propriétaire des tables, et doit contourner la RLS —
c'est précisément ce qui rend le correctif sans impact sur l'app.
Correctif : migration `20260808000000_enable_rls_and_lock_data_api` (RLS + revoke des
privilèges anon/authenticated + coupure du default privilege qui ré-exposait les
futures tables). Contrôles dans `prisma/sql/rls-check.sql`.

### [2026-03-31] Leçon : Screenshots Shopify App Store = exactement 1600x900
Contexte : Les captures d'écran ne se chargeaient pas dans le formulaire
Erreur : Dimensions incorrectes (1615x892 au lieu de 1600x900)
Règle : Shopify est strict sur les dimensions. Toujours vérifier et recadrer à exactement 1600x900 px avant upload.
