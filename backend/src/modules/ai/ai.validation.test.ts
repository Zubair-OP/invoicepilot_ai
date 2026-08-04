import { describe, it, expect } from "vitest";
import { generateInvoiceSchema, chatSchema, aiInvoiceOutputSchema } from "./ai.validation.js";

describe("AI request validation", () => {
  it("accepts a normal prompt", () => {
    expect(generateInvoiceSchema.safeParse({ prompt: "Bill Acme for 10h design" }).success).toBe(true);
  });

  it("rejects an empty prompt", () => {
    expect(generateInvoiceSchema.safeParse({ prompt: "" }).success).toBe(false);
  });

  it("caps prompt length at 2000 chars", () => {
    expect(generateInvoiceSchema.safeParse({ prompt: "a".repeat(2001) }).success).toBe(false);
    expect(generateInvoiceSchema.safeParse({ prompt: "a".repeat(2000) }).success).toBe(true);
  });

  it("bounds chat message count", () => {
    const many = Array.from({ length: 21 }, () => ({ role: "user" as const, content: "hi" }));
    expect(chatSchema.safeParse({ messages: many }).success).toBe(false);
    expect(chatSchema.safeParse({ messages: [{ role: "user", content: "hi" }] }).success).toBe(true);
  });
});

describe("AI output validation", () => {
  it("accepts a well-formed model response", () => {
    const result = aiInvoiceOutputSchema.safeParse({
      customerName: "Acme Corp",
      items: [{ description: "Design", quantity: 10, unitPrice: 75 }],
      currency: "USD",
      taxComponents: [{ name: "GST", rate: 18 }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a response with no items", () => {
    expect(
      aiInvoiceOutputSchema.safeParse({ customerName: "Acme", items: [] }).success
    ).toBe(false);
  });

  it("rejects a negative unit price", () => {
    expect(
      aiInvoiceOutputSchema.safeParse({
        customerName: "Acme",
        items: [{ description: "X", quantity: 1, unitPrice: -5 }],
      }).success
    ).toBe(false);
  });

  it("ignores model-supplied tax amounts (schema has no amount field)", () => {
    const result = aiInvoiceOutputSchema.safeParse({
      customerName: "Acme",
      items: [{ description: "X", quantity: 1, unitPrice: 100 }],
      taxComponents: [{ name: "GST", rate: 18, amount: 99999 }],
    });
    // Parse succeeds but the bogus amount is stripped — the server recomputes it.
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.taxComponents?.[0]).not.toHaveProperty("amount");
    }
  });
});
