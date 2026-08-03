import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { AppError, ValidationError } from "../errors/index.js";

export function validate(schema: ZodSchema, source: "body" | "query" | "params" = "body") {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req[source] = schema.parse(req[source]);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors: Record<string, string[]> = {};
        error.errors.forEach((err) => {
          const path = err.path.join(".");
          if (!errors[path]) errors[path] = [];
          errors[path].push(err.message);
        });
        next(new ValidationError(errors));
      } else {
        next(error);
      }
    }
  };
}
