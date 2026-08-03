import { z } from "zod";

export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  company: z.string().max(100).optional(),
  avatar: z.string().url().optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
