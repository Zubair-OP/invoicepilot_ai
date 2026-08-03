import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { Webhook } from "svix";
import { env } from "../../config/env.js";
import { User } from "../../database/models/index.js";
import { UnauthorizedError } from "../../common/errors/index.js";
import { verifyClerkWebhookPayload, handleClerkWebhook } from "./clerk.service.js";

const redisMock = vi.hoisted(() => ({
  claimIdempotencyKey: vi.fn<() => Promise<boolean>>(),
  releaseIdempotencyKey: vi.fn<() => Promise<void>>(),
  invalidateAuthUser: vi.fn<() => Promise<void>>(),
}));

vi.mock("../../common/cache/redis.js", () => redisMock);

function clerkUserPayload(email = "webhook-user@example.com") {
  return {
    id: "user_phase2_webhook",
    email_addresses: [{ id: "email_1", email_address: email }],
    primary_email_address_id: "email_1",
    first_name: "Webhook",
    last_name: "User",
    username: null,
    image_url: "https://img.clerk.com/avatar.png",
    public_metadata: { role: "ADMIN" },
  };
}

describe("Clerk webhook service", () => {
  const testSecret = "whsec_test";

  beforeAll(async () => {
    await mongoose.connect(env.MONGO_URI);
  });

  afterAll(async () => {
    await User.deleteMany({ clerkId: /^user_phase2_webhook/ });
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await User.deleteMany({ clerkId: /^user_phase2_webhook/ });
    redisMock.claimIdempotencyKey.mockReset();
    redisMock.releaseIdempotencyKey.mockReset();
    redisMock.invalidateAuthUser.mockReset();
    redisMock.releaseIdempotencyKey.mockResolvedValue();
    redisMock.invalidateAuthUser.mockResolvedValue();
  });

  it("rejects invalid Svix signatures before any user write", async () => {
    const before = await User.countDocuments({ clerkId: "user_phase2_invalid" });

    expect(() =>
      verifyClerkWebhookPayload(
        Buffer.from(JSON.stringify({ type: "user.created", data: clerkUserPayload() })),
        {
          id: "evt_invalid",
          timestamp: "1",
          signature: "v1,invalid",
        },
        testSecret
      )
    ).toThrow(UnauthorizedError);

    await expect(User.countDocuments({ clerkId: "user_phase2_invalid" })).resolves.toBe(before);
  });

  it("skips replayed event IDs", async () => {
    redisMock.claimIdempotencyKey.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const payload = { type: "user.created", data: clerkUserPayload() };

    await expect(handleClerkWebhook(payload, "evt_replay")).resolves.toBe("handled");
    await expect(handleClerkWebhook(payload, "evt_replay")).resolves.toBe("duplicate");

    await expect(User.countDocuments({ clerkId: "user_phase2_webhook" })).resolves.toBe(1);
  });

  it("does not let Clerk webhook metadata set role", async () => {
    redisMock.claimIdempotencyKey.mockResolvedValue(true);

    await handleClerkWebhook({ type: "user.created", data: clerkUserPayload() }, "evt_role");

    const user = await User.findOne({ clerkId: "user_phase2_webhook" }).lean();
    expect(user?.role).toBe("USER");
  });

  it("soft deletes users on user.deleted", async () => {
    redisMock.claimIdempotencyKey.mockResolvedValue(true);
    await User.create({
      clerkId: "user_phase2_webhook",
      email: "delete-me@example.com",
      name: "Delete Me",
      role: "USER",
    });

    await handleClerkWebhook({ type: "user.deleted", data: { id: "user_phase2_webhook" } }, "evt_deleted");

    const user = await User.findOne({ clerkId: "user_phase2_webhook" }).lean();
    expect(user?.deletedAt).toBeInstanceOf(Date);
  });

  it("verifies a valid signed payload", () => {
    const payload = JSON.stringify({ type: "user.updated", data: clerkUserPayload("signed@example.com") });
    const webhook = new Webhook(testSecret);
    const timestamp = new Date();
    const signature = webhook.sign("evt_signed", timestamp, payload);

    const verified = verifyClerkWebhookPayload(
      Buffer.from(payload),
      {
        id: "evt_signed",
        timestamp: Math.floor(timestamp.getTime() / 1000).toString(),
        signature,
      },
      testSecret
    );

    expect(verified).toMatchObject({ type: "user.updated" });
  });
});
