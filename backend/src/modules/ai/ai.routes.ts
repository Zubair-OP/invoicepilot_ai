import { Router } from "express";
import { authenticate } from "../../common/middlewares/auth.js";
import { validate } from "../../common/middlewares/validate.js";
import { strictLimiter } from "../../common/middlewares/rateLimit.js";
import { generateInvoiceSchema, chatSchema } from "./ai.validation.js";
import * as aiController from "./ai.controller.js";
import { enforcePlanLimit } from "../billing/index.js";

const router = Router();

router.use(authenticate, strictLimiter);

// Plan limit on AI usage — the monthly quota counts both generation and
// refinement, since both call the model.
router.post("/generate-invoice", validate(generateInvoiceSchema), enforcePlanLimit("aiGenerationsPerMonth"), aiController.generateInvoice);
router.post("/chat", validate(chatSchema), enforcePlanLimit("aiGenerationsPerMonth"), aiController.chat);

export default router;
