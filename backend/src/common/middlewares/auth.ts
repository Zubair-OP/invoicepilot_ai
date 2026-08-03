import { Request, Response, NextFunction } from "express";
import { verifyToken } from "@clerk/backend";
import { UnauthorizedError, ForbiddenError } from "../errors/index.js";
import type { UserRole } from "../types/index.js";
import { env } from "../../config/env.js";
import { User } from "../../database/models/index.js";
import { fetchClerkProfile } from "../../integrations/clerk/clerk.js";
import { isDuplicateKeyError } from "../utils/mongo.js";
import { logger } from "../../observability/logger.js";

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

    const user = await resolveUser(clerkId);

    req.user = {
      userId: user._id.toString(),
      clerkId: user.clerkId,
      role: user.role,
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Looks up the local user by Clerk ID, provisioning one from Clerk's API if this
 * is their first request. Role always comes from Mongo — Clerk metadata seeds it
 * at creation, but promotion to ADMIN is a deliberate server-side action.
 */
async function resolveUser(clerkId: string) {
  const existing = await User.findOne({ clerkId });
  if (existing) return existing;

  const profile = await fetchClerkProfile(clerkId);

  logger.info({ clerkId, email: profile.email }, "Provisioning new user from Clerk");

  try {
    return await User.create(profile);
  } catch (error) {
    // Two concurrent first-requests from the same account can both miss the
    // findOne and race to insert. The unique index on clerkId makes one of them
    // fail with E11000; that loser just reads the winner's document.
    if (isDuplicateKeyError(error)) {
      const raced = await User.findOne({ clerkId });
      if (raced) return raced;
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
