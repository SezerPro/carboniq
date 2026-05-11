# Carboniq

> Carbon footprint scoring and offset for Shopify merchants.

Carboniq is an embedded Shopify app that calculates the CO₂ impact of every
product in a store, displays a carbon badge on the storefront, and lets
customers compensate their order's emissions at checkout with a verifiable
impact certificate.

Built for merchants preparing for the EU Green Claims Directive (2027) and for
those who want to differentiate on environmental transparency.

---

## What it does

- **Automated CO₂ scoring** — every product gets a carbon score (kgCO₂e) and a
  letter grade (A → D) based on the ADEME emission factor database
  (16 categories, government-maintained).
- **Storefront badge** — 4 visual styles (Pill, Leaf, Minimal, Detailed)
  injected via Liquid theme extension.
- **Carbon offset at checkout** — customers opt-in to compensate their order's
  footprint. Records a verifiable impact certificate with a unique code.
- **Impact portal** — public page showing the merchant's cumulative carbon
  offset (trees planted, ocean kg cleaned).
- **EU compliance suite** — Green Claims scanner, Digital Product Passport
  (DPP), Scope 3 estimation, CSRD-ready RSE reports.
- **A/B testing & analytics** — measure conversion uplift from showing the
  carbon badge.
- **Klaviyo integration** — sync eco-conscious customers to merchant's own
  Klaviyo account (opt-in by merchant).

---

## Tech stack

| Layer        | Tech                                                    |
| ------------ | ------------------------------------------------------- |
| Framework    | React Router v7 (framework mode, SSR)                   |
| UI           | Shopify Polaris + App Bridge React v4                   |
| Backend      | Node.js 20+, `@shopify/shopify-api` v12, GraphQL        |
| Database     | PostgreSQL (prod) / SQLite (dev), Prisma 6 ORM          |
| Hosting      | Vercel (EU region)                                      |
| Extensions   | Liquid theme extension (`carbon-badge`)                 |
| Build        | Vite 6, TypeScript 5.9                                  |

---

## Local development

Prerequisites: Node.js ≥ 20.19, [Shopify CLI](https://shopify.dev/docs/apps/tools/cli).

```bash
npm install
npx prisma generate
npm run dev
```

Press `P` to open the tunneled app URL. The Shopify CLI will create a
development store install for you.

### Useful commands

```bash
npm run typecheck    # TypeScript strict check
npm run lint         # ESLint
npm run build        # Production build
npm test             # Unit tests (Vitest)
npm run codegen      # Regenerate Shopify GraphQL types
```

### Environment

Copy `.env.example` to `.env` and fill in:

- `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` — from your Partner Dashboard
- `SHOPIFY_APP_URL` — your tunneled or deployed app URL
- `SCOPES` — `read_products,write_products,write_metaobject_definitions,write_metaobjects`
- `DATABASE_URL` — PostgreSQL connection string (with `?pgbouncer=true&connection_limit=1` for serverless)
- `CRON_SECRET` — random string for cron endpoint auth

---

## Architecture

```
app/
├── routes/                   # React Router routes (admin pages + API + webhooks)
│   ├── app.*.tsx             # Embedded merchant pages
│   ├── api.*.ts              # Public storefront API (CORS, HMAC-signed)
│   └── webhooks.*.ts         # Shopify webhook handlers (incl. GDPR)
├── lib/
│   ├── carbon/engine.server.ts    # CO₂ calculation engine (ADEME + Levenshtein)
│   ├── plans/                     # Billing (Shopify Billing API) + plan gating
│   ├── certificate/               # Impact certificate generation
│   ├── offset/                    # Carbon compensation flow
│   ├── compliance/                # EU Green Claims scanner
│   ├── dpp/                       # Digital Product Passport
│   └── security/                  # HMAC verification, audit logger, rate limiting
extensions/
└── carbon-badge/             # Liquid theme extension (4 badge styles)
prisma/
└── schema.prisma             # Multi-tenant data model (scoped by shop)
```

All merchant data is strictly scoped by `shop` — no cross-tenant access is
possible. GDPR webhooks (`customers/data_request`, `customers/redact`,
`shop/redact`) are implemented and audit-logged.

---

## Status

Pre-launch. Currently in Shopify App Store review (submission #109128,
limited visibility).

---

## License

Proprietary. © Dogan Sezer. All rights reserved.
