import { createClerkClient, type User as ClerkUser } from "@clerk/backend";
import { env } from "../../config/env.js";
import type { UserRole } from "../../common/types/index.js";

/**
 * Single shared Clerk Backend API client.
 *
 * Centralised here rather than instantiated per-module so the secret key is read
 * once and both the auth middleware and the users service share one HTTP agent.
 */
export const clerkClient = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

export interface ClerkProfile {
  clerkId: string;
  email: string;
  name: string;
  avatar?: string;
  role: UserRole;
}

/**
 * Projects a Clerk user onto the local user shape.
 *
 * Clerk allows multiple email addresses; we take the primary one and fall back to
 * the first available. Role is read from publicMetadata so an admin can be
 * designated in the Clerk dashboard, but it is only used when *creating* a local
 * user — see resolveUser() for why Mongo stays authoritative afterwards.
 */
export function mapClerkUser(clerkUser: ClerkUser): ClerkProfile {
  const email =
    clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress;

  if (!email) {
    throw new Error("Clerk account has no email address");
  }

  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() ||
    clerkUser.username ||
    email.split("@")[0];

  return {
    clerkId: clerkUser.id,
    email,
    name,
    avatar: clerkUser.imageUrl,
    role: clerkUser.publicMetadata?.role === "ADMIN" ? "ADMIN" : "USER",
  };
}

export async function fetchClerkProfile(clerkId: string): Promise<ClerkProfile> {
  const clerkUser = await clerkClient.users.getUser(clerkId);
  return mapClerkUser(clerkUser);
}
