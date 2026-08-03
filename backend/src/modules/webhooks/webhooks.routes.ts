import { Router, Request, Response } from "express";
import { constructWebhookEvent, stripe } from "../../integrations/stripe/stripe.js";
import { Invoice } from "../../database/models/index.js";
import { logger } from "../../observability/logger.js";

const router = Router();

router.post("/stripe", async (req: Request, res: Response) => {
  try {
    const signature = req.headers["stripe-signature"] as string;
    if (!signature || !stripe) {
      return res.status(400).json({ error: "Missing stripe signature" });
    }

    const event = await constructWebhookEvent(req.body as Buffer, signature);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const invoiceId = session.metadata?.invoiceId;
        if (invoiceId) {
          await Invoice.findByIdAndUpdate(invoiceId, { status: "PAID", paidAt: new Date() });
          logger.info({ invoiceId }, "Invoice paid via Stripe");
        }
        break;
      }
      case "payment_intent.payment_failed":
        logger.warn({ paymentIntent: event.data.object.id }, "Payment failed");
        break;
      default:
        logger.debug({ eventType: event.type }, "Unhandled Stripe event");
    }

    res.json({ received: true });
  } catch (error) {
    logger.error({ err: error }, "Stripe webhook error");
    res.status(400).json({ error: "Webhook error" });
  }
});

export { router as webhooksRoutes };
export default router;
