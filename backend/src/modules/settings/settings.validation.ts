import { z } from "zod";
import { isValidTemplateId } from "../templates/templates.registry.js";

// Same shape the invoice validator accepts: the caller names the tax and gives a
// rate; the amount is always computed server-side, never supplied here.
const taxComponentSchema = z.object({
  name: z.string().min(1, "Tax name is required").max(50),
  rate: z.number().min(0).max(100),
});

// Dunning schedule. Offsets are whole days relative to `dueDate` (negative =
// before due, positive = after). Bounded to a sane window so a typo can't
// schedule a reminder years out, de-duplicated, and capped so the sweep never
// fans out unbounded per invoice. `reminders` replaces the whole subdocument
// when present, so both fields are required together here.
const reminderSettingsSchema = z.object({
  enabled: z.boolean(),
  offsets: z
    .array(z.number().int().min(-90).max(365))
    .min(1, "At least one offset is required")
    .max(10, "At most 10 offsets")
    .refine((offsets) => new Set(offsets).size === offsets.length, "Offsets must be unique"),
  intervalMinutes: z.number().int().min(5).max(1440).optional(),
});

const customSmtpSchema = z.object({
  host: z.string().max(200).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  user: z.string().max(200).optional(),
  pass: z.string().max(200).optional(),
});

// Every field is optional so PATCH can update a single setting. templateId is
// validated against the shipped registry, so an unknown id fails here as a 422
// rather than being stored and breaking rendering in Phase 5.
export const updateSettingsSchema = z
  .object({
    businessName: z.string().max(200).optional(),
    businessEmail: z.string().email("Invalid email address").optional().or(z.literal("")),
    businessPhone: z.string().max(50).optional().or(z.literal("")),
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
    customSmtp: customSmtpSchema.optional(),
    reminders: reminderSettingsSchema.optional(),
  })
  .strict();

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
