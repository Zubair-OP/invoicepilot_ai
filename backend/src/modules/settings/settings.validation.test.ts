import { describe, it, expect } from "vitest";
import { updateSettingsSchema } from "./settings.validation.js";

describe("updateSettingsSchema", () => {
  it("accepts a known templateId", () => {
    const result = updateSettingsSchema.safeParse({ templateId: "modern" });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown templateId (drives the 422)", () => {
    const result = updateSettingsSchema.safeParse({ templateId: "does-not-exist" });
    expect(result.success).toBe(false);
  });

  it("allows a partial update of a single field", () => {
    const result = updateSettingsSchema.safeParse({ invoicePrefix: "ACME" });
    expect(result.success).toBe(true);
  });

  it("rejects a currency that is not 3 letters", () => {
    expect(updateSettingsSchema.safeParse({ defaultCurrency: "US" }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ defaultCurrency: "USD" }).success).toBe(true);
  });

  it("rejects an empty invoice prefix", () => {
    expect(updateSettingsSchema.safeParse({ invoicePrefix: "" }).success).toBe(false);
  });

  it("rejects negative or fractional payment terms", () => {
    expect(updateSettingsSchema.safeParse({ defaultPaymentTermsDays: -1 }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ defaultPaymentTermsDays: 1.5 }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ defaultPaymentTermsDays: 15 }).success).toBe(true);
  });

  it("rejects unknown keys", () => {
    expect(updateSettingsSchema.safeParse({ role: "ADMIN" }).success).toBe(false);
  });

  it("caps tax components at five", () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ name: `T${i}`, rate: 1 }));
    expect(updateSettingsSchema.safeParse({ defaultTaxComponents: six }).success).toBe(false);
  });
});
