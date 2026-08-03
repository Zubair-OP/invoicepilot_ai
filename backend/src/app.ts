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

import { usersRoutes } from "./modules/users/index.js";
import { customersRoutes } from "./modules/customers/index.js";
import { invoicesRoutes } from "./modules/invoices/index.js";
import { webhooksRoutes } from "./modules/webhooks/index.js";
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

app.use(notFoundHandler);
app.use(errorHandler);

async function main() {
  await connectDatabase();

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
  await disconnectDatabase();
  process.exit(0);
});

export default app;
