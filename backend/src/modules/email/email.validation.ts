import { z } from "zod";

// All fields optional: the default recipient is the customer's email and the
// default subject/body come from the template. `.strict()` rejects unknown keys.
export const sendEmailSchema = z
  .object({
    to: z.string().email().optional(),
    subject: z.string().min(1).max(200).optional(),
    message: z.string().max(2000).optional(),
  })
  .strict();

export type SendEmailInput = z.infer<typeof sendEmailSchema>;
