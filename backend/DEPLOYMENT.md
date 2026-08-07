# InvoicePilot AI — Backend Deployment Guide

Deploys to a **persistent host** (Railway / Render / Fly). This backend uses BullMQ
workers and Playwright PDF generation, both of which need a long-lived process and a
writable filesystem — **not** Vercel serverless.

Two processes must run: the **API** and the **worker**.

---

## Prerequisites (accounts)

| Service | Purpose | Where to get credentials |
|---|---|---|
| MongoDB Atlas | Database | https://cloud.mongodb.com → create cluster → Database Access user + Network Access allowlist |
| Redis | BullMQ queues + cache + rate limiting | Hosted (Upstash / Railway Redis) or a VPS Redis. Needed for email/reminders, caches, and rate limits |
| Clerk | Auth | https://dashboard.clerk.com → create app → API Keys |
| Resend | Email | https://resend.com → API keys + verify a sending domain |
| Stripe | Billing | https://dashboard.stripe.com → API keys, Products with Price IDs, webhook endpoints |
| Groq | AI invoice generation | https://console.groq.com → API keys (optional; AI routes return 503 without it) |

---

## Environment checklist

Copy `.env.example` and fill every value used by your features. **Never commit
`.env`.**

| Variable | Required? | Notes |
|---|---|---|
| `NODE_ENV` | always | `production` in prod. Enables leak-proof error responses and refuses `CORS_ORIGIN=*` |
| `PORT` | no | default `3000`; set the platform's assigned port |
| `API_PREFIX` | no | default `/api/v1` |
| `CORS_ORIGIN` | yes | Comma-separated allow-list of your frontend origins, e.g. `https://app.yourdomain.com,https://admin.yourdomain.com`. Never `*` |
| `MONGO_URI` | yes | Atlas SRV string with credentials + `?retryWrites=true&w=majority` |
| `CLERK_SECRET_KEY` | yes | Clerk Dashboard → API Keys. Server-side only |
| `CLERK_WEBHOOK_SECRET` | if webhooks | Clerk → Webhooks → signing secret |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | yes | Queue + cache + rate limiting |
| `BODY_SIZE_LIMIT` | no | default `1mb` |
| `SLOW_REQUEST_MS` / `SLOW_QUERY_MS` | no | defaults `1000` ms |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PUBLISHABLE_KEY` | for billing | Stripe keys; webhook secret from the Stripe endpoint |
| `RESEND_API_KEY` / `EMAIL_FROM` | for email | `EMAIL_FROM` must be on a Resend-verified domain |
| `GROQ_API_KEY` | for AI | Groq console |
| `MAX_FILE_SIZE_MB` | no | reserved for a future logo upload |

> Paid Stripe plans also need their `stripePriceId` filled into
> `src/modules/billing/plans.registry.ts` before seeding.

---

## Database & Redis setup

1. **MongoDB Atlas**
   - Create a cluster (M0 free tier is fine to start).
   - Add a Database Access user; copy its credentials into `MONGO_URI`.
   - Network Access → add the deployment platform's egress IP range (or `0.0.0.0/0`
     in dev only).
2. **Redis** — provision an instance. In Railway, `redis` plugins expose
   `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD` directly.
3. Plans are seeded automatically at boot from `plans.registry.ts`
   (`seedPlans()`), so no manual DB seeding is required in production. `npm run
   db:seed` is dev-only and refuses to run in production.

---

## Build & run

```bash
npm ci
npm run build
npx playwright install chromium --with-deps   # required for PDF generation
```

### API process

```bash
node dist/app.js        # or npm start
```

### Worker process (separate!)

```bash
node dist/jobs/worker.js   # or npm run worker:prod
```

Run both in production. The worker owns BullMQ job processing (email delivery,
Playwright PDF render, the daily reminder sweep) and the cron scheduler. A crash
in a job never takes down the API, and the two scale independently.

---

## Webhooks

Expose the following endpoints to the internet (they are NOT rate limited and
verify provider signatures on the raw body):

| Provider | Endpoint | Setup |
|---|---|---|
| Clerk | `POST /webhooks/clerk` | Clerk → Webhooks → add endpoint → signing secret → `CLERK_WEBHOOK_SECRET`. Handles `user.created`, `user.updated`, `user.deleted` |
| Stripe | `POST /webhooks/stripe` | Stripe Dashboard → Developers → Webhooks → endpoint → signing secret → `STRIPE_WEBHOOK_SECRET`. Events: `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.payment_failed`, `payment_intent.payment_failed` |

For local testing, forward your dev server with `stripe listen --forward-to
localhost:5000/webhooks/stripe` and Clerk's webhook testing tool.

---

## Health checks

| Route | Purpose |
|---|---|
| `GET /health` | Liveness/readiness. Returns `{ status: "healthy" }` when the process is up and Mongo is reachable. Point your platform's health check here with a generous interval (rate limited). |
| `GET /` | Root info banner |

---

## Playwright in production

- `npx playwright install chromium` must run as a build/postinstall step on the
  host, and the install must land on the image that runs both processes.
- The browser is launched lazily on first render and closed on graceful shutdown.
- On memory-constrained hosts, keep the render concurrency at its default of 3.

---

## Logging & ops

- Pino JSON logs to stdout (`LOG_LEVEL`). Secrets are redacted automatically
  (`authorization`, cookies, tokens, API keys).
- Every request's logs carry a `requestId`; worker job logs carry a `jobId`.
- Slow requests (> `SLOW_REQUEST_MS`) and slow Mongo commands (>
  `SLOW_QUERY_MS`) are logged at `warn`.
- The process exits on `uncaughtException` / `unhandledRejection` after logging —
  configure your platform to auto-restart.

---

## Production configuration guardrails

- **`CORS_ORIGIN`** must be an explicit list. The server **refuses to boot** with
  `*` in production because credentials are enabled.
- **Rate limits** are Redis-backed and survive restarts: 300 req/15 min per IP
  across the API, plus per-user tiers (strict 100/5 min on writes/AI/auth; generous
  500/15 min on reads). They fail open if Redis is down — never take the API down.

---

## First-time smoke test

1. `curl http://<host>/health` → `{"status":"healthy"}`.
2. Hit an authenticated route with a real Clerk session token → 200, not 401/500.
3. Create an invoice, then `GET /api/v1/invoices/:id/pdf` → downloads a PDF.
4. Check the Stripe dashboard receives the `/webhooks/stripe` ping; check Clerk's
   webhook deliveries show 200 for `/webhooks/clerk`.
