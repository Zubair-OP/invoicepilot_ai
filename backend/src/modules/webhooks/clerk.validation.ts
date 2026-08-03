import { z } from "zod";

const clerkEmailAddressSchema = z.object({
  id: z.string(),
  email_address: z.string().email(),
});

export const clerkWebhookUserSchema = z.object({
  id: z.string(),
  email_addresses: z.array(clerkEmailAddressSchema),
  primary_email_address_id: z.string().nullable().optional(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  username: z.string().nullable().optional(),
  image_url: z.string().optional().default(""),
  public_metadata: z.record(z.unknown()).nullable().optional(),
});

export const clerkUserChangedEventSchema = z.object({
  type: z.enum(["user.created", "user.updated"]),
  data: clerkWebhookUserSchema,
});

export const clerkUserDeletedEventSchema = z.object({
  type: z.literal("user.deleted"),
  data: z.object({
    id: z.string(),
  }),
});

export const ignoredClerkEventSchema = z.object({
  type: z.string(),
  data: z.unknown(),
});

export type ClerkWebhookUser = z.infer<typeof clerkWebhookUserSchema>;
export type ClerkWebhookEvent =
  | z.infer<typeof clerkUserChangedEventSchema>
  | z.infer<typeof clerkUserDeletedEventSchema>
  | z.infer<typeof ignoredClerkEventSchema>;
