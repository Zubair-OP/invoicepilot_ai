# InvoicePilot AI

> A production-oriented invoice management platform for agencies and service businesses — create invoices, generate professional PDFs, email clients, track payment status, and automate payment reminders.

## Overview

InvoicePilot AI is a full-stack invoice management system built around a simple business workflow:

**Create customer → Create invoice → Generate PDF → Send invoice → Track payment → Automate reminders**

The project is split into a Next.js frontend and a Node.js/Express backend. The backend uses MongoDB for persistent data, Redis for caching/rate limiting and BullMQ job queues, Clerk for authentication, Stripe for billing, **Brevo for transactional email delivery**, and Playwright for server-side PDF rendering.

The most important automation is the reminder engine. A persistent BullMQ scheduler periodically sweeps active unpaid invoices, determines whether a reminder milestone is due, prevents duplicate milestones, and queues the email asynchronously. The default reminder interval is 24 hours, while reminder settings support configurable intervals and multiple due-date offsets.

## Key Features

### Invoice Management

- Create, update, delete and view invoices
- Invoice lifecycle states including `DRAFT`, `SENT`, `OVERDUE`, `PAID` and `CANCELLED`
- Mark invoices as sent, paid or voided
- Server-side validation and tenant ownership checks
- Monthly invoice limits based on the selected billing plan

### Customer Management

- Create and manage customers before issuing invoices
- Customer-scoped invoice relationships
- Customer email resolution for invoice delivery and payment reminders

### PDF Invoices

- Generate professional invoice PDFs from current invoice data
- Preview invoices before download
- Server-side rendering with Playwright/Chromium
- PDF generation is protected by the same authenticated and rate-limited API layer

### Email Delivery

- Send invoices to customers by email
- **Brevo HTTP API** is used as the production transactional email transport
- Brevo is accessed over HTTPS (port 443), which avoids SMTP-port restrictions on Render's free tier
- Invoice email delivery is queued asynchronously instead of blocking the API request
- Reminder emails use the same queue-based delivery architecture
- Supports customer-specific SMTP configuration when configured; otherwise Brevo is the default platform transport when `BREVO_API_KEY` is set

### Automated Payment Reminders

InvoicePilot's automation layer is designed as a durable background workflow rather than a browser-side timer.

1. A BullMQ Job Scheduler creates the recurring reminder sweep.
2. The sweep identifies issued invoices that are still unpaid.
3. Past-due invoices can be transitioned to `OVERDUE`.
4. User reminder settings determine whether reminders are enabled and which due-date offsets apply.
5. The system checks the user's configured sweep interval.
6. A reminder milestone is atomically recorded before the email job is queued.
7. Redis/BullMQ handles asynchronous delivery through a dedicated worker.
8. The invoice stores reminder history so the same milestone is not sent twice.

The default interval is **24 hours (1,440 minutes)**. Reminder settings support configurable intervals and multiple offsets from 90 days before due date through 365 days after due date, subject to the application's plan/settings rules.

### Billing

- Stripe integration for subscription billing
- Plan-aware feature/usage limits
- Webhook handling for subscription and payment events
- Server-side enforcement of invoice limits

### AI-Assisted Invoicing

- Dedicated AI API module for AI-assisted invoice workflows
- Groq integration on the backend
- AI functionality is optional and can be disabled when the AI credential is not configured

## Security & Reliability

InvoicePilot includes several production-minded safeguards:

- Clerk session-token verification on protected API routes
- Role-based authorization for privileged routes
- Tenant ownership enforced through `userId`-scoped database queries
- Helmet security headers
- Explicit CORS allow-list with production protection against `*`
- Redis-backed API rate limiting
- Separate rate-limit tiers for expensive/write operations and cheaper reads
- Per-invoice throttling for manual reminders
- Zod request validation
- MongoDB ObjectId validation before database queries
- Request IDs for traceable logs
- Structured Pino logging with sensitive values redacted
- Slow-request and slow-query monitoring
- Centralized error handling
- Graceful shutdown for MongoDB, Redis, queues, browser resources and rate-limit stores
- Signed Clerk and Stripe webhook verification
- Body-size limits for incoming requests
- Idempotent reminder scheduling and milestone de-duplication

> **Security note:** This README describes controls present in the repository; it is not a claim of formal security certification or a substitute for an independent security audit.

## Architecture

```text
                         ┌─────────────────────┐
                         │     Next.js 16       │
                         │      Frontend        │
                         └──────────┬──────────┘
                                    │ HTTPS / API
                                    ▼
                         ┌─────────────────────┐
                         │ Express / Node.js   │
                         │       API           │
                         └──────┬──────┬───────┘
                                │      │
                    ┌───────────┘      └──────────────┐
                    ▼                                  ▼
             ┌─────────────┐                  ┌─────────────┐
             │  MongoDB    │                  │    Redis    │
             │  Database   │                  │ Cache/Limit │
             └─────────────┘                  └──────┬──────┘
                                                     │
                                                     ▼
                                              ┌─────────────┐
                                              │   BullMQ    │
                                              │   Queues    │
                                              └──────┬──────┘
                                                     │
                         ┌───────────────────────────┼────────────────────┐
                         ▼                           ▼                    ▼
                  Email Worker              Reminder Worker       Invoice/PDF Jobs
                         │                           │                    │
                         ▼                           ▼                    ▼
                       Brevo                  Reminder Logic         Playwright
```

### Why the worker architecture matters

The API does not need to stay busy waiting for email delivery, reminder processing or PDF generation. Background jobs can be retried/processed independently, while the API and worker can be scaled separately in production.

## Tech Stack

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Clerk Next.js SDK
- Lucide React

### Backend

- Node.js
- Express.js
- TypeScript
- MongoDB + Mongoose
- Redis + ioredis
- BullMQ
- Clerk Backend SDK
- Stripe
- **Brevo HTTP API**
- Nodemailer for optional customer-specific SMTP configuration
- Playwright
- Groq SDK
- Zod
- Helmet
- express-rate-limit
- Pino
- Vitest

## Repository Structure

```text
invoicepilot_ai/
├── frontend/                  # Next.js application
│   └── src/
│       ├── app/               # App Router pages and layouts
│       ├── components/        # Reusable UI components
│       ├── lib/               # API/client utilities
│       └── types/             # Shared frontend types
│
├── backend/                   # Node.js + Express API
│   ├── src/
│   │   ├── common/            # Middleware, errors, cache, utilities
│   │   ├── config/            # Environment configuration
│   │   ├── database/           # MongoDB connection and models
│   │   ├── integrations/      # Clerk, Google, email integrations
│   │   ├── jobs/              # BullMQ queues, workers and scheduler
│   │   ├── modules/            # Domain modules
│   │   │   ├── ai/
│   │   │   ├── billing/
│   │   │   ├── customers/
│   │   │   ├── dashboard/
│   │   │   ├── email/
│   │   │   ├── invoices/
│   │   │   ├── pdf/
│   │   │   ├── reminders/
│   │   │   ├── settings/
│   │   │   └── templates/
│   │   └── observability/     # Logging and process monitoring
│   ├── docs/api.http           # API request examples
│   ├── .env.example
│   ├── DEPLOYMENT.md
│   └── package.json
│
└── README.md
```

## Core Reminder Flow

```text
Recurring Scheduler
       │
       ▼
Reminder Sweep
       │
       ├── Find SENT / OVERDUE invoices
       │
       ├── Check user's reminder settings
       │
       ├── Check configured interval
       │
       ├── Determine due reminder milestone
       │
       ├── Verify customer email
       │
       └── Atomically record milestone
                    │
                    ▼
              BullMQ Reminder Queue
                    │
                    ▼
              Reminder Worker
                    │
                    ▼
                 Brevo API
                    │
                    ▼
              Customer's Inbox
```

The reminder milestone is guarded at the database level. If two sweeps race, only the request that successfully records the milestone proceeds to queue the automated reminder, reducing duplicate sends.

## Local Development

### 1. Clone the repository

```bash
git clone https://github.com/Zubair-OP/invoicepilot_ai.git
cd invoicepilot_ai
```

### 2. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

### 3. Configure the backend

```bash
cd ../backend
npm install
cp .env.example .env
```

Configure the required services/credentials in `.env`.

### 4. Start the backend

```bash
npm run dev
```

For development, the API can start the email/reminder workers in-process. The production setup should run the API and worker as separate long-lived processes.

## Backend Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the API in watch mode |
| `npm run build` | Compile TypeScript |
| `npm start` | Run the compiled API |
| `npm run worker` | Start the background worker in development |
| `npm run worker:prod` | Start the compiled production worker |
| `npm run lint` | Lint backend source |
| `npm test` | Run Vitest |
| `npm run test:run` | Run tests once |
| `npm run typecheck` | Type-check without emitting files |

## Production Deployment

The backend is designed for a persistent host such as Render, Railway or Fly because BullMQ workers and Playwright PDF generation require long-lived processes.

Production requires:

1. **API process** — serves Express routes.
2. **Worker process** — processes email, invoice/PDF and reminder jobs.
3. **MongoDB** — persistent application data.
4. **Redis** — BullMQ queues, caching and distributed rate limiting.
5. **Clerk** — authentication.
6. **Brevo** — transactional email delivery through its HTTP API.
7. **Stripe** — billing and webhooks.
8. **Groq** — optional AI invoice generation.

Example backend commands:

```bash
npm ci
npm run build
npx playwright install chromium --with-deps

# API
npm start

# Worker (separate process)
npm run worker:prod
```

See [`backend/DEPLOYMENT.md`](./backend/DEPLOYMENT.md) for the full environment and deployment checklist.

## Environment Variables

The exact environment variable contract is maintained in `backend/.env.example`.

Important production values include:

- `MONGO_URI`
- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_PASSWORD`
- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SECRET`
- `CORS_ORIGIN`
- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL`
- `BREVO_SENDER_NAME`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PUBLISHABLE_KEY`
- `GROQ_API_KEY`

**Never commit real secrets or `.env` files.**

## API Highlights

Authenticated invoice routes include:

```text
GET    /api/v1/invoices
GET    /api/v1/invoices/:id
POST   /api/v1/invoices
PATCH  /api/v1/invoices/:id
DELETE /api/v1/invoices/:id
PATCH  /api/v1/invoices/:id/send
PATCH  /api/v1/invoices/:id/pay
PATCH  /api/v1/invoices/:id/void
GET    /api/v1/invoices/:id/pdf
GET    /api/v1/invoices/:id/preview
POST   /api/v1/invoices/:id/send-email
POST   /api/v1/invoices/:id/remind
```

All protected invoice routes authenticate the caller, validate IDs and apply route-appropriate rate limits. Write, PDF, email and reminder operations use the stricter limiter tier.

## Testing

The backend includes automated tests for important infrastructure such as rate limiting, ObjectId validation, error handling and utility functions. Run:

```bash
cd backend
npm run test:run
```

For a production smoke test, verify health checks, authenticated API access, PDF generation, Stripe webhooks, Clerk webhook delivery and Brevo email delivery after deployment.

## Security Philosophy

InvoicePilot treats security as part of the application architecture rather than a final checklist. Authentication, authorization, tenant isolation, validation, rate limiting, webhook verification, structured logging and operational safeguards are implemented across the request lifecycle.

That said, no application should be considered completely secure from source inspection alone. Before handling real customer financial data at scale, perform dependency auditing, secret scanning, penetration testing, infrastructure hardening and an independent security review.

## Roadmap Ideas

Potential future improvements include:

- Automated payment-status synchronization from supported payment providers
- More granular plan-based reminder controls
- Delivery/open tracking where legally and technically appropriate
- Retry/dead-letter dashboards for failed background jobs
- Audit-log UI for sensitive account actions
- Expanded test coverage for concurrency and webhook edge cases
- Observability dashboards for queue latency and reminder delivery

## License

This project currently does not declare an open-source license in the repository. Treat the code as **all rights reserved** unless a license is added by the project owner.

## Author

**M Zubair**

Full-stack developer focused on building production-oriented web applications and AI-powered automation systems.

- GitHub: [Zubair-OP](https://github.com/Zubair-OP)
- Repository: [InvoicePilot AI](https://github.com/Zubair-OP/invoicepilot_ai)
