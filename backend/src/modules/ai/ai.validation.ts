import { z } from "zod";

// Request: the user's plain-language description. Capped so a huge prompt can't
// run up token cost or latency. The prompt is untrusted — it never influences
// auth, tenancy, or pricing, all of which are decided in code after validation.
export const generateInvoiceSchema = z.object({
  prompt: z.string().min(1, "Prompt is required").max(2000, "Prompt too long (max 2000 chars)"),
});

export type GenerateInvoiceInput = z.infer<typeof generateInvoiceSchema>;

// Multi-turn refinement. The client passes prior turns as context; each message
// is capped and the total number of turns is bounded to keep token cost in check.
export const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(2000),
      })
    )
    .min(1, "At least one message is required")
    .max(20, "Too many messages"),
});

export type ChatInput = z.infer<typeof chatSchema>;

// The shape we force the model to return and parse every response through. The
// model proposes name/rate for tax; amounts, subtotal and total are recomputed
// server-side and never taken from the model.
export const aiInvoiceOutputSchema = z.object({
  customerName: z.string().min(1),
  items: z
    .array(
      z.object({
        description: z.string().min(1).max(500),
        quantity: z.number().positive(),
        unitPrice: z.number().nonnegative(),
      })
    )
    .min(1),
  currency: z.string().length(3).optional(),
  taxComponents: z
    .array(
      z.object({
        name: z.string().min(1).max(50),
        rate: z.number().min(0).max(100),
      })
    )
    .max(5)
    .optional(),
  discount: z.number().min(0).optional(),
  dueDate: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), "Invalid date"),
  notes: z.string().max(1000).optional(),
});

export type AiInvoiceOutput = z.infer<typeof aiInvoiceOutputSchema>;
