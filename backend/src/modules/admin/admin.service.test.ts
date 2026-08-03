import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import type { Request, Response, NextFunction } from "express";
import { env } from "../../config/env.js";
import { User, ActivityLog } from "../../database/models/index.js";
import { authorize } from "../../common/middlewares/auth.js";
import { ConflictError, ForbiddenError, UnauthorizedError } from "../../common/errors/index.js";
import * as adminService from "./admin.service.js";
import { resolveUserForAuth } from "../../common/middlewares/auth.js";

const redisMock = vi.hoisted(() => ({
  cacheGetAuthUser: vi.fn(),
  cacheSetAuthUser: vi.fn(),
  invalidateAuthUser: vi.fn<() => Promise<void>>(),
}));

vi.mock("../../common/cache/redis.js", () => redisMock);

describe("admin user management", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGO_URI);
  });

  afterAll(async () => {
    await User.deleteMany({ clerkId: /^user_phase2_admin_/ });
    await ActivityLog.deleteMany({ action: "USER_ROLE_CHANGED" });
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await User.deleteMany({ clerkId: /^user_phase2_admin_/ });
    await ActivityLog.deleteMany({ action: "USER_ROLE_CHANGED" });
    redisMock.invalidateAuthUser.mockReset();
    redisMock.invalidateAuthUser.mockResolvedValue();
  });

  it("rejects non-admin authorization", () => {
    const req = {
      id: "req_1",
      user: { userId: new mongoose.Types.ObjectId().toString(), clerkId: "user_phase2_admin_regular", role: "USER" },
    } as Request;
    const res = {} as Response;
    const next: NextFunction = vi.fn();

    authorize("ADMIN")(req, res, next);

    const error = vi.mocked(next).mock.calls[0]?.[0];
    expect(error).toBeInstanceOf(ForbiddenError);
  });

  it("rejects unauthenticated authorization", () => {
    const req = { id: "req_1" } as Request;
    const res = {} as Response;
    const next: NextFunction = vi.fn();

    authorize("ADMIN")(req, res, next);

    const error = vi.mocked(next).mock.calls[0]?.[0];
    expect(error).toBeInstanceOf(UnauthorizedError);
  });

  it("rejects self-demotion", async () => {
    const admin = await User.create({
      clerkId: "user_phase2_admin_self",
      email: "admin-self@example.com",
      name: "Admin Self",
      role: "ADMIN",
    });

    await expect(
      adminService.changeUserRole({
        actorUserId: admin._id.toString(),
        targetUserId: admin._id.toString(),
        role: "USER",
      })
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("rejects demoting the last admin", async () => {
    const admin = await User.create({
      clerkId: "user_phase2_admin_last",
      email: "admin-last@example.com",
      name: "Admin Last",
      role: "ADMIN",
    });

    await expect(
      adminService.changeUserRole({
        actorUserId: new mongoose.Types.ObjectId().toString(),
        targetUserId: admin._id.toString(),
        role: "USER",
      })
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("writes ActivityLog and invalidates cache for role changes", async () => {
    const actor = await User.create({
      clerkId: "user_phase2_admin_actor",
      email: "admin-actor@example.com",
      name: "Admin Actor",
      role: "ADMIN",
    });
    const target = await User.create({
      clerkId: "user_phase2_admin_target",
      email: "admin-target@example.com",
      name: "Admin Target",
      role: "USER",
    });

    await adminService.changeUserRole({
      actorUserId: actor._id.toString(),
      targetUserId: target._id.toString(),
      role: "ADMIN",
      ipAddress: "127.0.0.1",
    });

    const log = await ActivityLog.findOne({ action: "USER_ROLE_CHANGED", targetId: target._id }).lean();
    const updatedTarget = await User.findById(target._id).lean();

    expect(updatedTarget?.role).toBe("ADMIN");
    expect(log?.userId.toString()).toBe(actor._id.toString());
    expect(log?.metadata).toMatchObject({ previousRole: "USER", newRole: "ADMIN" });
    expect(redisMock.invalidateAuthUser).toHaveBeenCalledWith("user_phase2_admin_target");
  });

  it("does not resolve soft-deleted users for auth", async () => {
    await User.create({
      clerkId: "user_phase2_admin_deleted",
      email: "deleted-auth@example.com",
      name: "Deleted Auth",
      role: "USER",
      deletedAt: new Date(),
    });

    await expect(resolveUserForAuth("user_phase2_admin_deleted")).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
