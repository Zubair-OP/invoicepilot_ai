import { describe, it, expect } from "vitest";
import { renderClassic } from "./templates/classic.js";
import { renderModern } from "./templates/modern.js";
import { renderMinimal } from "./templates/minimal.js";
import type { InvoiceDocument } from "../../database/models/Invoice.js";
import type { CustomerDocument } from "../../database/models/Customer.js";

// Minimal stand-ins for the Mongoose documents — the render functions only read
// plain fields, so a plain object cast is enough for a pure unit test.
function mockInvoice(overrides: Partial<InvoiceDocument> = {}): InvoiceDocument {
  return {
    invoiceNumber: "INV-202608-0001",
    status: "DRAFT",
    currency: "USD",
    subtotal: 5000,
    taxComponents: [{ name: "GST", rate: 18, amount: 900 }],
    tax: 900,
    discount: 0,
    total: 5900,
    notes: "Thanks for your business",
    items: [{ description: "Design work", quantity: 10, unitPrice: 500, total: 5000 }],
    issuedAt: new Date("2026-08-01T00:00:00Z"),
    dueDate: new Date("2026-08-31T00:00:00Z"),
    ...overrides,
  } as unknown as InvoiceDocument;
}

function mockCustomer(overrides: Partial<CustomerDocument> = {}): CustomerDocument {
  return {
    name: "Acme Corp",
    email: "billing@acme.com",
    address: "123 Business St",
    ...overrides,
  } as unknown as CustomerDocument;
}

const templates = [
  { name: "classic", render: renderClassic },
  { name: "modern", render: renderModern },
  { name: "minimal", render: renderMinimal },
];

describe("PDF templates", () => {
  for (const { name, render } of templates) {
    describe(name, () => {
      it("renders a complete invoice as HTML", () => {
        const html = render(mockInvoice(), mockCustomer());
        expect(html).toContain("<!DOCTYPE html>");
        expect(html).toContain("INV-202608-0001");
        expect(html).toContain("Acme Corp");
        expect(html).toContain("Design work");
      });

      it("escapes HTML in customer name (XSS defense)", () => {
        const html = render(mockInvoice(), mockCustomer({ name: "<script>alert(1)</script>" }));
        expect(html).not.toContain("<script>alert(1)</script>");
        expect(html).toContain("&lt;script&gt;");
      });

      it("escapes HTML in invoice notes", () => {
        const html = render(
          mockInvoice({ notes: '<img src=x onerror="alert(1)">' } as Partial<InvoiceDocument>),
          mockCustomer()
        );
        expect(html).not.toContain("<img src=x onerror");
        expect(html).toContain("&lt;img");
      });

      it("makes no external network references", () => {
        const html = render(mockInvoice(), mockCustomer());
        expect(html).not.toMatch(/https?:\/\//);
      });
    });
  }
});
