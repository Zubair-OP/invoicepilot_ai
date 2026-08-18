import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { env } from "../../config/env.js";
import { User, Invoice, Customer } from "../../database/models/index.js";
import { NotFoundError } from "../../common/errors/index.js";
import * as invoicesService from "./invoices.service.js";

// invoices.service → billing (recordUsage) → redis. Mock the cache.
const redisMock = vi.hoisted(() => ({
  cacheGetInt: vi.fn(),
  cacheSetInt: vi.fn(),
  cacheIncrement: vi.fn(),
  cacheDelete: vi.fn(),
}));

vi.mock("../../common/cache/redis.js", () => redisMock);

const PREFIX = "iso_invoices";
const INVOICE_PREFIX = "ISOINV-";

function createInvoice(userId: mongoose.Types.ObjectId, customerId: mongoose.Types.ObjectId, index = 0) {
  return Invoice.create({
    userId,
    customerId,
    invoiceNumber: `${INVOICE_PREFIX}${index}`,
    status: "DRAFT",
    currency: "USD",
    subtotal: 100,
    tax: 0,
    discount: 0,
    total: 100,
    items: [{ description: "iso item", quantity: 1, unitPrice: 100, total: 100 }],
    dueDate: new Date(Date.now() + 86400000),
    issuedAt: new Date(),
  });
}

describe("invoice tenant isolation", () => {
  let ownerId: string;
  let otherId: string;
  let invoiceId: string;

  beforeAll(async () => {
    await mongoose.connect(env.MONGO_URI);
  });

  afterAll(async () => {
    await User.deleteMany({ clerkId: { $regex: `^${PREFIX}` } });
    await Invoice.deleteMany({ invoiceNumber: { $regex: `^${INVOICE_PREFIX}` } });
    await Customer.deleteMany({ name: { $regex: /^Iso Invoice/ } });
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await User.deleteMany({ clerkId: { $regex: `^${PREFIX}` } });
    await Invoice.deleteMany({ invoiceNumber: { $regex: `^${INVOICE_PREFIX}` } });
    await Customer.deleteMany({ name: { $regex: /^Iso Invoice/ } });

    redisMock.cacheGetInt.mockReset().mockResolvedValue(null);
    redisMock.cacheSetInt.mockReset().mockResolvedValue(undefined);
    redisMock.cacheIncrement.mockReset().mockResolvedValue(1);
    redisMock.cacheDelete.mockReset().mockResolvedValue(undefined);

    const owner = await User.create({ clerkId: `${PREFIX}_owner`, email: "inv-owner@example.com", name: "Owner" });
    const other = await User.create({ clerkId: `${PREFIX}_other`, email: "inv-other@example.com", name: "Other" });
    ownerId = owner._id.toString();
    otherId = other._id.toString();

    const customer = await Customer.create({ userId: owner._id, name: "Iso Invoice Client" });
    const invoice = await createInvoice(owner._id, customer._id);
    invoiceId = invoice._id.toString();
  });

  it("lets the owner read their own invoice", async () => {
    const invoice = await invoicesService.getById(ownerId, invoiceId);
    expect(invoice._id.toString()).toBe(invoiceId);
  });

  it("does not let tenant B read tenant A's invoice", async () => {
    await expect(invoicesService.getById(otherId, invoiceId)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("does not let tenant B update tenant A's invoice", async () => {
    await expect(invoicesService.update(otherId, invoiceId, { notes: "tampered" })).rejects.toBeInstanceOf(NotFoundError);
    const fresh = await Invoice.findById(invoiceId).lean();
    expect(fresh?.notes).toBeUndefined();
  });

  it("does not let tenant B delete tenant A's invoice", async () => {
    await expect(invoicesService.remove(otherId, invoiceId)).rejects.toBeInstanceOf(NotFoundError);
    expect(await Invoice.findById(invoiceId)).not.toBeNull();
  });

  it("does not let tenant B transition tenant A's invoice status", async () => {
    await expect(invoicesService.markAsSent(otherId, invoiceId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(invoicesService.markAsPaid(otherId, invoiceId)).rejects.toBeInstanceOf(NotFoundError);
    const fresh = await Invoice.findById(invoiceId).lean();
    expect(fresh?.status).toBe("DRAFT");
  });

  it("tenant B's invoice list never includes tenant A's invoices", async () => {
    const result = await invoicesService.list(otherId, { page: 1, limit: 20 }, { search: "ISOINV" });
    expect(result.data).toHaveLength(0);
    expect(result.meta.total).toBe(0);
  });

  it("does not let a tenant create an invoice for another tenant's customer", async () => {
    const otherCustomer = await Customer.create({
      userId: new mongoose.Types.ObjectId(otherId),
      name: "Iso Invoice Other Client",
    });

    await expect(
      invoicesService.create(ownerId, {
        customerId: otherCustomer._id.toString(),
        discount: 0,
        items: [{ description: "cross tenant", quantity: 1, unitPrice: 100 }],
      })
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
