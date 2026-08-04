import { Request, Response, NextFunction } from "express";
import { INVOICE_TEMPLATES } from "./templates.registry.js";
import { successResponse } from "../../common/response.js";

export function list(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(successResponse(INVOICE_TEMPLATES));
  } catch (error) {
    next(error);
  }
}
