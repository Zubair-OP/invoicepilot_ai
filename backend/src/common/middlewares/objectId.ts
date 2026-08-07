import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { BadRequestError } from "../errors/index.js";

/**
 * Rejects any route param that is not a well-formed Mongo ObjectId with a 400,
 * *before* the value reaches a service query. Without this, a malformed `:id`
 * makes Mongoose throw a CastError, which the error handler would otherwise
 * turn into a 500.
 *
 * Mount it with a path prefix, e.g. `router.use("/:id", validateObjectId)`, so
 * every sub-route (`/:id`, `/:id/pdf`, ...) is covered by one registration.
 */
export function validateObjectId(req: Request, _res: Response, next: NextFunction): void {
  for (const [name, value] of Object.entries(req.params)) {
    if (!mongoose.isValidObjectId(value)) {
      return next(new BadRequestError(`Invalid ${name}: must be a valid ObjectId`));
    }
  }
  next();
}
