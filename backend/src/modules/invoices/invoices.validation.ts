import { z } from "zod";

const invoiceItemSchema = z.object({
  description: z.string().min(1, "Description is required").max(500),
  quantity: z.number().positive("Quantity must be positive"),
  unitPrice: z.number().nonnegative("Unit price cannot be negative"),
});

// Generic tax component — the caller names the tax, so GST (CGST/SGST/IGST),
// VAT and sales tax all use the same shape.
const taxComponentSchema = z.object({
  name: z.string().min(1, "Tax name is required").max(50),
  rate: z.number().min(0).max(100),
});

export const createInvoiceSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  items: z.array(invoiceItemSchema).min(1, "At least one item is required"),
  // currency / taxComponents / dueDate are optional here and fall back to the
  // user's settings (Phase 3) when omitted. No .default() — the service needs to
  // distinguish "omitted" (inherit) from "explicitly set" (override).
  currency: z.string().length(3, "Currency must be 3 letters").optional(),
  taxComponents: z.array(taxComponentSchema).max(5).optional(),
  discount: z.number().min(0).optional().default(0),
  notes: z.string().max(1000).optional(),
  dueDate: z.string().optional().refine((val) => !val || !isNaN(Date.parse(val)), "Invalid date"),
  issuedAt: z.string().optional().refine((val) => !val || !isNaN(Date.parse(val)), "Invalid date"),
});

export const updateInvoiceSchema = z.object({
  items: z.array(invoiceItemSchema).min(1).optional(),
  taxComponents: z.array(taxComponentSchema).max(5).optional(),
  discount: z.number().min(0).optional(),
  notes: z.string().max(1000).optional(),
  dueDate: z.string().optional().refine((val) => !val || !isNaN(Date.parse(val)), "Invalid date"),
  status: z.enum(["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"]).optional(),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
