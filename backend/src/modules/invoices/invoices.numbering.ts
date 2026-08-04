import { nextSequence } from "../../database/models/Counter.js";

/**
 * Generates a per-user sequential invoice number.
 *
 * Format: <PREFIX>-YYYYMM-NNNN (e.g. INV-202608-0042). The prefix comes from the
 * user's settings (Phase 3) and defaults to "INV".
 *
 * The sequence key is scoped to userId + year-month and is **independent of the
 * prefix**, so changing the prefix in settings renames new invoices without
 * resetting the counter — the key format stays `invoice:${userId}:${ym}`.
 * nextSequence() uses an atomic $inc, so concurrent requests are guaranteed
 * distinct values.
 *
 * Lives in its own module because both the invoice service and the DB seed need
 * it — the seed must advance the same counter, otherwise the first
 * API-created invoice would collide with seeded numbers.
 */
export async function generateInvoiceNumber(
  userId: string,
  prefix = "INV",
  at: Date = new Date()
): Promise<string> {
  const ym = `${at.getFullYear()}${String(at.getMonth() + 1).padStart(2, "0")}`;
  const seq = await nextSequence(`invoice:${userId}:${ym}`);
  return `${prefix}-${ym}-${String(seq).padStart(4, "0")}`;
}
