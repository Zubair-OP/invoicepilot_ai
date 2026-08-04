import { Request, Response, NextFunction } from "express";
import * as settingsService from "./settings.service.js";
import { successResponse } from "../../common/response.js";

export async function getSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await settingsService.getSettings(req.user!.userId);
    res.json(successResponse(settings));
  } catch (error) {
    next(error);
  }
}

export async function updateSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await settingsService.updateSettings(req.user!.userId, req.body);
    res.json(successResponse(settings, "Settings updated successfully"));
  } catch (error) {
    next(error);
  }
}
