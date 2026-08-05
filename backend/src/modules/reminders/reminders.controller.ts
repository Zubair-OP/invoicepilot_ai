import { Request, Response, NextFunction } from "express";
import * as remindersService from "./reminders.service.js";
import { successResponse } from "../../common/response.js";

/**
 * POST /invoices/:id/remind — queue an ad-hoc reminder for one invoice.
 *
 * Ownership, status eligibility, recipient resolution, and the per-invoice rate
 * limit are all enforced in the service. Responds 202 Accepted: the reminder is
 * delivered asynchronously by the email worker, same as any other send.
 */
export async function remindInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await remindersService.sendManualReminder(req.user!.userId, req.params.id);
    res.status(202).json(successResponse(result, "Reminder queued for delivery"));
  } catch (error) {
    next(error);
  }
}
