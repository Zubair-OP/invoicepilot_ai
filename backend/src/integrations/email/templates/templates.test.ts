import { describe, it, expect } from "vitest";
import { renderEmail } from "./index.js";
import type { InvoiceEmailData } from "./shared.js";
import type { EmailType } from "../../../common/types/index.js";

function mockData(overrides: Partial<InvoiceEmailData> = {}): InvoiceEmailData {
  return {
    businessName: "Acme Studios",
    customerName: "Jane Client",
    invoiceNumber: "INV-202608-0001",
    total: 5900,
    currency: "USD",
    issuedAt: new Date("2026-08-01T00:00:00Z"),
    dueDate: new Date("2026-08-31T00:00:00Z"),
    ...overrides,
  };
}

const types: EmailType[] = ["invoice", "reminder", "payment_received"];

describe("email templates", () => {
  for (const type of types) {
    describe(type, () => {
      it("renders subject, html and a text fallback", () => {
        const email = renderEmail(type, mockData());
        expect(email.subject).toContain("INV-202608-0001");
        expect(email.html).toContain("<!DOCTYPE html>");
        expect(email.html).toContain("INV-202608-0001");
        expect(email.text.length).toBeGreaterThan(0);
        expect(email.text).toContain("INV-202608-0001");
      });

      it("includes the customer name and formatted amount", () => {
        const email = renderEmail(type, mockData());
        expect(email.html).toContain("Jane Client");
        expect(email.html).toContain("$5,900.00");
        expect(email.text).toContain("Jane Client");
      });

      it("escapes HTML in the customer name (XSS defense)", () => {
        const email = renderEmail(type, mockData({ customerName: "<script>alert(1)</script>" }));
        expect(email.html).not.toContain("<script>alert(1)</script>");
        expect(email.html).toContain("&lt;script&gt;");
      });

      it("escapes HTML in the business name and custom message", () => {
        const email = renderEmail(
          type,
          mockData({ businessName: "<b>Evil</b>", message: '<img src=x onerror="alert(1)">' })
        );
        expect(email.html).not.toContain("<b>Evil</b>");
        expect(email.html).not.toContain("<img src=x onerror");
        expect(email.html).toContain("&lt;");
      });

      it("makes no external network references", () => {
        const email = renderEmail(type, mockData());
        expect(email.html).not.toMatch(/https?:\/\//);
      });

      it("omits the message block when no message is provided", () => {
        const email = renderEmail(type, mockData());
        expect(email.html).not.toContain("border-left: 3px solid #1a1a2e");
      });
    });
  }
});
