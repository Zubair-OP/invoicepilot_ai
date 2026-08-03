import { z } from "zod";

export const createCustomerSchema = z.object({
  name: z.string().min(1, "Customer name is required").max(200),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  taxId: z.string().max(50).optional(),
  notes: z.string().max(1000).optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
