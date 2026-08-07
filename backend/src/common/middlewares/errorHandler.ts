import { Request, Response, NextFunction } from "express";
import { logger } from "../../observability/logger.js";
import { env } from "../../config/env.js";
import { AppError } from "../errors/index.js";
import { errorResponse } from "../response.js";

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    if (err.isOperational) {
      logger.warn({ err, requestId: req.id }, err.message);
    } else {
      logger.error({ err, requestId: req.id }, err.message);
    }

    const body = errorResponse(err.message, err.code);
    if ("errors" in err) {
      (body as unknown as Record<string, unknown>).errors = (err as AppError & { errors: Record<string, string[]> }).errors;
    }
    if (err.details) {
      (body as unknown as Record<string, unknown>).details = err.details;
    }
    return res.status(err.statusCode).json(body);
  }

  logger.error({ err, requestId: req.id }, "Unhandled error");

  // Non-AppError throws: never leak internals. `err` may not even be an Error
  // (a handler could `throw "string"`), so coerce defensively. In production the
  // message is always generic; in development the real message is useful.
  const isProduction = env.NODE_ENV === "production";
  const rawMessage = err instanceof Error ? err.message : "Unknown error";

  return res.status(500).json(
    errorResponse(isProduction ? "Internal server error" : rawMessage, "INTERNAL_SERVER_ERROR")
  );
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json(errorResponse(`Route ${req.method} ${req.originalUrl} not found`, "NOT_FOUND"));
}
