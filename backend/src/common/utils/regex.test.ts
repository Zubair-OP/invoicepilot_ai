import { describe, it, expect } from "vitest";
import { escapeRegex } from "./regex.js";

describe("escapeRegex", () => {
  it("escapes regex metacharacters", () => {
    expect(escapeRegex("(a+)+$")).toBe("\\(a\\+\\)\\+\\$");
    expect(escapeRegex("a.b[c]")).toBe("a\\.b\\[c\\]");
    expect(escapeRegex("1{2,}?")).toBe("1\\{2,\\}\\?");
  });

  it("leaves plain search terms unchanged", () => {
    expect(escapeRegex("Acme Corp")).toBe("Acme Corp");
    expect(escapeRegex("INV-2026-0001")).toBe("INV-2026-0001");
  });

  it("neutralises a catastrophic-backtracking payload so it matches literally", () => {
    // `(a+)+$` interpolated raw is a ReDoS vector. Escaped, it is a plain
    // literal that the regex engine can match in linear time.
    const escaped = escapeRegex("(a+)+$");
    const re = new RegExp(`^${escaped}$`, "i");
    expect(re.test("(a+)+$")).toBe(true);
    expect(re.test("aaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toBe(false);
  });
});
