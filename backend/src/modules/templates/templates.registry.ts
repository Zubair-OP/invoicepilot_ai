// Invoice templates ship with the code, not in the database: they are code
// (Phase 5 renders each to HTML/PDF), so a DB collection would only add drift
// between the renderer and the list of valid IDs. This constant is the single
// source of truth for which templateId values are accepted anywhere.

export interface InvoiceTemplate {
  id: string;
  name: string;
  description: string;
  previewUrl?: string;
}

export const INVOICE_TEMPLATES: readonly InvoiceTemplate[] = [
  {
    id: "classic",
    name: "Classic",
    description: "Traditional layout with a bordered table and serif headings.",
  },
  {
    id: "modern",
    name: "Modern",
    description: "Clean sans-serif design with an accent color and generous spacing.",
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Stripped-back monochrome layout focused on the numbers.",
  },
] as const;

export const DEFAULT_TEMPLATE_ID = "classic";

/** True if `id` names a template that ships with the app. */
export function isValidTemplateId(id: string): boolean {
  return INVOICE_TEMPLATES.some((t) => t.id === id);
}
