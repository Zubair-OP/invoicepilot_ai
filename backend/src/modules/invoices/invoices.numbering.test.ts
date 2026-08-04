import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { generateInvoiceNumber } from "./invoices.numbering.js";
import { Counter } from "../../database/models/Counter.js";
import { env } from "../../config/env.js";

describe("invoice numbering", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGO_URI);
  });

  afterAll(async () => {
    await Counter.deleteMany({ _id: /^invoice:test-/ });
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await Counter.deleteMany({ _id: /^invoice:test-/ });
  });

  it("produces sequential numbers for the same user", async () => {
    const at = new Date("2026-08-15T00:00:00Z");
    const a = await generateInvoiceNumber("test-userA", "INV", at);
    const b = await generateInvoiceNumber("test-userA", "INV", at);
    const c = await generateInvoiceNumber("test-userA", "INV", at);

    expect(a).toBe("INV-202608-0001");
    expect(b).toBe("INV-202608-0002");
    expect(c).toBe("INV-202608-0003");
  });

  it("gives each tenant its own sequence", async () => {
    const at = new Date("2026-08-15T00:00:00Z");
    const a = await generateInvoiceNumber("test-userA", "INV", at);
    const b = await generateInvoiceNumber("test-userB", "INV", at);

    // Both tenants start at 0001 — this is the multi-tenancy fix.
    expect(a).toBe("INV-202608-0001");
    expect(b).toBe("INV-202608-0001");
  });

  it("restarts the sequence each month", async () => {
    const aug = await generateInvoiceNumber("test-userA", "INV", new Date("2026-08-15T00:00:00Z"));
    const sep = await generateInvoiceNumber("test-userA", "INV", new Date("2026-09-01T00:00:00Z"));

    expect(aug).toBe("INV-202608-0001");
    expect(sep).toBe("INV-202609-0001");
  });

  it("applies a custom prefix without resetting the sequence", async () => {
    const at = new Date("2026-08-15T00:00:00Z");
    const a = await generateInvoiceNumber("test-userA", "INV", at);
    // Same user + month, different prefix: the counter key ignores the prefix, so
    // the sequence continues rather than restarting at 0001.
    const b = await generateInvoiceNumber("test-userA", "ACME", at);

    expect(a).toBe("INV-202608-0001");
    expect(b).toBe("ACME-202608-0002");
  });

  it("defaults to the INV prefix", async () => {
    const at = new Date("2026-08-15T00:00:00Z");
    const a = await generateInvoiceNumber("test-userA", undefined, at);
    expect(a).toBe("INV-202608-0001");
  });

  it("never issues a duplicate under concurrency", async () => {
    const at = new Date("2026-08-15T00:00:00Z");
    const results = await Promise.all(
      Array.from({ length: 25 }, () => generateInvoiceNumber("test-userA", "INV", at))
    );

    expect(new Set(results).size).toBe(25);
  });
});
