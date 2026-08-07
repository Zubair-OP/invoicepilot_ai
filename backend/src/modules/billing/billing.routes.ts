import { Router } from "express";
import { authenticate } from "../../common/middlewares/auth.js";
import { validate } from "../../common/middlewares/validate.js";
import { strictLimiter, generousLimiter } from "../../common/middlewares/rateLimit.js";
import { checkoutSchema } from "./billing.validation.js";
import * as billingController from "./billing.controller.js";

const router = Router();

// Public catalogue — no authentication required so a landing page can show plans.
router.get("/plans", generousLimiter, billingController.listPlans);

// Everything else needs a session to know whose subscription/usage to act on.
// Checkout/portal talk to Stripe → strict tier; subscription reads are cheap.
router.get("/subscription", authenticate, generousLimiter, billingController.getSubscription);
router.post("/checkout", authenticate, strictLimiter, validate(checkoutSchema), billingController.checkout);
router.post("/portal", authenticate, strictLimiter, billingController.portal);

export default router;
