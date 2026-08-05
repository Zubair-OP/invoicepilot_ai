# InvoicePilot AI — Backend

AI-powered invoice management and payment reminder platform.

**Status:** Phases 1–8 complete. Phases 9–10 pending — see [PHASES.md](./PHASES.md).

---

## Tech Stack

| Concern | Choice |
|---|---|
| Runtime | Node.js 22 + TypeScript (ESM, `NodeNext`) |
| Framework | Express 4 |
| Database | MongoDB Atlas + Mongoose 8 |
| Auth | Clerk (`@clerk/backend`) |
| Validation | Zod |
| Queues / Cache | BullMQ + Redis (ioredis) |
| AI | Groq SDK |
| Email | Resend |
| Billing | Stripe |
| Logging | Pino |
| Tests | Vitest |

**Deployment target:** a persistent host (Railway / Render / Fly) — **not** Vercel serverless.
BullMQ workers and Playwright PDF generation both need a long-lived process and a
writable filesystem, neither of which serverless provides.

---

## Getting Started

```bash
npm install
npx playwright install chromium   # required for PDF generation (Phase 5)
cp .env.example .env      # then fill in real values
npm run db:seed           # optional: demo tenant + sample invoice
npm run dev               # http://localhost:5000
```

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server with hot reload (tsx watch) |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run compiled output |
| `npm run typecheck` | `tsc --noEmit` — must pass before any commit |
| `npm test` | Vitest watch mode |
| `npm run test:run` | Vitest single run |
| `npm run db:seed` | Reset + seed dev database (refuses to run in production) |

### Required environment

Only `MONGO_URI` and `CLERK_SECRET_KEY` are required to boot. Everything else has a
default or is feature-gated. See `.env.example` for the annotated list.

`CLERK_PUBLISHABLE_KEY` is **not** needed by the backend — it is a frontend
credential that becomes `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` in the Next.js app.

---

## Architecture

```
src/
├── app.ts                  # Express bootstrap, middleware order, graceful shutdown
├── config/env.ts           # Zod-validated environment — process exits on invalid config
├── common/
│   ├── errors/             # AppError hierarchy (NotFound, Validation, Unauthorized, …)
│   ├── middlewares/        # authenticate, authorize, validate, errorHandler, requestId
│   ├── types/              # Shared interfaces + Express Request augmentation
│   ├── utils/              # pagination, mongo error helpers
│   └── response.ts         # Uniform success/error/paginated envelopes
├── database/
│   ├── client.ts           # Connection lifecycle
│   ├── models/             # Mongoose schemas + indexes
│   ├── transaction.ts      # executeTransaction() helper
│   └── seed.ts             # Dev seed
├── integrations/           # Third-party clients (clerk, ai, email, stripe)
├── modules/                # Feature modules — routes → controller → service
├── jobs/                   # BullMQ queues
├── observability/          # Pino logger
└── health/                 # Liveness/readiness probe
```

### Layering rule

```
routes → controller → service → model
```

- **Routes** wire URL + middleware. No logic.
- **Controllers** unwrap the request, call one service, shape the response. No business rules, no direct DB access.
- **Services** own business logic and all database access. Never touch `req`/`res`.
- **Models** are schema + indexes only.

There is deliberately **no repository layer** — Mongoose models already are the
data-access abstraction, and wrapping them adds files without adding capability at
this size.

---

## Conventions

**Imports use `.js` extensions.** The project is ESM with `moduleResolution: NodeNext`,
so `./foo.js` is correct even though the source file is `foo.ts`.

**Errors are thrown, never returned.** Services throw `AppError` subclasses; the
central `errorHandler` converts them to HTTP responses. Controllers only
`try/catch` to forward to `next(error)`.

**Every response uses the standard envelope:**

```jsonc
// success
{ "success": true, "message": "Success", "data": { } }
// paginated — same shape plus meta
{ "success": true, "message": "Success", "data": [], "meta": { "page": 1, "limit": 20, "total": 0, "totalPages": 0, "hasNext": false, "hasPrev": false } }
// error
{ "success": false, "message": "Invoice not found", "code": "NOT_FOUND" }
```

**No `any`.** Use `unknown` plus narrowing. Existing helpers: `isDuplicateKeyError()`
in `common/utils/mongo.ts`.

**All request bodies are validated with Zod** via the `validate(schema)` middleware
before reaching a controller.

---

## Security Model

### Two independent layers — both are required

**1. Authentication + coarse authorization** (`common/middlewares/auth.ts`)

`authenticate` verifies the Clerk session token, resolves the Clerk ID to a local
Mongo user, and attaches:

```ts
req.user = { userId, clerkId, role }  // userId is the Mongo ObjectId string
```

Users are provisioned just-in-time on first authenticated request, so the API works
before Clerk webhooks exist. The insert is guarded against the E11000 race where two
concurrent first-requests both try to create the same user.

`authorize("ADMIN")` gates a route by role. It answers *"may this role use this
endpoint"* — nothing more.

**2. Tenant isolation** (every service)

`authorize` does **not** check record ownership. Every query touching tenant data
must be scoped:

```ts
// correct — ownership enforced in the query
const invoice = await Invoice.findOne({ _id: invoiceId, userId });
if (!invoice) throw new NotFoundError("Invoice");

// WRONG — returns another tenant's invoice
const invoice = await Invoice.findById(invoiceId);
```

This is the single most important rule in the codebase. A missing `userId` filter is
a cross-tenant data leak, and no role check will catch it.

### Role escalation

`role` lives in Mongo and is authoritative. Clerk `publicMetadata.role` only seeds it
at creation. `updateUserSchema` deliberately omits `role` and `email` so a user cannot
promote themselves via `PATCH /users/me`.

---

## Data Model

### Invoice numbering — per tenant, not global

Format `INV-YYYYMM-NNNN`, unique per `{ userId, invoiceNumber }`.

Each tenant runs its own sequence, so two businesses can both hold `INV-202608-0001`.
Numbers come from an atomic `Counter` document (`findOneAndUpdate` + `$inc`), which is
race-safe — verified by a 25-way concurrency test in
`modules/invoices/invoices.numbering.test.ts`.

> A global unique index would let the first user to claim a number lock every other
> user out of it. Do not add one.

### Tax — generic components

An invoice carries `taxComponents: [{ name, rate, amount }]` rather than a single rate:

```jsonc
// India, intra-state          // India, inter-state       // EU
[{ "name": "CGST", "rate": 9 },  [{ "name": "IGST",         [{ "name": "VAT",
 { "name": "SGST", "rate": 9 }]    "rate": 18 }]              "rate": 20 }]
```

Same schema covers GST, VAT, and sales tax. `tax` is the sum of component amounts.

### Invoice immutability

Once `SENT` or `PAID`, an invoice is a legal document: line items, tax, and discount
are frozen. Only `notes` and status transitions are permitted. `PAID` invoices cannot
be deleted. Corrections belong in a credit note, not an edit.

### Status transitions

```
DRAFT ──markAsSent──> SENT ──markAsPaid──> PAID
  │                     │
  └──────> CANCELLED    └──(overdue sweep)──> OVERDUE ──> PAID
```

---

## Current API

All routes require `Authorization: Bearer <clerk_session_token>`.

| Method | Route | Notes |
|---|---|---|
| `GET` | `/health` | Public liveness probe |
| `GET` | `/api/v1/users/me` | Current profile |
| `PATCH` | `/api/v1/users/me` | Update name / company / avatar |
| `GET` | `/api/v1/settings` | Current tenant's invoice defaults + appearance |
| `PATCH` | `/api/v1/settings` | Update business defaults, prefix, template |
| `GET` | `/api/v1/templates` | List available invoice templates |
| `GET` | `/api/v1/admin/users` | ADMIN only. Paginated, `?search=`, `?role=` |
| `GET` | `/api/v1/admin/users/:id` | ADMIN only. User plus invoice/customer counts |
| `PATCH` | `/api/v1/admin/users/:id/role` | ADMIN only. Promote/demote with audit log |
| `GET` | `/api/v1/customers` | Paginated, `?search=` |
| `POST` | `/api/v1/customers` | |
| `GET` | `/api/v1/customers/:id` | Includes 5 most recent invoices |
| `PATCH` | `/api/v1/customers/:id` | |
| `DELETE` | `/api/v1/customers/:id` | |
| `GET` | `/api/v1/invoices` | Paginated, `?status=`, `?search=` |
| `POST` | `/api/v1/invoices` | Auto-assigns invoice number |
| `GET` | `/api/v1/invoices/:id` | |
| `PATCH` | `/api/v1/invoices/:id` | Blocked on SENT/PAID line items |
| `DELETE` | `/api/v1/invoices/:id` | Blocked on PAID |
| `PATCH` | `/api/v1/invoices/:id/send` | DRAFT → SENT |
| `PATCH` | `/api/v1/invoices/:id/pay` | → PAID |
| `GET` | `/api/v1/invoices/:id/pdf` | Download PDF (`Content-Disposition: attachment`) |
| `GET` | `/api/v1/invoices/:id/preview` | Rendered HTML (print / debugging) |
| `POST` | `/api/v1/invoices/:id/send-email` | Queue invoice for email delivery (Phase 6) |
| `POST` | `/api/v1/invoices/:id/remind` | Queue an ad-hoc reminder, rate limited per invoice (Phase 7) |
| `POST` | `/api/v1/ai/generate-invoice` | Prompt → validated draft invoice data |
| `POST` | `/api/v1/ai/chat` | Multi-turn refinement |
| `GET` | `/api/v1/billing/plans` | Public plan catalogue (no auth) |
| `GET` | `/api/v1/billing/subscription` | Current plan + period usage/limits |
| `POST` | `/api/v1/billing/checkout` | Stripe Checkout session for a plan (`{ planKey }`) |
| `POST` | `/api/v1/billing/portal` | Stripe Billing Portal link |
| `POST` | `/webhooks/clerk` | Raw body, Svix signature-verified |
| `POST` | `/webhooks/stripe` | Raw body, signature-verified |

### Clerk user sync

`POST /webhooks/clerk` handles `user.created`, `user.updated`, and `user.deleted`.
The route verifies the Svix signature with `CLERK_WEBHOOK_SECRET` before parsing the
payload and stores handled Svix event IDs in Redis for replay protection. Create/update
events refresh local email, name, and avatar only; `role` is never accepted from webhook
metadata. Delete events soft-delete the user with `deletedAt` so invoice/customer records
remain retained.

Authenticated requests cache the resolved `{ userId, clerkId, role }` in Redis for five
minutes. Cache entries are invalidated on profile updates, Clerk webhooks, and admin role
changes. Mongo remains authoritative if Redis is unavailable.

### ActivityLog

Administrative role changes write an `ActivityLog` row:

```jsonc
{
  "userId": "ObjectId of actor",
  "action": "USER_ROLE_CHANGED",
  "targetType": "User",
  "targetId": "ObjectId of target",
  "metadata": { "previousRole": "USER", "newRole": "ADMIN" },
  "ipAddress": "127.0.0.1",
  "createdAt": "2026-08-03T00:00:00.000Z"
}
```

Activity logging is best-effort: failures are logged to Pino and never fail the request.

### Settings & templates

Each user carries a `settings` subdocument (populated by schema defaults) holding
business defaults and invoice appearance:

```jsonc
{
  "businessName": "InvoicePilot Demo",
  "businessAddress": "…",
  "taxId": "…",                 // GSTIN / VAT number
  "logoUrl": "…",
  "defaultCurrency": "USD",
  "defaultPaymentTermsDays": 30,
  "defaultTaxComponents": [{ "name": "VAT", "rate": 20 }],
  "invoicePrefix": "INV",
  "templateId": "classic"
}
```

`GET /api/v1/settings` returns it; `PATCH /api/v1/settings` updates individual
fields (the request is `strict` — unknown keys are rejected). `role`/`email` are not
part of settings and cannot be changed here.

Templates ship with the code as a server-side constant
(`modules/templates/templates.registry.ts`), not a DB collection — `classic`,
`modern`, `minimal`. `GET /api/v1/templates` lists them, and `templateId` is validated
against the registry on write (unknown id → 422). Phase 5 renders each to PDF.

**Invoice creation inherits settings.** When `POST /invoices` omits `currency`,
`taxComponents`, or `dueDate`, the service falls back to the user's
`defaultCurrency`, `defaultTaxComponents`, and `defaultPaymentTermsDays`
respectively. Explicit request values always win (an explicit `taxComponents: []`
means "no tax", not "inherit"). `generateInvoiceNumber()` takes the tenant's
`invoicePrefix`; the counter key is prefix-independent, so changing the prefix
renames new invoices without resetting the sequence.

### AI invoice generation

`POST /api/v1/ai/generate-invoice` turns a plain-language description into a
validated **draft** — it is not persisted. The client reviews it and then calls
`POST /invoices` normally, keeping AI out of the write path so a bad generation
costs nothing. `POST /api/v1/ai/chat` supports multi-turn refinement.

Guard rails:

- **Structured output.** Groq JSON mode returns parseable JSON; every response is
  still parsed through a Zod schema (`ai.validation.ts`). On validation failure the
  service retries once with the error appended to the prompt, then fails with a 422
  — never returns unvalidated model output.
- **The model never determines money.** It proposes only tax `name`/`rate`; the
  invoice service recomputes every `amount`, `subtotal`, and `total` server-side.
- **Customer resolution.** The customer name is fuzzy-matched (case-insensitive,
  scoped by `userId`) against existing customers. Returns a matched `customerId` or
  a `suggestedCustomer` for the client to confirm — it never auto-creates a customer.
- **Rate limit** 10 requests/hour/user, Redis-backed and keyed by `userId` (not IP).
  Returns 429 when exceeded. Prompt capped at 2000 chars; Groq call has a 30s timeout.
- The prompt is **untrusted** — it never influences auth, tenancy, or pricing.
- Returns **503** when `GROQ_API_KEY` is unset, rather than crashing.

### PDF generation

`GET /api/v1/invoices/:id/pdf` streams a PDF (`Content-Disposition: attachment`);
`GET /api/v1/invoices/:id/preview` returns the rendered HTML. Both enforce
ownership via `{ _id, userId }`, so requesting another tenant's invoice returns 404.

- **HTML → Playwright → PDF.** Templates are functions returning HTML strings
  (`modules/pdf/templates/`), one per Phase 3 registry entry (`classic`, `modern`,
  `minimal`), chosen from the user's `settings.templateId`.
- **One shared browser** launched lazily on first render and closed in the SIGTERM
  handler — not relaunched per request.
- **Every interpolated value is escaped** (customer names, notes, business names are
  user-controlled). No network fetches during render (`setContent` + inline CSS).
- **Generated on demand, never stored** — regeneration is cheap and always current.
- Concurrency capped at 3 simultaneous renders (Playwright is memory-heavy); further
  requests queue. 15s render timeout.

> **Deployment:** requires `npx playwright install chromium` (documented postinstall
> step). The persistent-host requirement in the tech-stack table exists partly for this.

### Email delivery

`POST /api/v1/invoices/:id/send-email` sends the invoice (with its PDF attached)
to the customer. Body is optional — `{ to?, subject?, message? }` — and defaults
the recipient to the customer's email. Ownership is enforced via `{ _id, userId }`,
so another tenant's invoice returns 404.

- **Asynchronous, via BullMQ.** The route validates ownership, resolves the
  recipient, enqueues an `email` job, and returns **202 Accepted** immediately.
  The PDF render + provider call happen in a worker, so a slow render never blocks
  the request. Enqueuing an invoice with no resolvable recipient returns **422**.
- **Retry with backoff.** Jobs retry 3× with exponential backoff (5s base), so a
  transient Resend blip or cold Playwright render recovers without operator action.
- **Idempotent sends.** The job id is derived from `invoice + type + recipient`.
  A rapid double-submit is de-duplicated while the job is queued/active; a
  deliberate later resend is allowed once the prior job completes and is removed.
- **On success:** a `DRAFT` invoice transitions to `SENT` (initial invoice sends
  only — reminders/receipts don't change status), an entry is appended to the
  invoice's `emailsSent: [{ to, sentAt, type }]` delivery log, and an
  `INVOICE_EMAIL_SENT` `ActivityLog` row is written (best-effort).
- **Templates** live in `integrations/email/templates/` (`invoiceEmail`,
  `reminderEmail`, `paymentReceivedEmail`), returning `{ subject, html, text }`.
  All CSS is inline (clients strip `<style>`), every interpolated value is
  escaped, and a plain-text fallback accompanies every HTML body.
- **No key, no send.** When `RESEND_API_KEY` is unset, sends are logged and
  skipped rather than throwing — local dev and CI work without a real provider.
  `EMAIL_FROM` must be on a Resend-verified domain in production.

> **Worker process:** Phase 7 runs workers (email delivery + the daily reminder
> sweep) in a **dedicated process** (`jobs/worker.ts`, `npm run worker`), separate
> from the API. Both processes must run in production; in dev run `npm run worker`
> alongside `npm run dev`. A crash in a job never takes down the HTTP server, and
> the two scale independently. Redis is required for sending/reminders — the queue
> cannot enqueue without it (unlike the cache layer, which fails open).

### Reminder automation

`POST /api/v1/invoices/:id/remind` queues an ad-hoc reminder for one invoice
(ownership, status eligibility, and a per-invoice rate limit are enforced in the
service; responds **202**). Automated dunning runs via a BullMQ Job Scheduler
registered in the worker process (`jobs/scheduler.ts`, cron `0 8 * * *` UTC):
`processReminderSweep()` first flips issued-but-unpaid invoices past their due
date to `OVERDUE`, then queues at most one due reminder per active invoice.

- **Schedule** defaults to `[-3, 1, 7, 14]` days relative to `dueDate`
  (0 = due date). Per-tenant via `settings.reminders` (Phase 3); `enabled: false`
  pauses automated reminders. All date math is in UTC — no DST/clock-skew drift.
- **Send-once guaranteed.** Each reminder milestone is recorded in the invoice's
  `remindersSent` with an atomic guarded update *before* the email is enqueued, so
  a crash never produces a duplicate dunning email. A `PAID`/`CANCELLED` invoice and
  customers with no email are skipped (logged, never failing the run).
- **Batched, idempotent.** The sweep streams invoices via a cursor (flat memory)
  using the `{ status: 1, dueDate: 1 }` index; running it twice in a day sends
  nothing the second time.

### Billing & plan limits

Phase 8 turns the app into a SaaS. Plans ship with the code in
`modules/billing/plans.registry.ts` (the single source of truth for limits), and a
`Plan` Mongo model is seeded from it at boot (`seedPlans()`). **The registry is
what enforcement reads** — a missing/unseeded plan document can never block work.

| Plan | Invoices/mo | Customers | AI/mo | Templates | Price |
|---|---|---|---|---|---|
| `free` | 5 | 10 | 10 | `classic` | $0 |
| `pro` | 100 | unlimited | 200 | all | $12/mo |
| `business` | unlimited | unlimited | unlimited | all | $29/mo |

- **`User.subscription`** (`planKey` default `free`, `status`, `stripeCustomerId`,
  `stripeSubscriptionId`, `currentPeriodStart`, `currentPeriodEnd`). Default
  status is `active` so a new free account is never blocked.
- **Enforcement.** `enforcePlanLimit(resource)` middleware on invoice creation,
  customer creation, and AI generation (both `generate-invoice` and `chat`).
  When a tenant is at their cap the request fails with **402
  `PLAN_LIMIT_EXCEEDED`** and `details: { resource, limit, usage, planKey }` so
  the client can show an upgrade prompt. `GET /templates` is also filtered by the
  tenant's `templatesAllowed` (free sees only `classic`).
- **Usage windows follow the billing period, not the calendar month.** For an
  active subscription the count starts at `subscription.currentPeriodStart`;
  free / expired accounts fall back to the start of the current month (UTC).
  Counts for invoices and customers are exact Mongo `countDocuments` reads
  cached in Redis (TTL 10 min) and **invalidated on create**. AI usage has no
  durable document, so it is a Redis counter for the period.
- **Stripe webhooks.** `POST /webhooks/stripe` now handles `checkout.session.completed`
  (subscription + invoice-payment modes), `customer.subscription.created/updated/deleted`,
  and `invoice.payment_failed`, in addition to the pre-existing
  `payment_intent.payment_failed` logging. Idempotent per Stripe event id
  (Redis, 24h TTL) — replayed deliveries are no-ops. `invoice.payment_failed`
  flips the subscription to `past_due` and emails the subscriber
  (`paymentFailedEmail` template; best-effort, never fails the webhook ack).
- **Downgrade/cancellation never destroys data.** Deleting a subscription drops
  the tenant back to the `free` plan (blocking new records over the cap) but
  keeps all existing invoices and customers intact.
- **Checkout & portal.** `POST /billing/checkout` creates a subscription Checkout
  session (reusing/provisioning the Stripe customer), `POST /billing/portal`
  returns a Billing Portal link. Both need `STRIPE_SECRET_KEY` (503 otherwise)
  and a `stripePriceId` on the plan.

> **Config:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (endpoint
> `POST /webhooks/stripe`), and each paid plan's `stripePriceId` come from your
> Stripe dashboard — fill the price ids into `plans.registry.ts`. The SDK's
> pinned API version (`2025-02-24.acacia`) was verified against `stripe@17.7.0`.

---

## Phase 1 Baseline

Phase 1 repaired a codebase that did not compile. Fixes worth knowing about:

- Installed missing `@clerk/express` / `@clerk/backend` / `resend`; aligned
  `@types/express` to v4 to match Express 4
- Replaced `req.auth` with `req.user` carrying the **Mongo** `userId` — controllers
  were passing Clerk IDs into `ObjectId` fields, so tenant queries silently matched nothing
- `authorize()` accepted roles and then ignored them, leaving admin routes open to any
  authenticated user
- Replaced `Math.random()` invoice numbers with an atomic per-tenant counter
- Replaced global-unique `invoiceNumber` with compound unique `{ userId, invoiceNumber }`
- Replaced flat `taxRate` with generic `taxComponents[]`
- Removed `POST /users/sync`, which trusted `userId` and `email` straight from the
  request body — any caller could create or hijack a user record
- Fixed unreachable import paths in `webhooks.routes.ts`
- Removed duplicate index declarations across all models

**Verified:** `tsc --noEmit` clean · production build clean · server boots against
Atlas · `/health` returns healthy · invalid tokens return 401 (not 500) · 4/4
numbering tests pass including 25-way concurrency.

---

## Definition of Done

Every phase must satisfy all of these before it is considered complete:

1. `npm run typecheck` passes with zero errors
2. `npm run build` succeeds
3. Server boots and `/health` returns `healthy`
4. New logic has Vitest coverage, and `npm run test:run` passes
5. Every new tenant-data query is scoped by `userId`
6. Every new request body is Zod-validated
7. No `any`
8. New env vars added to `.env.example` **with a comment explaining where to obtain them**
9. This README updated if routes, models, or conventions changed
