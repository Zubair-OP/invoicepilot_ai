import { describe, it, expect } from "vitest";
import { INVOICE_TEMPLATES, isValidTemplateId, DEFAULT_TEMPLATE_ID } from "./templates.registry.js";

describe("template registry", () => {
  it("ships classic, modern and minimal", () => {
    const ids = INVOICE_TEMPLATES.map((t) => t.id);
    expect(ids).toEqual(["classic", "modern", "minimal"]);
  });

  it("every template has id, name and description", () => {
    for (const t of INVOICE_TEMPLATES) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
    }
  });

  it("accepts a known template id", () => {
    expect(isValidTemplateId("classic")).toBe(true);
    expect(isValidTemplateId("modern")).toBe(true);
  });

  it("rejects an unknown template id", () => {
    expect(isValidTemplateId("fancy")).toBe(false);
    expect(isValidTemplateId("")).toBe(false);
  });

  it("defaults to a template that exists in the registry", () => {
    expect(isValidTemplateId(DEFAULT_TEMPLATE_ID)).toBe(true);
  });
});
