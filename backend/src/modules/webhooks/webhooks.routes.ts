import { Router, Request, Response } from "express";
import { constructWebhookEvent, stripe } from "../../integrations/stripe/stripe.js";
import { handleStripeBillingEvent } from "../billing/index.js";
import { logger } from "../../observability/logger.js";
import * as clerkController from "./clerk.controller.js";

const router = Router();

router.post("/clerk", clerkController.handleClerk);

router.post("/stripe", async (req: Request, res: Response) => {
  try {
    const signature = req.headers["stripe-signature"] as string;
    if (!signature || !stripe) {
      return res.status(400).json({ error: "Missing stripe signature" });
    }

    const event = await constructWebhookEvent(req.body as Buffer, signature);

    // Phase 8: subscription lifecycle + plan sync live in the billing module.
    // The handler is idempotent per Stripe event id (Stripe retries on non-2xx),
    // so a replayed delivery is a no-op.
    const status = await handleStripeBillingEvent(event);

    res.json({ received: true, status });
  } catch (error) {
    logger.error({ err: error }, "Stripe webhook error");
    res.status(400).json({ error: "Webhook error" });
  }
});

export { router as webhooksRoutes };
export default router;
