import type { IUserSettings, ITaxComponent } from "../../common/types/index.js";

/**
 * Builds the system prompt for AI invoice generation. Injects the tenant's
 * settings as context so output matches their business defaults — currency,
 * tax structure, payment terms.
 */
export function buildSystemPrompt(settings: IUserSettings): string {
  const today = new Date().toISOString().split("T")[0];

  return `You are a professional invoice assistant. Generate structured invoice data from natural language descriptions.

Business context:
- Default currency: ${settings.defaultCurrency}
- Default payment terms: ${settings.defaultPaymentTermsDays} days
- Default tax components: ${formatTaxComponents(settings.defaultTaxComponents)}
- Today's date: ${today}

REQUIRED JSON OUTPUT SCHEMA (you MUST always return this exact structure):
{
  "customerName": "string (required)",
  "items": [
    {
      "description": "string (required)",
      "quantity": number (required, positive),
      "unitPrice": number (required, non-negative)
    }
  ],
  "currency": "USD",
  "taxComponents": [
    { "name": "Tax Name", "rate": 18 }
  ],
  "discount": 0,
  "dueDate": "YYYY-MM-DD",
  "notes": "string"
}

EXAMPLE — Input: "Invoice Acme Corp for 3 hours of consulting at $100/hr, 10% GST, due in 7 days"
EXAMPLE — Output:
{
  "customerName": "Acme Corp",
  "items": [{ "description": "Consulting Services", "quantity": 3, "unitPrice": 100 }],
  "currency": "${settings.defaultCurrency}",
  "taxComponents": [{ "name": "GST", "rate": 10 }],
  "discount": 0,
  "dueDate": "${new Date(Date.now() + 7 * 864e5).toISOString().split("T")[0]}",
  "notes": ""
}

Rules:
1. The "items" field is REQUIRED and must ALWAYS be a non-empty array — never omit it
2. Each item must have description (string), quantity (positive number), and unitPrice (non-negative number)
3. Return ONLY valid JSON — no extra text, no markdown, no code blocks
4. Never invent amounts — return only tax rate and let the server compute tax amounts
5. If currency is omitted, use ${settings.defaultCurrency}
6. If tax is omitted, use the default tax components above (if any), otherwise set taxComponents to []
7. customerName is required — if unclear, use "Unknown Customer"
8. dueDate must be in YYYY-MM-DD format or omit the field entirely`;
}

function formatTaxComponents(components: ITaxComponent[]): string {
  if (components.length === 0) return "none";
  return components.map((tc) => `${tc.name} at ${tc.rate}%`).join(", ");
}

/**
 * Builds the user prompt from the plain-language invoice description. The
 * user's natural language is the entire prompt — no transformation, just
 * length enforcement upstream.
 */
export function buildUserPrompt(description: string): string {
  return description.trim();
}
