import { describe, it, expect } from "vitest";
import { dashboardRangeSchema, resolveDashboardRange } from "./dashboard.validation.js";

describe("dashboard range validation", () => {
  it("accepts a valid ISO range", () => {
    const result = dashboardRangeSchema.safeParse({
      from: "2026-07-01T00:00:00.000Z",
      to: "2026-07-30T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty query (defaults to last 30 days)", () => {
    const result = dashboardRangeSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects non-ISO values", () => {
    const result = dashboardRangeSchema.safeParse({ from: "07/01/2026", to: "2026-07-30T00:00:00.000Z" });
    expect(result.success).toBe(false);
  });

  it("rejects from >= to", () => {
    const result = dashboardRangeSchema.safeParse({
      from: "2026-07-30T00:00:00.000Z",
      to: "2026-07-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const message = result.error.issues[0]?.message;
      expect(message).toContain("from must be before to");
    }
  });

  it("rejects ranges longer than 366 days", () => {
    const result = dashboardRangeSchema.safeParse({
      from: "2025-01-01T00:00:00.000Z",
      to: "2027-01-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const message = result.error.issues[0]?.message;
      expect(message).toContain("cannot exceed 366 days");
    }
  });

  it("rejects a future from when to is omitted", () => {
    const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const result = dashboardRangeSchema.safeParse({ from: future });
    expect(result.success).toBe(false);
    if (!result.success) {
      const message = result.error.issues[0]?.message;
      expect(message).toContain("from must not be in the future");
    }
  });
});

describe("resolveDashboardRange", () => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  it("defaults to the last 30 days", () => {
    const before = Date.now();
    const range = resolveDashboardRange();
    expect(range.to.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(range.from.getTime()).toBe(range.to.getTime() - 30 * DAY_MS);
  });

  it("derives from from an explicit to", () => {
    const to = "2026-07-30T00:00:00.000Z";
    const range = resolveDashboardRange(undefined, to);
    expect(range.to.toISOString()).toBe(to);
    expect(range.from.getTime()).toBe(new Date(to).getTime() - 30 * DAY_MS);
  });

  it("keeps an explicit from and to", () => {
    const range = resolveDashboardRange("2026-07-01T00:00:00.000Z", "2026-07-30T00:00:00.000Z");
    expect(range.from.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-07-30T00:00:00.000Z");
  });
});
