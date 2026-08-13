import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import { env } from "./config/env.js";
import { connectDatabase, disconnectDatabase } from "./database/client.js";
import { requestId } from "./common/middlewares/requestId.js";
import { errorHandler, notFoundHandler } from "./common/middlewares/errorHandler.js";
import { logSlowRequests } from "./common/middlewares/slowRequests.js";
import { apiLimiter, generousLimiter, closeRateLimitStore } from "./common/middlewares/rateLimit.js";
import { installProcessErrorHandlers } from "./observability/processErrors.js";
import { enableSlowQueryLogging } from "./database/slowQueries.js";
import { logger } from "./observability/logger.js";
import { closeRedisCache } from "./common/cache/redis.js";
import { closeBrowser } from "./modules/pdf/index.js";
import { closeQueues } from "./jobs/queues.js";

import { usersRoutes } from "./modules/users/index.js";
import { customersRoutes } from "./modules/customers/index.js";
import { invoicesRoutes } from "./modules/invoices/index.js";
import { webhooksRoutes } from "./modules/webhooks/index.js";
import { adminRoutes } from "./modules/admin/index.js";
import { settingsRoutes } from "./modules/settings/index.js";
import { templatesRoutes } from "./modules/templates/index.js";
import { aiRoutes } from "./modules/ai/index.js";
import { billingRoutes, seedPlans } from "./modules/billing/index.js";
import { dashboardRoutes } from "./modules/dashboard/index.js";
import healthRoutes from "./health/health.routes.js";

const app = express();

// CORS_ORIGIN is a comma-separated allow-list (validated in env.ts to never be
// `*` in production, since credentials are enabled). Parse it into an array so
// multiple frontend origins can be trusted.
const corsOrigins = env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean);

app.use(helmet());
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(cookieParser());
app.use(requestId);
app.use(logSlowRequests);

// Webhooks are mounted before the JSON body parser and are NOT rate limited:
// providers (Stripe/Clerk) retry aggressively and their IPs are shared. The
// Svix/Stripe signature verification is the security boundary for these routes.
app.use("/webhooks", express.raw({ type: "application/json" }), webhooksRoutes);

app.use(express.json({ limit: env.BODY_SIZE_LIMIT }));
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
  res.json({ name: "InvoicePilot API", version: "1.0.0" });
});

// Liveness probe: cheap and polled by load balancers, so a generous limit only.
app.use("/health", generousLimiter, healthRoutes);

// Default per-IP safety net for the whole API surface. Tighter per-tenant
// tiers (strictLimiter / generousLimiter) are applied per-route inside each
// module, all backed by the same Redis — see common/middlewares/rateLimit.ts.
app.use(apiLimiter);

app.use(`${env.API_PREFIX}/users`, usersRoutes);
app.use(`${env.API_PREFIX}/customers`, customersRoutes);
app.use(`${env.API_PREFIX}/invoices`, invoicesRoutes);
app.use(`${env.API_PREFIX}/admin`, adminRoutes);
app.use(`${env.API_PREFIX}/settings`, settingsRoutes);
app.use(`${env.API_PREFIX}/templates`, templatesRoutes);
app.use(`${env.API_PREFIX}/ai`, aiRoutes);
app.use(`${env.API_PREFIX}/billing`, billingRoutes);
app.use(`${env.API_PREFIX}/dashboard`, dashboardRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

async function main() {
  installProcessErrorHandlers();
  await connectDatabase();
  enableSlowQueryLogging();
  await seedPlans();

  // Start workers in-process for development convenience — no second terminal needed.
  // In production these run as a separate process (`npm run worker`) but running
  // them here in dev keeps the setup simple without changing any behaviour.
  const { startEmailWorker } = await import("./jobs/workers/email.worker.js");
  const { startReminderWorker } = await import("./jobs/workers/reminder.worker.js");
  const { scheduleReminderSweep } = await import("./jobs/scheduler.js");
  const { processReminderSweep } = await import("./modules/reminders/index.js");
  startEmailWorker();
  startReminderWorker();
  await scheduleReminderSweep();
  logger.info("Workers started (email + reminder: scheduled every 5 minutes)");

  // Run an immediate check on startup in development
  if (env.NODE_ENV === "development") {
    processReminderSweep().catch((err) => logger.warn({ err }, "Initial dev reminder sweep failed"));
  }

  app.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
  });
}

main().catch((err) => {
  logger.fatal(err, "Failed to start server");
  process.exit(1);
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ signal }, "Shutting down...");
  await closeQueues();
  await closeBrowser();
  await closeRedisCache();
  closeRateLimitStore();
  await disconnectDatabase();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

export default app;
