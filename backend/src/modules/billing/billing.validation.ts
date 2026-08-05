import { z } from "zod";

export const checkoutSchema = z.object({
  planKey: z.enum(["free", "pro", "business"]),
});