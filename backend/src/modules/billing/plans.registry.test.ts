import { describe, it, expect } from "vitest";
import { PLANS, getPlanByKey, getPlanByPriceId, FREE_PLAN, type PlanDefinition } from "./plans.registry.js";
import { INVOICE_TEMPLATES } from "../templates/templates.registry.js";

describe("plans registry", () => {
  it("defines exactly the three expected plans", () => {
    expect(PLANS.map((p) => p.key)).toEqual(["free", "pro", "premium"]);
  });

  it("free has the documented starter limits", () => {
    const free = getPlanByKey("free")!;
    expect(free.limits).toMatchObject({ invoicesPerMonth: 5, customers: 10, aiGenerationsPerMonth: 10 });
    expect(free.limits.templatesAllowed).toEqual(["classic"]);
    expect(free.priceMonthly).toBe(0);
  });

  it("pro allows 100 invoices, unlimited customers, all templates", () => {
    const pro = getPlanByKey("pro")!;
    expect(pro.limits).toMatchObject({ invoicesPerMonth: 100, customers: -1, aiGenerationsPerMonth: 200 });
    expect(pro.priceMonthly).toBe(19);
  });

  it("premium is fully unlimited", () => {
    const premium = getPlanByKey("premium")!;
    expect(premium.limits).toMatchObject({ invoicesPerMonth: -1, customers: -1, aiGenerationsPerMonth: -1 });
    expect(premium.priceMonthly).toBe(49);
  });

  it("every template id allowed by a plan exists in the registry", () => {
    const validIds = INVOICE_TEMPLATES.map((t) => t.id);
    for (const plan of PLANS as readonly PlanDefinition[]) {
      for (const id of plan.limits.templatesAllowed) {
        expect(validIds).toContain(id);
      }
    }
  });

  it("lookups are safe for unknown keys and price ids", () => {
    expect(getPlanByKey("enterprise")).toBeUndefined();
    expect(getPlanByPriceId("price_unknown")).toBeUndefined();
    expect(FREE_PLAN.key).toBe("free");
  });
});