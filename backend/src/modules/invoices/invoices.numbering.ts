import { nextSequence } from "../../database/models/Counter.js";

/**
 * Generates a per-user sequential invoice number.
 *
 * Format: INV-YYYYMM-NNNN (e.g. INV-202608-0042)
 *
 * The sequence key is scoped to userId + year-month, so each tenant gets its own
 * numbering that restarts monthly, and two tenants can both hold
 * INV-202608-0001 without colliding. nextSequence() uses an atomic $inc, so
 * concurrent requests are guaranteed distinct values.
 *
 * Lives in its own module because both the invoice service and the DB seed need
 * it — the seed must advance the same counter, otherwise the first
 * API-created invoice would collide with seeded numbers.
 */
export async function generateInvoiceNumber(userId: string, at: Date = new Date()): Promise<string> {
  const ym = `${at.getFullYear()}${String(at.getMonth() + 1).padStart(2, "0")}`;
  const seq = await nextSequence(`invoice:${userId}:${ym}`);
  return `INV-${ym}-${String(seq).padStart(4, "0")}`;
}
