import { z } from "zod";
import { isValidTemplateId } from "../templates/templates.registry.js";

// Same shape the invoice validator accepts: the caller names the tax and gives a
// rate; the amount is always computed server-side, never supplied here.
const taxComponentSchema = z.object({
  name: z.string().min(1, "Tax name is required").max(50),
  rate: z.number().min(0).max(100),
});

// Every field is optional so PATCH can update a single setting. templateId is
// validated against the shipped registry, so an unknown id fails here as a 422
// rather than being stored and breaking rendering in Phase 5.
export const updateSettingsSchema = z
  .object({
    businessName: z.string().max(200).optional(),
    businessAddress: z.string().max(500).optional(),
    taxId: z.string().max(50).optional(),
    logoUrl: z.string().url().optional(),
    defaultCurrency: z.string().length(3, "Currency must be 3 letters").optional(),
    defaultPaymentTermsDays: z.number().int().min(0).max(365).optional(),
    defaultTaxComponents: z.array(taxComponentSchema).max(5).optional(),
    invoicePrefix: z.string().min(1, "Prefix is required").max(10).optional(),
    templateId: z
      .string()
      .refine(isValidTemplateId, "Unknown template")
      .optional(),
  })
  .strict();

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
