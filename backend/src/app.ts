import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

import { env } from "./config/env.js";
import { connectDatabase, disconnectDatabase } from "./database/client.js";
import { requestId } from "./common/middlewares/requestId.js";
import { errorHandler, notFoundHandler } from "./common/middlewares/errorHandler.js";
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
import healthRoutes from "./health/health.routes.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(cookieParser());
app.use(requestId);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many requests", code: "RATE_LIMIT_EXCEEDED" },
  })
);

app.use("/webhooks", express.raw({ type: "application/json" }), webhooksRoutes);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
  res.json({ name: "InvoicePilot API", version: "1.0.0" });
});

app.use("/health", healthRoutes);
app.use(`${env.API_PREFIX}/users`, usersRoutes);
app.use(`${env.API_PREFIX}/customers`, customersRoutes);
app.use(`${env.API_PREFIX}/invoices`, invoicesRoutes);
app.use(`${env.API_PREFIX}/admin`, adminRoutes);
app.use(`${env.API_PREFIX}/settings`, settingsRoutes);
app.use(`${env.API_PREFIX}/templates`, templatesRoutes);
app.use(`${env.API_PREFIX}/ai`, aiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

async function main() {
  await connectDatabase();

  // Phase 7: workers (email + reminder sweep) run in the dedicated worker
  // process (jobs/worker.ts, `npm run worker`), not the API. Both processes
  // must run in production — see README. In dev, run `npm run worker` alongside
  // `npm run dev` to deliver emails and the daily reminder sweep.
  app.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
  });
}

main().catch((err) => {
  logger.fatal(err, "Failed to start server");
  process.exit(1);
});

process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down...");
  await closeQueues();
  await closeBrowser();
  await closeRedisCache();
  await disconnectDatabase();
  process.exit(0);
});

export default app;
