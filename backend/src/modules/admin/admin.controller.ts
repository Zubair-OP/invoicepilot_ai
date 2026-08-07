import { Request, Response, NextFunction } from "express";
import * as adminService from "./admin.service.js";
import * as adminAnalytics from "./admin.analytics.js";
import { getPaginationParams } from "../../common/utils/pagination.js";
import { successResponse } from "../../common/response.js";
import { resolveDashboardRange } from "../dashboard/dashboard.validation.js";
import type { UserRole } from "../../common/types/index.js";

export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = getPaginationParams(req.query as { page?: string; limit?: string });
    const role = req.query.role === "USER" || req.query.role === "ADMIN" ? req.query.role : undefined;
    const result = await adminService.listUsersAcrossTenants(pagination, {
      search: req.query.search as string | undefined,
      role,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getUser(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await adminService.getUserAcrossTenants(req.params.id);
    res.json(successResponse(user));
  } catch (error) {
    next(error);
  }
}

export async function updateUserRole(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await adminService.changeUserRole({
      actorUserId: req.user!.userId,
      targetUserId: req.params.id,
      role: req.body.role as UserRole,
      ipAddress: req.ip,
    });
    res.json(successResponse(user, "User role updated successfully"));
  } catch (error) {
    next(error);
  }
}

export async function getAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const range = resolveDashboardRange(req.query.from as string | undefined, req.query.to as string | undefined);
    const analytics = await adminAnalytics.getPlatformAnalytics(range);
    res.json(successResponse(analytics));
  } catch (error) {
    next(error);
  }
}
