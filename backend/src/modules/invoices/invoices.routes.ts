import { Router } from "express";
import { authenticate } from "../../common/middlewares/auth.js";
import { validate } from "../../common/middlewares/validate.js";
import { createInvoiceSchema, updateInvoiceSchema } from "./invoices.validation.js";
import * as invoicesController from "./invoices.controller.js";
import { pdfController } from "../pdf/index.js";
import { emailController, sendEmailSchema } from "../email/index.js";
import { remindersController } from "../reminders/index.js";

const router = Router();

router.use(authenticate);

router.get("/", invoicesController.list);
router.get("/:id", invoicesController.getById);
router.post("/", validate(createInvoiceSchema), invoicesController.create);
router.patch("/:id", validate(updateInvoiceSchema), invoicesController.update);
router.delete("/:id", invoicesController.remove);
router.patch("/:id/send", invoicesController.markAsSent);
router.patch("/:id/pay", invoicesController.markAsPaid);

// PDF generation (Phase 5). Rendered on demand from current invoice data.
router.get("/:id/pdf", pdfController.downloadPDF);
router.get("/:id/preview", pdfController.preview);

// Email delivery (Phase 6). Queues the invoice + PDF for async delivery.
router.post("/:id/send-email", validate(sendEmailSchema), emailController.sendInvoiceEmail);

// Manual reminder (Phase 7). Ad-hoc dunning nudge, rate limited per invoice.
router.post("/:id/remind", remindersController.remindInvoice);

export default router;
