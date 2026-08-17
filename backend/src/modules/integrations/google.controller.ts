import { Request, Response, NextFunction } from "express";
import * as googleService from "./google.service.js";
import { successResponse } from "../../common/response.js";
import { env } from "../../config/env.js";

export function getAuthUrl(req: Request, res: Response, next: NextFunction) {
  try {
    const result = googleService.getAuthUrl(req.user!.userId);
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
}

export async function handleCallback(req: Request, res: Response) {
  const code = req.query.code as string;
  const userId = req.query.state as string;
  const frontendOrigin = env.CORS_ORIGIN.split(",")[0].trim();

  if (!code || !userId) {
    return res.redirect(`${frontendOrigin}/dashboard/settings?google=error&message=missing_params`);
  }

  try {
    await googleService.handleCallback(code, userId);
    res.redirect(`${frontendOrigin}/dashboard/settings?google=connected`);
  } catch (error: any) {
    const message = encodeURIComponent(error.message || "Failed to connect Google account");
    res.redirect(`${frontendOrigin}/dashboard/settings?google=error&message=${message}`);
  }
}

export async function disconnect(req: Request, res: Response, next: NextFunction) {
  try {
    await googleService.disconnect(req.user!.userId);
    res.json(successResponse(null, "Google account disconnected"));
  } catch (error) {
    next(error);
  }
}

export async function getStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await googleService.getStatus(req.user!.userId);
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
}
