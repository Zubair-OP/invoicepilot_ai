import { Request, Response, NextFunction } from "express";
import { successResponse } from "../../common/response.js";
import { ValidationError } from "../../common/errors/index.js";
import * as clerkWebhookService from "./clerk.service.js";

export async function handleClerk(req: Request, res: Response, next: NextFunction) {
  try {
    if (!Buffer.isBuffer(req.body)) {
      throw new ValidationError({ body: ["Expected raw webhook body"] });
    }

    const eventId = getRequiredHeader(req, "svix-id");
    const verifiedPayload = clerkWebhookService.verifyClerkWebhookPayload(req.body, {
      id: eventId,
      timestamp: getRequiredHeader(req, "svix-timestamp"),
      signature: getRequiredHeader(req, "svix-signature"),
    });

    const status = await clerkWebhookService.handleClerkWebhook(verifiedPayload, eventId);
    res.json(successResponse({ received: true, status }));
  } catch (error) {
    next(error);
  }
}

function getRequiredHeader(req: Request, name: string): string {
  const value = req.headers[name];
  if (typeof value === "string" && value.trim()) return value;
  throw new ValidationError({ [name]: ["Missing required header"] });
}
