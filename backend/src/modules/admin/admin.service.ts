import { User, Invoice, Customer } from "../../database/models/index.js";
import { NotFoundError, ConflictError } from "../../common/errors/index.js";
import type { PaginationParams, UserRole, IUser } from "../../common/types/index.js";
import type { PaginatedResponse } from "../../common/response.js";
import { getSkipTake, buildPaginationMeta } from "../../common/utils/pagination.js";
import { escapeRegex } from "../../common/utils/regex.js";
import { paginatedResponse } from "../../common/response.js";
import { invalidateAuthUser } from "../../common/cache/redis.js";
import { logActivity } from "../activity/index.js";

interface ListUsersFilters {
  search?: string;
  role?: UserRole;
}

interface ChangeRoleInput {
  actorUserId: string;
  targetUserId: string;
  role: UserRole;
  ipAddress?: string;
}

type UserWithCounts = IUser & { counts: { invoices: number; customers: number } };

export async function listUsersAcrossTenants(
  pagination: PaginationParams,
  filters: ListUsersFilters
): Promise<PaginatedResponse<IUser>> {
  const filter: Record<string, unknown> = { deletedAt: { $exists: false } };

  if (filters.role) filter.role = filters.role;
  if (filters.search) {
    // User-controlled — escape before interpolation (ReDoS hardening, Phase 10).
    const escaped = escapeRegex(filters.search);
    filter.$or = [
      { name: { $regex: escaped, $options: "i" } },
      { email: { $regex: escaped, $options: "i" } },
    ];
  }

  const { skip, take } = getSkipTake(pagination);
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(take).lean(),
    User.countDocuments(filter),
  ]);

  return paginatedResponse(users, buildPaginationMeta(total, pagination));
}

export async function getUserAcrossTenants(userId: string): Promise<UserWithCounts> {
  const user = await User.findOne({ _id: userId, deletedAt: { $exists: false } }).lean<IUser>();
  if (!user) throw new NotFoundError("User");

  const [invoiceCount, customerCount] = await Promise.all([
    Invoice.countDocuments({ userId }),
    Customer.countDocuments({ userId }),
  ]);

  return { ...user, counts: { invoices: invoiceCount, customers: customerCount } };
}

export async function changeUserRole(input: ChangeRoleInput) {
  const target = await User.findOne({ _id: input.targetUserId, deletedAt: { $exists: false } });
  if (!target) throw new NotFoundError("User");

  if (input.actorUserId === target._id.toString() && input.role === "USER") {
    throw new ConflictError("Admins cannot demote themselves");
  }

  const previousRole = target.role;
  if (previousRole === input.role) return target;

  if (previousRole === "ADMIN" && input.role === "USER") {
    const adminCount = await User.countDocuments({ role: "ADMIN", deletedAt: { $exists: false } });
    if (adminCount <= 1) {
      throw new ConflictError("Cannot demote the last admin");
    }
  }

  target.role = input.role;
  await target.save();
  await invalidateAuthUser(target.clerkId);

  await logActivity({
    userId: input.actorUserId,
    action: "USER_ROLE_CHANGED",
    targetType: "User",
    targetId: target._id.toString(),
    metadata: {
      previousRole,
      newRole: input.role,
      targetEmail: target.email,
    },
    ipAddress: input.ipAddress,
  });

  return target;
}
