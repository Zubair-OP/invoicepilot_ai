import { Request, Response, NextFunction } from "express";
import { logger } from "../../observability/logger.js";
import { env } from "../../config/env.js";

/**
 * Logs any request that takes longer than `SLOW_REQUEST_MS` with its duration,
 * so latency regressions are visible in the logs without instrumenting every
 * route. Mounted early (before routes) so the measurement covers the full
 * request lifecycle, including body parsing and authentication.
 */
export function logSlowRequests(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    if (durationMs >= env.SLOW_REQUEST_MS) {
      logger.warn(
        {
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          durationMs: Math.round(durationMs),
        },
        "Slow request"
      );
    }
  });

  next();
}
