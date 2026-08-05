import { Request, Response, NextFunction } from "express";
import * as emailService from "./email.service.js";
import { successResponse } from "../../common/response.js";

/**
 * POST /invoices/:id/send-email — queue the invoice for delivery to the
 * customer (or an override recipient). Responds 202 Accepted: the email is
 * dispatched asynchronously by the email worker.
 */
export async function sendInvoiceEmail(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await emailService.queueInvoiceEmail(
      req.user!.userId,
      req.params.id,
      "invoice",
      req.body
    );
    res.status(202).json(successResponse(result, "Invoice email queued for delivery"));
  } catch (error) {
    next(error);
  }
}
