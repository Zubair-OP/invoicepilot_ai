import { Router } from "express";
import { authenticate } from "../../common/middlewares/auth.js";
import { validate } from "../../common/middlewares/validate.js";
import { generateInvoiceSchema, chatSchema } from "./ai.validation.js";
import * as aiController from "./ai.controller.js";

const router = Router();

router.use(authenticate);

router.post("/generate-invoice", validate(generateInvoiceSchema), aiController.generateInvoice);
router.post("/chat", validate(chatSchema), aiController.chat);

export default router;
