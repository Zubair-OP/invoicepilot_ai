import { Request, Response, NextFunction } from "express";
import * as dashboardService from "./dashboard.service.js";
import { resolveDashboardRange } from "./dashboard.validation.js";
import { successResponse } from "../../common/response.js";

export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const range = resolveDashboardRange(req.query.from as string | undefined, req.query.to as string | undefined);
    const dashboard = await dashboardService.getDashboard(req.user!.userId, range);
    res.json(successResponse(dashboard));
  } catch (error) {
    next(error);
  }
}
