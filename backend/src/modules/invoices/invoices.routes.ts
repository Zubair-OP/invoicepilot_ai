import { Router } from "express";
import { authenticate } from "../../common/middlewares/auth.js";
import { validate } from "../../common/middlewares/validate.js";
import { validateObjectId } from "../../common/middlewares/objectId.js";
import { strictLimiter, generousLimiter } from "../../common/middlewares/rateLimit.js";
import { createInvoiceSchema, updateInvoiceSchema } from "./invoices.validation.js";
import * as invoicesController from "./invoices.controller.js";
import { pdfController } from "../pdf/index.js";
import { emailController, sendEmailSchema } from "../email/index.js";
import { remindersController } from "../reminders/index.js";
import { enforcePlanLimit } from "../billing/index.js";

const router = Router();

router.use(authenticate);

// Every `:id` sub-route must carry a well-formed ObjectId — reject malformed
// ids with a 400 before they reach a query (would otherwise be a 500 CastError).
router.use("/:id", validateObjectId);

// Reads are cheap → generous tier. Writes / PDF / email / reminders are
// expensive or send external requests → strict tier.
router.get("/", generousLimiter, invoicesController.list);
router.get("/:id", generousLimiter, invoicesController.getById);
// Plan limit on invoice creation — 402 once the tenant hits their per-period cap.
router.post("/", strictLimiter, validate(createInvoiceSchema), enforcePlanLimit("invoicesPerMonth"), invoicesController.create);
router.patch("/:id", strictLimiter, validate(updateInvoiceSchema), invoicesController.update);
router.delete("/:id", strictLimiter, invoicesController.remove);
router.patch("/:id/send", strictLimiter, invoicesController.markAsSent);
router.patch("/:id/pay", strictLimiter, invoicesController.markAsPaid);

// PDF generation (Phase 5). Rendered on demand from current invoice data.
router.get("/:id/pdf", strictLimiter, pdfController.downloadPDF);
router.get("/:id/preview", strictLimiter, pdfController.preview);

// Email delivery (Phase 6). Queues the invoice + PDF for async delivery.
router.post("/:id/send-email", strictLimiter, validate(sendEmailSchema), emailController.sendInvoiceEmail);

// Manual reminder (Phase 7). Ad-hoc dunning nudge, rate limited per invoice.
router.post("/:id/remind", strictLimiter, remindersController.remindInvoice);

export default router;
