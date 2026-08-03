import { Webhook } from "svix";
import { z } from "zod";
import { env } from "../../config/env.js";
import { UnauthorizedError, ValidationError, AppError } from "../../common/errors/index.js";
import { User } from "../../database/models/index.js";
import { mapClerkUser, type ClerkUserLike } from "../../integrations/clerk/clerk.js";
import { invalidateAuthUser, claimIdempotencyKey, releaseIdempotencyKey } from "../../common/cache/redis.js";
import { logger } from "../../observability/logger.js";
import {
  clerkUserChangedEventSchema,
  clerkUserDeletedEventSchema,
  ignoredClerkEventSchema,
  type ClerkWebhookUser,
} from "./clerk.validation.js";

const SVIX_TTL_SECONDS = 24 * 60 * 60;

type ParsedClerkEvent =
  | { type: "user.created" | "user.updated"; data: ClerkWebhookUser }
  | { type: "user.deleted"; data: { id: string } }
  | { type: "ignored"; eventType: string };

interface SvixHeaders {
  id: string;
  timestamp: string;
  signature: string;
}

export function verifyClerkWebhookPayload(
  body: Buffer,
  headers: SvixHeaders,
  secret = env.CLERK_WEBHOOK_SECRET
): unknown {
  if (!secret) {
    throw new AppError("Clerk webhook secret is not configured", 503, "SERVICE_UNAVAILABLE");
  }

  try {
    return new Webhook(secret).verify(body.toString("utf8"), {
      "svix-id": headers.id,
      "svix-timestamp": headers.timestamp,
      "svix-signature": headers.signature,
    });
  } catch (error) {
    logger.warn({ err: error, eventId: headers.id }, "Invalid Clerk webhook signature");
    throw new UnauthorizedError("Invalid webhook signature");
  }
}

export async function handleClerkWebhook(verifiedPayload: unknown, eventId: string): Promise<"handled" | "ignored" | "duplicate"> {
  const event = parseEvent(verifiedPayload);
  const claimed = await claimIdempotencyKey(`clerk:${eventId}`, SVIX_TTL_SECONDS);
  if (!claimed) return "duplicate";

  try {
    switch (event.type) {
      case "user.created":
      case "user.updated":
        await upsertUserFromClerk(event.data);
        return "handled";
      case "user.deleted":
        await softDeleteUserFromClerk(event.data.id);
        return "handled";
      case "ignored":
        logger.debug({ eventType: event.eventType }, "Ignoring Clerk webhook event");
        return "ignored";
    }
  } catch (error) {
    await releaseIdempotencyKey(`clerk:${eventId}`);
    throw error;
  }
}

function parseEvent(payload: unknown): ParsedClerkEvent {
  const base = ignoredClerkEventSchema.safeParse(payload);
  if (!base.success) {
    throw new ValidationError(zodErrorsToFieldMap(base.error));
  }

  if (base.data.type === "user.created" || base.data.type === "user.updated") {
    const result = clerkUserChangedEventSchema.safeParse(payload);
    if (result.success) return result.data;
    throw new ValidationError(zodErrorsToFieldMap(result.error));
  }

  if (base.data.type === "user.deleted") {
    const result = clerkUserDeletedEventSchema.safeParse(payload);
    if (result.success) return result.data;
    throw new ValidationError(zodErrorsToFieldMap(result.error));
  }

  return { type: "ignored", eventType: base.data.type };
}

function zodErrorsToFieldMap(error: z.ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "body";
    errors[path] = [...(errors[path] ?? []), issue.message];
  }
  return errors;
}

function normalizeWebhookUser(user: ClerkWebhookUser): ClerkUserLike {
  return {
    id: user.id,
    emailAddresses: user.email_addresses.map((email) => ({
      id: email.id,
      emailAddress: email.email_address,
    })),
    primaryEmailAddressId: user.primary_email_address_id ?? null,
    firstName: user.first_name ?? null,
    lastName: user.last_name ?? null,
    username: user.username ?? null,
    imageUrl: user.image_url,
    publicMetadata: user.public_metadata ?? null,
  };
}

async function upsertUserFromClerk(user: ClerkWebhookUser): Promise<void> {
  const profile = mapClerkUser(normalizeWebhookUser(user));

  await User.updateOne(
    { clerkId: profile.clerkId },
    {
      $set: {
        email: profile.email,
        name: profile.name,
        avatar: profile.avatar,
      },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  await invalidateAuthUser(profile.clerkId);
}

async function softDeleteUserFromClerk(clerkId: string): Promise<void> {
  await User.updateOne({ clerkId }, { $set: { deletedAt: new Date() } });
  await invalidateAuthUser(clerkId);
}
