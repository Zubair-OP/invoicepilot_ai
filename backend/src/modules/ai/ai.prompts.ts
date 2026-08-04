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

Rules:
1. Parse the user's description and extract: customer name, line items (description/quantity/unitPrice), currency, tax components, discount, due date
2. For "due in N days", compute dueDate as today + N days
3. Return ONLY valid JSON matching the expected schema
4. Never invent amounts — return only rate and let the server compute tax amounts
5. If the currency is omitted, use ${settings.defaultCurrency}
6. If tax is omitted, use the default tax components above
7. Customer name is required — if unclear, use "Unknown Customer"`;
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
