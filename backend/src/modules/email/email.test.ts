import { describe, it, expect } from "vitest";
import { buildEmailJobId } from "./email.types.js";
import { sendEmailSchema } from "./email.validation.js";

describe("buildEmailJobId", () => {
  it("is deterministic for the same invoice, type and recipient", () => {
    const a = buildEmailJobId("inv1", "invoice", "a@b.com");
    const b = buildEmailJobId("inv1", "invoice", "a@b.com");
    expect(a).toBe(b);
  });

  it("normalizes recipient casing so duplicates collapse", () => {
    expect(buildEmailJobId("inv1", "invoice", "A@B.com")).toBe(
      buildEmailJobId("inv1", "invoice", "a@b.com")
    );
  });

  it("differs by type and by recipient", () => {
    expect(buildEmailJobId("inv1", "invoice", "a@b.com")).not.toBe(
      buildEmailJobId("inv1", "reminder", "a@b.com")
    );
    expect(buildEmailJobId("inv1", "invoice", "a@b.com")).not.toBe(
      buildEmailJobId("inv1", "invoice", "c@d.com")
    );
  });
});

describe("sendEmailSchema", () => {
  it("accepts an empty body (all fields optional)", () => {
    expect(sendEmailSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a valid override recipient and message", () => {
    expect(
      sendEmailSchema.safeParse({ to: "client@example.com", message: "Please pay soon" }).success
    ).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(sendEmailSchema.safeParse({ to: "not-an-email" }).success).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(sendEmailSchema.safeParse({ html: "<b>hi</b>" }).success).toBe(false);
  });

  it("bounds message length", () => {
    expect(sendEmailSchema.safeParse({ message: "a".repeat(2001) }).success).toBe(false);
  });
});
