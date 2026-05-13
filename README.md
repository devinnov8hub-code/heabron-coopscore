# Heabron CoopScore

Cooperative credit scoring platform for Nigerian agriculture.

This monorepo contains two deployable applications:

```
heabron-coopscore/
├── backend/          Node.js + Express REST API (deploy to Vercel)
└── frontend/         React + Vite admin + partner portal (deploy to Vercel)
```

The **mobile field-agent app** is built by a separate developer and consumes the backend's `/api/auth/*` and `/api/agent/*` endpoints. Swagger docs at `<api>/api/docs` are the source of truth for that integration.

---

## Stack

| Layer | Tech |
|---|---|
| Backend runtime | Node.js 18+ (CommonJS) |
| Web framework | Express |
| Database | Supabase Postgres + Supabase Auth |
| Email | Resend |
| NIN verification | NINAuth (NIMC official, free) — falls back to dev stub |
| Frontend | React 18 + Vite + Tailwind + React Query |
| Hosting | Vercel (backend + frontend) |

---

## Quick start (local)

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env             # fill in Supabase / Resend / JWT secret
# Apply migrations/000_initial_schema.sql to your Supabase project
npm run dev                      # http://localhost:4000
```

Open Swagger docs: <http://localhost:4000/api/docs>

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env             # adjust VITE_API_URL if your API isn't on :4000
npm run dev                      # http://localhost:5173
```

The Vite dev server proxies `/api` → `http://localhost:4000`, so you can leave `VITE_API_URL` blank during development.

---

## Roles & access

| Role | What they see |
|---|---|
| `super_admin`, `ops_admin`, `finance_admin` | Admin portal at `/admin/*` |
| `partner_admin`, `partner_analyst` | Partner portal at `/partner/*` |
| `field_agent` | Mobile app only (no web access) |

The admin portal is where you:
- Review and approve field-agent KYC applications
- Create partner (lender/investor) organizations — the system auto-generates a strong password and emails the partner with sign-in instructions
- Review financing requests and either approve in-house, forward them to a specific partner, or reject them
- Monitor credit scores, manage benchmarks, and approve agent wallet settlements

The partner portal lets lenders:
- Search any cooperative or farmer in the network and pull a full credit report
- Receive financing requests forwarded by Heabron Admin and approve/reject them
- Monitor their financed portfolio with tier and geographic distribution
- Track high-risk borrowers on a watchlist

---

## Deploying to Vercel

Both apps deploy independently — link each folder as a separate Vercel project. The `backend/vercel.json` routes every request to `src/server.js`; the `frontend/vercel.json` rewrites all routes to `index.html` so React Router can handle them.

After both are deployed:
1. Set `ALLOWED_ORIGINS` on the backend to the frontend's URL (comma-separated for multiple).
2. Set `VITE_API_URL` on the frontend to the backend's URL (including `/api`).
3. Set `PUBLIC_APP_URL` on the backend to the frontend's URL — used in outgoing emails.

---

## Key design decisions

- **Single consolidated migration** (`backend/migrations/000_initial_schema.sql`) replaces the 40+ migrations from the earlier Lovable codebase. Run it once on a fresh Supabase project.
- **Service-role Supabase client** — the backend uses Supabase's service-role key and applies all authorization itself. Row-level security policies are also defined for defense in depth.
- **NINAuth over Prembly** — the NIMC NINAuth API is free; commercial aggregators charge per-lookup fees. `NIN_DEV_MODE=true` lets you exercise the entire signup flow before credentials are issued by NIMC.
- **Standard response envelope** everywhere — every endpoint returns `{ success: true, data, meta? }` or `{ success: false, error: { code, message, details? } }`.
- **Auto-generated partner passwords** — admin creates a partner via `POST /api/admin/partners`, a memorable strong password is generated server-side and emailed; the partner is forced to change it on first login.
- **Credit scoring exactly per spec** — `backend/src/services/credit-score/index.js` implements the Heabron Credit Score System formula precisely, including the first-cycle Tier C cap and the `context_flag` mechanism that protects farmers from timeliness penalties caused by weather/market/health shocks.

---

## What's where

```
backend/
  migrations/000_initial_schema.sql       single SQL file to run on Supabase
  docs/swagger/                           OpenAPI spec (root + schemas/ + paths/)
  src/
    config/                               env, Supabase client, Swagger loader
    controllers/                          one file per resource
    routes/                               agent / admin / partner / auth
    middleware/                           auth, validation, rate limit, error handler
    services/
      credit-score/                       scoring engine (per PDF spec)
      nin/                                NINAuth wrapper + dev-mode stub
      email/                              Resend client + 16 branded templates
      storage/                            Supabase Storage uploads
    templates/email/                      HTML email base + all template factories
    utils/                                response envelope, JWT, crypto, logger
    validators/                           Joi schemas
    server.js                             Express app (entry for Vercel + local)
  package.json, vercel.json, .env.example, README.md

frontend/
  src/
    App.jsx                               router + role guards
    main.jsx                              entry
    components/
      layout/AppShell.jsx                 admin/partner shell with sidebar
      ui/                                 Button, Card, Input, Modal, DataTable, …
      shared/NotificationBell.jsx
    lib/
      api.js                              axios + JWT refresh
      auth.js                             zustand store
      brand.js                            brand tokens + nav definitions
      utils.js                            formatters
    pages/
      auth/                               Login, Forgot, Change Password
      admin/                              Dashboard, Agents, Applications,
                                          Cooperatives, Farmers, Credit,
                                          Financing, Partners, Benchmarks,
                                          Wallets, Activity, + detail pages
      partner/                            Dashboard, Search, Financing,
                                          Portfolio, Watchlist, Credit Report
      shared/                             Settings, Notifications
    index.css                             Tailwind base + component layer
  index.html, tailwind.config.js, vite.config.js, postcss.config.js,
  package.json, vercel.json, .env.example, .gitignore
```
