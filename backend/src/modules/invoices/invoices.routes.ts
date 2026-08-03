import { Router } from "express";
import { authenticate } from "../../common/middlewares/auth.js";
import { validate } from "../../common/middlewares/validate.js";
import { createInvoiceSchema, updateInvoiceSchema } from "./invoices.validation.js";
import * as invoicesController from "./invoices.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", invoicesController.list);
router.get("/:id", invoicesController.getById);
router.post("/", validate(createInvoiceSchema), invoicesController.create);
router.patch("/:id", validate(updateInvoiceSchema), invoicesController.update);
router.delete("/:id", invoicesController.remove);
router.patch("/:id/send", invoicesController.markAsSent);
router.patch("/:id/pay", invoicesController.markAsPaid);

export default router;
