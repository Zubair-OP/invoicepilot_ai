import { Request, Response, NextFunction } from "express";
import * as aiService from "./ai.service.js";
import { successResponse } from "../../common/response.js";

export async function generateInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const draft = await aiService.generateInvoice(req.user!.userId, req.body);
    res.json(successResponse(draft, "Invoice draft generated"));
  } catch (error) {
    next(error);
  }
}

export async function chat(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await aiService.chat(req.user!.userId, req.body);
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
}
