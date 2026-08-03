import { Request, Response, NextFunction } from "express";
import * as usersService from "./users.service.js";
import { successResponse } from "../../common/response.js";

export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await usersService.getProfile(req.user!.clerkId);
    res.json(successResponse(user));
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await usersService.updateProfile(req.user!.clerkId, req.body);
    res.json(successResponse(user, "Profile updated successfully"));
  } catch (error) {
    next(error);
  }
}
