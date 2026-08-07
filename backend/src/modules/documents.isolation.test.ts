import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { User, Invoice, Customer } from "../database/models/index.js";
import { NotFoundError } from "../common/errors/index.js";
import * as pdfService from "./pdf/pdf.service.js";
import * as emailService from "./email/email.service.js";
import * as remindersService from "./reminders/reminders.service.js";

// reminders.service uses the Redis rate limiter; email.service + reminders
// enqueue on the BullMQ email queue. Mock both so these tests need no Redis.
const redisMock = vi.hoisted(() => ({
  incrementRateLimit: vi.fn(),
  claimIdempotencyKey: vi.fn(),
  releaseIdempotencyKey: vi.fn(),
  invalidateAuthUser: vi.fn(),
}));

const queueMock = vi.hoisted(() => ({
  emailQueue: { add: vi.fn() },
  invoiceQueue: { add: vi.fn() },
  reminderQueue: { add: vi.fn() },
  closeQueues: vi.fn(),
}));

vi.mock("../common/cache/redis.js", () => redisMock);
vi.mock("../jobs/queues.js", () => queueMock);

const PREFIX = "iso_documents";
const INVOICE_PREFIX = "ISODOC-";

function createInvoice(userId: mongoose.Types.ObjectId, customerId: mongoose.Types.ObjectId, status = "DRAFT") {
  return Invoice.create({
    userId,
    customerId,
    invoiceNumber: `${INVOICE_PREFIX}${Date.now()}`,
    status,
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

describe("document access paths (pdf / email / reminders) tenant isolation", () => {
  let ownerId: string;
  let otherId: string;
  let invoiceId: string;

  beforeAll(async () => {
    await mongoose.connect(env.MONGO_URI);
  });

  afterAll(async () => {
    await User.deleteMany({ clerkId: { $regex: `^${PREFIX}` } });
    await Invoice.deleteMany({ invoiceNumber: { $regex: `^${INVOICE_PREFIX}` } });
    await Customer.deleteMany({ name: { $regex: /^Iso Doc Client/ } });
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await User.deleteMany({ clerkId: { $regex: `^${PREFIX}` } });
    await Invoice.deleteMany({ invoiceNumber: { $regex: `^${INVOICE_PREFIX}` } });
    await Customer.deleteMany({ name: { $regex: /^Iso Doc Client/ } });

    redisMock.incrementRateLimit.mockReset().mockResolvedValue({ allowed: true, count: 1, limit: 1 });
    redisMock.claimIdempotencyKey.mockReset().mockResolvedValue(true);
    redisMock.releaseIdempotencyKey.mockReset().mockResolvedValue(undefined);
    redisMock.invalidateAuthUser.mockReset().mockResolvedValue(undefined);
    queueMock.emailQueue.add.mockReset().mockImplementation(async (_name: string, _data: unknown, opts?: { jobId?: string }) => ({
      id: opts?.jobId ?? "iso-job-1",
    }));

    const owner = await User.create({ clerkId: `${PREFIX}_owner`, email: "doc-owner@example.com", name: "Owner" });
    const other = await User.create({ clerkId: `${PREFIX}_other`, email: "doc-other@example.com", name: "Other" });
    ownerId = owner._id.toString();
    otherId = other._id.toString();

    const customer = await Customer.create({ userId: owner._id, name: "Iso Doc Client", email: "client@example.com" });
    const invoice = await createInvoice(owner._id, customer._id);
    invoiceId = invoice._id.toString();
  });

  describe("PDF (preview HTML — no browser needed)", () => {
    it("lets the owner render their invoice", async () => {
      const html = await pdfService.generateInvoiceHTMLForUser(ownerId, invoiceId);
      expect(html).toContain("ISODOC-");
    });

    it("does not let tenant B render tenant A's invoice", async () => {
      await expect(pdfService.generateInvoiceHTMLForUser(otherId, invoiceId)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("email delivery", () => {
    it("lets the owner enqueue an email for their invoice", async () => {
      const result = await emailService.queueInvoiceEmail(ownerId, invoiceId, "invoice", {});
      expect(result.queued).toBe(true);
      expect(result.invoiceId).toBe(invoiceId);
    });

    it("does not let tenant B enqueue an email for tenant A's invoice", async () => {
      await expect(emailService.queueInvoiceEmail(otherId, invoiceId, "invoice", {})).rejects.toBeInstanceOf(NotFoundError);
      expect(queueMock.emailQueue.add).not.toHaveBeenCalled();
    });
  });

  describe("manual reminders", () => {
    it("does not let tenant B manually remind tenant A's invoice", async () => {
      await expect(remindersService.sendManualReminder(otherId, invoiceId)).rejects.toBeInstanceOf(NotFoundError);
      expect(queueMock.emailQueue.add).not.toHaveBeenCalled();
    });

    it("lets the owner manually remind their own sent invoice", async () => {
      await Invoice.findByIdAndUpdate(invoiceId, { status: "SENT" });
      const result = await remindersService.sendManualReminder(ownerId, invoiceId);
      expect(result.queued).toBe(true);
      const fresh = await Invoice.findById(invoiceId).lean();
      expect(fresh?.remindersSent).toHaveLength(1);
    });
  });
});
