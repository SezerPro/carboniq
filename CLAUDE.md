# CLAUDE.md — Carboniq
# App Shopify de bilan carbone CO₂ pour marchands
# Lu automatiquement par Claude Code à chaque session

---

## 🏢 CONTEXTE PROJET

**Nom** : Carboniq
**Description** : App Shopify embedded de calcul, affichage et compensation carbone pour e-commerçants
**Cible** : Marchands Shopify souhaitant afficher leur impact CO₂ et se conformer à l'EU Green Claims
**Repo** : SezerPro/carboniq
**Déploiement** : Vercel Pro
**Distribution** : Shopify App Store (embedded) + App Proxy `/apps/carboniq`
**Avancement MVP** : 100% (37/37 features complètes)

---

## 🏗️ STACK TECHNIQUE — SOURCE DE VÉRITÉ

### Frontend
| Couche | Technologie |
|---|---|
| UI Framework | React 18 |
| Routing | React Router v7 (mode framework, ex-Remix) |
| Design System | Shopify Polaris (via `@shopify/polaris-types`) |
| Bridge Shopify | App Bridge React v4 |
| Storefront | Liquid (theme extensions : badge CO₂, thank you page) |

### Backend
| Couche | Technologie |
|---|---|
| Runtime | Node.js ≥ 20.19 |
| Framework | React Router v7 (SSR + loaders/actions) |
| API Shopify | `@shopify/shopify-api` v12 + GraphQL (codegen) |
| ORM | Prisma 6 |
| BDD | SQLite (dev) — PostgreSQL (prod) |
| Sessions | Prisma Session Storage |

### Build & Tooling
| Outil | Usage |
|---|---|
| Bundler | Vite 6 |
| Langage | TypeScript 5.9 |
| Linting | ESLint 8 + plugins React/JSX-a11y/Import |
| Formatting | Prettier |
| API Types | Shopify API Codegen Preset (GraphQL → TS) |

### Infrastructure Shopify
| Composant | Détail |
|---|---|
| App | Embedded, token exchange + managed install (tokens expirables), App Proxy (`/apps/carboniq`) |
| Extensions | Theme extension `carbon-badge` — blocs Liquid |
| Webhooks | `products/create\|update\|delete`, `app/uninstalled`, `app/scopes_update` + RGPD : `customers/data_request`, `customers/redact`, `shop/redact` |
| Scopes | `read_products`, `write_products`, `write_metaobject_definitions`, `write_metaobjects` |
| API version | Admin API `2026-04` (extension `carbon-badge` : `2025-04` — à aligner) |

---

## ⚡ COMMANDES DE BUILD & TEST

```bash
# Développement
npm run dev                        # Serveur dev (Vite + React Router SSR)

# Build & vérification
npm run build                      # Build de production
npm run typecheck                  # TypeScript strict — 0 erreur obligatoire
npm run lint                       # ESLint — 0 warning en prod
npm run lint:fix                   # Auto-fix ESLint
npm run format                     # Prettier
npm run format:check               # Check sans modification

# Tests
npm test                           # Tests unitaires
npm test -- --watch                # Mode watch
npm test -- src/lib/engine         # Tester uniquement le moteur CO₂

# Prisma
npx prisma migrate dev --name <nom>    # Nouvelle migration
npx prisma migrate deploy              # Appliquer en prod
npx prisma db push                     # Push schema sans migration (dev only)
npx prisma generate                    # Regénérer le client Prisma
npx prisma studio                      # GUI pour explorer la DB
npx prisma db seed                     # Seeder la DB

# Shopify
npm run shopify -- app dev         # Dev avec tunnel Shopify
npm run codegen                    # Regénérer les types GraphQL Shopify
```

**Checklist avant chaque commit :**
```bash
npx prisma generate && npm run typecheck && npm run lint && npm run build
```

---

## 🧠 WORKFLOW — RÈGLES DE FONCTIONNEMENT

### Plan Mode — obligatoire
- Entrer en **Plan Mode** (`Shift+Tab x2`) pour TOUTE tâche impliquant 3+ étapes ou décision architecturale
- Écrire le plan dans `tasks/todo.md` avant toute implémentation
- Si quelque chose déraille : **STOP** — revenir en Plan Mode, re-planifier
- Format du plan :
  ```
  ## Objectif
  ## Étapes (numérotées, checkables)
  ## Risques / dépendances
  ## Critères de succès
  ```

### Stratégie de sous-agents
- Un sous-agent = un objectif unique (recherche, vérification, simplification)
- Déléguer les tâches longues sans rapport direct avec le contexte principal

### Boucle d'auto-amélioration (Compounding Engineering)
- Après **toute** correction reçue → mettre à jour `tasks/lessons.md` immédiatement
- Format :
  ```
  ### [Date] Leçon : <titre court>
  Contexte : ce qui s'est passé
  Erreur : ce qui a été fait de travers
  Règle : ne jamais [X], toujours [Y]
  ```
- Relire les leçons pertinentes en début de chaque session

### Vérification avant "Done"
- [ ] `npm run build` passe sans erreur
- [ ] `npm run typecheck` → 0 erreur TypeScript
- [ ] `npm run lint` → 0 warning
- [ ] `npx prisma generate` fait si schema modifié
- [ ] Testé cas nominal ET cas d'erreur
- [ ] Validation Shopify en place sur toutes les nouvelles routes publiques
- [ ] Aucune donnée cross-tenant possible (tout scopé par `shop`)

### Gestion des tâches
| Fichier | Usage |
|---|---|
| `tasks/todo.md` | Plan de la session en cours |
| `tasks/lessons.md` | Leçons cumulées cross-sessions |
| `tasks/decisions.md` | Décisions architecturales + rationale |

---

## 💳 PLANS TARIFAIRES — SOURCE DE VÉRITÉ

### ⚠️ Ces valeurs sont définies dans `constants.ts` — source unique de vérité

| Plan | Prix | Produits | Certificats/mois | Cible |
|---|---|---|---|---|
| Free | 0€ | 10 | 0 | Découverte |
| Starter | 19,90€/mois | 100 | 50 | Petites boutiques |
| Growth | 49,90€/mois | 1 000 | 500 | Boutiques en croissance |
| Pro | 89,90€/mois | 5 000 | 2 000 | Marques établies |
| Scale | 149,90€/mois | Illimité | Illimité | Entreprises |

### Features par plan

**Free** — Dashboard, badge CO₂ (style Pill uniquement), calcul ADEME, recalcul manuel

**Starter** — Free + 4 styles de badge, compensation carbone, certificats d'impact, DPP basique (3 catégories), suggestions de réduction, rapport mensuel, portail d'impact, paramètres complets

**Growth** — Starter + analytiques avancés, A/B testing (3 tests), DPP complet (10 catégories), conformité EU Green Claims (3 scans/mois), IA catégorisation, benchmarking secteur, Klaviyo, multi-impact (arbres + océan), ROI dashboard, rapports trimestriels

**Pro** — Growth + Scope 3 (estimation auto), conformité EU (10 scans/mois), A/B testing (10 tests), Shopify Flow (3 triggers), rapports annuels, support 12h

**Scale** — Pro + produits illimités, conformité EU illimitée, Scope 3 complet (supply chain), rapports CSRD, A/B tests illimités, Flow illimité, CSM dédié

### Billing Shopify
- Billing via **Shopify Billing API** (`appSubscriptionCreate`) — jamais Stripe
- Devise : EUR, cycle de 30 jours
- Remplacement immédiat lors d'un upgrade (`billing.server.ts`)
- Plan gating centralisé dans `gates.server.ts` + `constants.ts`
- Ne jamais dupliquer les limites de plan en dehors de `constants.ts`

---

## 🌿 MOTEUR CO₂ — RÈGLES CRITIQUES

### Fichiers clés
- `engine.server.ts` — moteur principal (matching Levenshtein sur base ADEME)
- Facteurs d'émission ADEME — 16 catégories, source de vérité immuable

### Règles absolues
- **Ne jamais modifier** un facteur ADEME sans source officielle à jour + date de mise à jour
- Les calculs doivent être **déterministes** : même input → même output, toujours
- Toujours travailler en **kgCO₂e** en interne
- Affichage : convertir en gCO₂e si < 1kg, en tCO₂e si > 1000kg — jamais d'unité mixée dans un calcul
- Tout changement dans le moteur doit avoir des tests unitaires couvrant les cas limites :
  - Produit sans catégorie
  - Poids inconnu
  - Correspondance Levenshtein ambiguë

### Grades CO₂ (A → E)
- Le système de grades est contractuel (affiché aux clients finaux)
- Ne jamais modifier les seuils de grades sans décision explicite documentée dans `tasks/decisions.md`

---

## 🛍️ SHOPIFY — RÈGLES CRITIQUES

### Architecture App Proxy
- Toutes les routes exposées au storefront passent **obligatoirement** par le proxy :
  ```
  /apps/carboniq/api/carbon-score         → Score et grade produit
  /apps/carboniq/api/carbon-score/widget  → Widget score (HTML)
  /apps/carboniq/api/offset-calculate     → Calcul compensation
  /apps/carboniq/api/offset-record        → Enregistrement offset
  /apps/carboniq/api/certificate/:code    → Certificat d'impact
  /apps/carboniq/api/impact-portal        → Portail d'impact public
  /apps/carboniq/api/dpp/:productId       → Digital Product Passport
  ```
- **Jamais** appeler directement les routes internes depuis le storefront
- CORS configuré sur tous les endpoints storefront — ne pas le retirer

### Validation des requêtes Shopify
- Toujours vérifier la signature HMAC sur les webhooks
- Toujours valider que la session est authentifiée sur les routes embedded
- Ne jamais accepter `shop` comme paramètre URL non vérifié — toujours depuis la session

### Multi-tenant — RÈGLE ABSOLUE
- **Toute donnée est scopée par `shop`** — jamais de requête cross-tenant
- Lors de `app/uninstalled` : nettoyer toutes les données du tenant (webhook actif)
- Un marchand ne voit **jamais** les données d'un autre marchand

### Injection de styles Polaris — FIX CONNU
- ⚠️ Shopify Polaris overwrite les styles CSS globaux
- Solution validée : injecter les styles via `dangerouslySetInnerHTML` dans `useEffect` avec cleanup
  ```typescript
  useEffect(() => {
    const style = document.createElement('style')
    style.innerHTML = `.carboniq-badge { ... }`
    document.head.appendChild(style)
    return () => document.head.removeChild(style)
  }, [])
  ```
- **Ne jamais** revenir à du CSS global pour les composants embedded Shopify

### Webhooks
| Event | Fichier | Statut |
|---|---|---|
| `products/create` | `webhooks.products.create.ts` | ✅ Actif |
| `products/update` | `webhooks.products.update.ts` | ✅ Actif |
| `products/delete` | `webhooks.products.delete.ts` | ✅ Actif |
| `app/uninstalled` | `webhooks.app.uninstalled.ts` | ✅ Actif |
| `app/scopes_update` | `webhooks.app.scopes_update.tsx` | ✅ Actif |
| `customers/data_request` (RGPD) | `webhooks.customers.data_request.ts` | ✅ Actif |
| `customers/redact` (RGPD) | `webhooks.customers.redact.ts` | ✅ Actif |
| `shop/redact` (RGPD) | `webhooks.shop.redact.ts` | ✅ Actif |

### GraphQL Shopify
- Toujours utiliser les types générés par codegen (jamais de types manuels pour les réponses GraphQL)
- Après modification d'une query/mutation : `npm run codegen`
- Scopes disponibles : `read_products`, `write_products`, `write_metaobject_definitions`, `write_metaobjects` — ne pas demander plus

---

## 🗄️ PRISMA — CONVENTIONS

### Migrations
- Nommer de façon descriptive : `add_carbon_score_to_products`
- Ne jamais modifier une migration déjà appliquée en prod — créer une nouvelle
- Après chaque migration : `npx prisma generate`
- Dev : SQLite / Prod : PostgreSQL — écrire des migrations compatibles avec les deux

### Sécurité Supabase — RLS obligatoire sur toute nouvelle table
- Supabase expose le schéma `public` via son API Data (PostgREST). Prisma crée
  ses tables **sans RLS**, et Supabase leur accorde automatiquement tous les droits
  aux rôles `anon` / `authenticated` → toute nouvelle table est publique par défaut.
- Toute migration qui crée une table doit se terminer par :
  ```sql
  ALTER TABLE "MaNouvelleTable" ENABLE ROW LEVEL SECURITY;
  ```
  **Aucune policy** : Carboniq n'utilise pas l'API Data, le deny-by-default est voulu.
- **Jamais** de `FORCE ROW LEVEL SECURITY` : Prisma se connecte en `postgres`,
  propriétaire des tables, et doit continuer à contourner la RLS.
- Migration de référence : `20260808000000_enable_rls_and_lock_data_api`
- Requêtes de contrôle : `prisma/sql/rls-check.sql` (à passer dans le SQL Editor)

### Client singleton
```typescript
// lib/prisma.ts — unique instance dans tout le projet
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
export const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```
- **Jamais** instancier `new PrismaClient()` ailleurs que dans `lib/prisma.ts`
- Le HMR Vite peut créer des connexions multiples — le pattern `globalThis` est obligatoire

### Patterns
```typescript
// ✅ Toujours gérer l'erreur
const score = await prisma.carbonScore.findUnique({ where: { productId: id } })
if (!score) return null

// ✅ Transactions pour opérations multi-tables
await prisma.$transaction([
  prisma.carbonScore.create({...}),
  prisma.shop.update({...})
])

// ❌ Jamais de SQL raw sans validation d'input
```

---

## 🎨 DESIGN SYSTEM — CARBONIQ

### Identité visuelle
- **Références** : Arc Browser (fluidité), Linear (densité), Notion (lisibilité)
- **Règle** : sobre > flashy — la crédibilité environnementale = design calme

### Typographie
- **Display / chiffres CO₂** : `Instrument Serif`
- **UI / labels / navigation** : `DM Sans`
- **Valeurs numériques CO₂** : `DM Mono` — **toujours**, sans exception
- Une valeur carbone sans `DM Mono` est une erreur de design

### Palette (warm stone / moss)
- **Accent principal** : vert mousse `#4A7C59`
- **Background clair** : stone `#F5F0EB`
- **Background sombre** : `#2C2825`
- ❌ Pas de violet, bleu vif, rouge (sauf alertes)

### Badge CO₂ — 4 styles
| Style | Disponibilité |
|---|---|
| Pill | Free + tous les plans |
| Leaf | Starter+ |
| Minimal | Starter+ |
| Detailed | Starter+ |

- Le badge est le cœur du produit — chaque pixel compte
- Tester sur fond clair ET fond sombre avant tout déploiement
- Taille minimale : 120px de large
- Toujours afficher l'unité (gCO₂e / kgCO₂e / tCO₂e) — jamais de valeur nue

---

## 📁 STRUCTURE DES FICHIERS CLÉS

```
app/
├── routes/
│   ├── app._index.tsx           → Dashboard principal
│   ├── app.settings.tsx         → Paramètres badge, offset, locale
│   ├── app.pricing.tsx          → Page pricing + billing
│   ├── app.analytics.tsx        → Analytiques avancés
│   ├── app.abtest.tsx           → A/B Testing
│   ├── app.benchmark.tsx        → Benchmarking secteur
│   ├── app.compliance.tsx       → Conformité EU Green Claims
│   ├── app.dpp.tsx              → Digital Product Passport (partiel)
│   ├── app.impact.tsx           → Page impact marchand
│   ├── app.reduction.tsx        → Suggestions de réduction
│   ├── app.reports.tsx          → Rapports RSE
│   ├── app.roi.tsx              → ROI Dashboard (partiel)
│   ├── app.scope3.tsx           → Scope 3 (partiel)
│   ├── api.carbon-score.ts      → Score public (CORS) ✅
│   ├── api.carbon-score.widget.ts → Widget HTML ✅
│   ├── api.offset-calculate.ts  → Calcul compensation ✅
│   ├── api.offset-record.ts     → Enregistrement offset ✅
│   ├── api.certificate.$code.ts → Certificat d'impact ✅
│   ├── api.impact-portal.ts     → Portail impact public ✅
│   └── api.dpp.$productId.ts   → DPP public (partiel)
├── lib/
│   ├── engine.server.ts         → Moteur CO₂ (Levenshtein + ADEME)
│   ├── billing.server.ts        → Shopify Billing API
│   ├── gates.server.ts          → Plan gating
│   ├── certificate.server.ts    → Génération certificats
│   ├── impact.server.ts         → Multi-impact (arbres + océan)
│   ├── abtest.server.ts         → A/B Testing (z-score)
│   ├── benchmark.server.ts      → Benchmarking secteur
│   ├── generator.server.ts      → DPP generator
│   ├── scanner.server.ts        → EU Green Claims scanner
│   ├── scope3.server.ts         → Scope 3
│   └── constants.ts             → Plans, prix, limites — SOURCE DE VÉRITÉ
extensions/
└── carbon-badge/
    └── blocks/
        ├── carbon_badge.liquid  → Badge storefront (4 styles) ✅
        └── thank_you.liquid     → Page remerciement (partiel)
tasks/
├── todo.md                      → Plan session en cours
├── lessons.md                   → Leçons cumulées
└── decisions.md                 → Décisions architecturales
```

---

---

## 🚫 ANTIPATTERNS INTERDITS

- ❌ Facteur ADEME modifié sans source officielle + date
- ❌ Calcul CO₂ avec unités mixées (toujours kgCO₂e en interne)
- ❌ Route publique sans validation HMAC Shopify
- ❌ CSS global qui entre en conflit avec Polaris (utiliser le pattern `useEffect` + cleanup)
- ❌ `new PrismaClient()` en dehors de `lib/prisma.ts`
- ❌ Migration modifiée après application en prod
- ❌ Table créée sans `ENABLE ROW LEVEL SECURITY` (elle serait publique via l'API Supabase)
- ❌ `FORCE ROW LEVEL SECURITY` sur une table Prisma (casse tous les accès de l'app)
- ❌ Données cross-tenant (scopage `shop` obligatoire partout)
- ❌ Valeur CO₂ affichée sans unité (gCO₂e / kgCO₂e / tCO₂e)
- ❌ Valeur numérique CO₂ sans police `DM Mono`
- ❌ Badge non testé sur fond clair ET fond sombre
- ❌ Limites de plan définies en dehors de `constants.ts`
- ❌ Billing via Stripe (Carboniq utilise exclusivement la Shopify Billing API)
- ❌ Types GraphQL Shopify écrits à la main (toujours passer par codegen)
- ❌ `shop` accepté comme paramètre URL non vérifié
- ❌ Badge style Leaf/Minimal/Detailed accessible au plan Free

---

## ✅ CHECKLIST AVANT PR

- [ ] `npx prisma generate` fait si schema modifié
- [ ] Toute nouvelle table a `ENABLE ROW LEVEL SECURITY` dans sa migration
- [ ] `npm run typecheck` → 0 erreur
- [ ] `npm run lint` → 0 warning
- [ ] `npm run build` → succès
- [ ] `npm run codegen` fait si query/mutation GraphQL modifiée
- [ ] Tests moteur CO₂ passent si `engine.server.ts` modifié
- [ ] Badge testé fond clair ET fond sombre
- [ ] Validation HMAC sur toutes les nouvelles routes publiques
- [ ] Aucune donnée cross-tenant possible
- [ ] Plan gating vérifié pour toute nouvelle feature payante
- [ ] `constants.ts` = seule source de vérité pour les limites de plan

---

## 🆘 EN CAS DE DOUTE

- **Limites de plan** → lire `constants.ts` uniquement, jamais deviner
- **Billing** → Shopify Billing API uniquement, jamais Stripe
- **Données cross-tenant** → refuser, toujours scoper par `shop`
- **Facteurs ADEME** → immuables sans source officielle
- **CSS Polaris** → pattern `useEffect` + cleanup, jamais CSS global
- **Types GraphQL** → codegen, jamais manuels

---

*Ce fichier est vivant. Après chaque correction ou décision importante → mettre à jour `tasks/lessons.md` et ce fichier.
Objectif : chaque session Claude est meilleure que la précédente.*
