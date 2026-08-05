import { Router } from "express";
import { authenticate } from "../../common/middlewares/auth.js";
import { validate } from "../../common/middlewares/validate.js";
import { checkoutSchema } from "./billing.validation.js";
import * as billingController from "./billing.controller.js";

const router = Router();

// Public catalogue — no authentication required so a landing page can show plans.
router.get("/plans", billingController.listPlans);

// Everything else needs a session to know whose subscription/usage to act on.
router.get("/subscription", authenticate, billingController.getSubscription);
router.post("/checkout", authenticate, validate(checkoutSchema), billingController.checkout);
router.post("/portal", authenticate, billingController.portal);

export default router;