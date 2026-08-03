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
    return res.status(err.statusCode).json(body);
  }

  logger.error({ err, requestId: req.id }, "Unhandled error");

  return res.status(500).json(
    errorResponse(
      env.NODE_ENV === "production" ? "Internal server error" : err.message,
      "INTERNAL_SERVER_ERROR"
    )
  );
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json(errorResponse(`Route ${req.method} ${req.originalUrl} not found`, "NOT_FOUND"));
}
