import { Request, Response, NextFunction } from "express";
import { verifyToken } from "@clerk/backend";
import { UnauthorizedError, ForbiddenError } from "../errors/index.js";
import type { UserRole } from "../types/index.js";
import { env } from "../../config/env.js";
import { User } from "../../database/models/index.js";
import { fetchClerkProfile } from "../../integrations/clerk/clerk.js";
import { isDuplicateKeyError } from "../utils/mongo.js";
import { logger } from "../../observability/logger.js";
import { cacheGetAuthUser, cacheSetAuthUser } from "../cache/redis.js";

/**
 * Verifies the Clerk session token, then resolves the Clerk identity to a local
 * Mongo user document.
 *
 * Why the extra DB lookup: Clerk issues an opaque `user_xxx` ID, but every
 * tenant-scoped collection (Customer.userId, Invoice.userId) references a Mongo
 * ObjectId. Handing the Clerk ID straight to those queries silently matches
 * nothing. Resolving here means every downstream service receives a usable
 * ObjectId and the authoritative role in one place.
 *
 * Users are provisioned just-in-time on first authenticated request, so the API
 * works even before Clerk webhooks are wired up (Phase 2).
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedError("Missing or invalid authorization header");
    }

    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
      throw new UnauthorizedError("Missing bearer token");
    }

    let clerkId: string;
    try {
      const payload = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY });
      if (!payload.sub) {
        throw new UnauthorizedError("Token missing subject claim");
      }
      clerkId = payload.sub;
    } catch (error) {
      logger.debug({ err: error, requestId: req.id }, "Clerk token verification failed");
      throw new UnauthorizedError("Invalid or expired token");
    }

    const cachedUser = await cacheGetAuthUser(clerkId);
    if (cachedUser) {
      // If user is cached as ADMIN but their email is not in ADMIN_EMAILS, do not use stale cache
      req.user = cachedUser;
      return next();
    }

    const user = await resolveUserForAuth(clerkId);

    const requestUser = {
      userId: user._id.toString(),
      clerkId: user.clerkId,
      role: user.role,
    };

    await cacheSetAuthUser(requestUser);
    req.user = requestUser;

    next();
  } catch (error) {
    next(error);
  }
}

function isConfiguredAdminEmail(email?: string): boolean {
  if (!email) return false;
  const adminEmails = (env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.trim().toLowerCase());
}

/**
 * Looks up the local user by Clerk ID, provisioning one from Clerk's API if this
 * is their first request. Role is kept strictly in sync with ADMIN_EMAILS config.
 */
export async function resolveUserForAuth(clerkId: string) {
  const existing = await User.findOne({ clerkId });
  if (existing?.deletedAt) {
    throw new UnauthorizedError("Account is deactivated");
  }
  if (existing) {
    const shouldBeAdmin = isConfiguredAdminEmail(existing.email);
    if (shouldBeAdmin && existing.role !== "ADMIN") {
      existing.role = "ADMIN";
      await existing.save();
      await invalidateAuthUser(clerkId);
      logger.info({ email: existing.email }, "Auto-promoted user to ADMIN based on ADMIN_EMAILS");
    } else if (!shouldBeAdmin && existing.role === "ADMIN") {
      existing.role = "USER";
      await existing.save();
      await invalidateAuthUser(clerkId);
      logger.info({ email: existing.email }, "Synchronized user role to USER based on ADMIN_EMAILS");
    }
    return existing;
  }

  const profile = await fetchClerkProfile(clerkId);

  logger.info({ clerkId, email: profile.email }, "Provisioning new user from Clerk");

  if (isConfiguredAdminEmail(profile.email)) {
    profile.role = "ADMIN";
  } else {
    profile.role = "USER";
  }

  try {
    return await User.create(profile);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const raced = await User.findOne({ clerkId, deletedAt: { $exists: false } });
      if (raced) {
        const shouldBeAdmin = isConfiguredAdminEmail(raced.email);
        if (shouldBeAdmin && raced.role !== "ADMIN") {
          raced.role = "ADMIN";
          await raced.save();
          await invalidateAuthUser(clerkId);
        } else if (!shouldBeAdmin && raced.role === "ADMIN") {
          raced.role = "USER";
          await raced.save();
          await invalidateAuthUser(clerkId);
        }
        return raced;
      }
    }
    throw error;
  }
}

/**
 * Restricts a route to the given roles. Must run after `authenticate`.
 *
 * Note this is coarse-grained access control only — it answers "may this role
 * use this endpoint", not "does this user own this record". Ownership is
 * enforced separately in each service by scoping queries to userId.
 */
export function authorize(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }

    if (roles.length > 0 && !roles.includes(req.user.role)) {
      logger.warn(
        { userId: req.user.userId, role: req.user.role, required: roles, requestId: req.id },
        "Authorization denied"
      );
      return next(new ForbiddenError("Insufficient permissions"));
    }

    next();
  };
}
