import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { env } from "../../config/env.js";
import { User, Customer } from "../../database/models/index.js";
import { NotFoundError } from "../../common/errors/index.js";
import * as customersService from "./customers.service.js";

// customers.service → billing (recordUsage) → redis. Mock the cache so no
// real Redis connection is needed and usage calls resolve immediately.
const redisMock = vi.hoisted(() => ({
  cacheGetInt: vi.fn(),
  cacheSetInt: vi.fn(),
  cacheIncrement: vi.fn(),
  cacheDelete: vi.fn(),
}));

vi.mock("../../common/cache/redis.js", () => redisMock);

const PREFIX = "iso_customers";

describe("customer tenant isolation", () => {
  let ownerId: string;
  let otherId: string;
  let customerId: string;

  beforeAll(async () => {
    await mongoose.connect(env.MONGO_URI);
  });

  afterAll(async () => {
    await User.deleteMany({ clerkId: { $regex: `^${PREFIX}` } });
    await Customer.deleteMany({ name: { $regex: /^Iso Acme/ } });
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await User.deleteMany({ clerkId: { $regex: `^${PREFIX}` } });
    await Customer.deleteMany({ name: { $regex: /^Iso Acme/ } });

    redisMock.cacheGetInt.mockReset().mockResolvedValue(null);
    redisMock.cacheSetInt.mockReset().mockResolvedValue(undefined);
    redisMock.cacheIncrement.mockReset().mockResolvedValue(1);
    redisMock.cacheDelete.mockReset().mockResolvedValue(undefined);

    const owner = await User.create({ clerkId: `${PREFIX}_owner`, email: "iso-owner@example.com", name: "Owner" });
    const other = await User.create({ clerkId: `${PREFIX}_other`, email: "iso-other@example.com", name: "Other" });
    ownerId = owner._id.toString();
    otherId = other._id.toString();

    const customer = await Customer.create({ userId: owner._id, name: "Iso Acme", email: "acme@example.com" });
    customerId = customer._id.toString();
  });

  it("lets the owner read their own customer", async () => {
    const customer = await customersService.getById(ownerId, customerId);
    expect(customer.name).toBe("Iso Acme");
  });

  it("does not let tenant B read tenant A's customer", async () => {
    await expect(customersService.getById(otherId, customerId)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("does not let tenant B update tenant A's customer", async () => {
    await expect(customersService.update(otherId, customerId, { name: "Hacked" })).rejects.toBeInstanceOf(NotFoundError);
    const fresh = await Customer.findById(customerId).lean();
    expect(fresh?.name).toBe("Iso Acme");
  });

  it("does not let tenant B delete tenant A's customer", async () => {
    await expect(customersService.remove(otherId, customerId)).rejects.toBeInstanceOf(NotFoundError);
    expect(await Customer.findById(customerId)).not.toBeNull();
  });

  it("tenant B's search never returns tenant A's customers", async () => {
    const pagination = { page: 1, limit: 20 };
    const result = await customersService.list(otherId, pagination, "Acme");
    expect(result.data).toHaveLength(0);
    expect(result.meta.total).toBe(0);
  });
});
