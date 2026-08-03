# InvoicePilot AI — Backend

AI-powered invoice management and payment reminder platform.

**Status:** Phase 1 complete. Phases 2–10 pending — see [PHASES.md](./PHASES.md).

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
