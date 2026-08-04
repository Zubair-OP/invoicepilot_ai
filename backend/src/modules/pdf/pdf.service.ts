import { chromium, type Browser, type Page } from "playwright";
import { logger } from "../../observability/logger.js";
import { ServiceUnavailableError, NotFoundError } from "../../common/errors/index.js";
import { Invoice, Customer, User } from "../../database/models/index.js";
import type { InvoiceDocument } from "../../database/models/Invoice.js";
import type { CustomerDocument } from "../../database/models/Customer.js";
import { renderClassic } from "./templates/classic.js";
import { renderModern } from "./templates/modern.js";
import { renderMinimal } from "./templates/minimal.js";

// One browser shared across requests. Launching Chromium per request is ~1s
// overhead. Launch lazily on first use and close it in the existing SIGTERM
// handler in app.ts.
let browser: Browser | null = null;

// Concurrency cap: 3 simultaneous renders. Playwright is memory-heavy; without a
// cap, a handful of concurrent requests can OOM the container. Requests beyond the
// cap queue here rather than crashing.
let activeRenders = 0;
const MAX_CONCURRENT_RENDERS = 3;

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({ headless: true });
    logger.info("Playwright browser launched");
  }
  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
    logger.info("Playwright browser closed");
  }
}

/**
 * Renders an invoice to PDF. Reuses one browser instance across requests;
 * templates as functions returning HTML strings; no network fetches during
 * render; caps concurrent renders to avoid OOM.
 */
export async function renderInvoicePDF(
  invoice: InvoiceDocument,
  customer: CustomerDocument,
  templateId: string
): Promise<Buffer> {
  // Wait for an available render slot.
  while (activeRenders >= MAX_CONCURRENT_RENDERS) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  activeRenders++;
  const b = await getBrowser();
  let page: Page | null = null;

  try {
    page = await b.newPage();

    // Render timeout (~15s) so a stuck render doesn't hang forever.
    page.setDefaultTimeout(15000);

    const html = selectTemplate(templateId)(invoice, customer);
    await page.setContent(html, { waitUntil: "networkidle" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
    });

    return Buffer.from(pdf);
  } catch (error) {
    logger.error({ err: error, invoiceId: invoice._id }, "PDF rendering failed");
    throw new ServiceUnavailableError("PDF rendering failed");
  } finally {
    if (page) await page.close();
    activeRenders--;
  }
}

/**
 * Renders an invoice to HTML for /preview (debugging / print).
 */
export function renderInvoiceHTML(
  invoice: InvoiceDocument,
  customer: CustomerDocument,
  templateId: string
): string {
  return selectTemplate(templateId)(invoice, customer);
}

function selectTemplate(
  templateId: string
): (invoice: InvoiceDocument, customer: CustomerDocument) => string {
  switch (templateId) {
    case "modern":
      return renderModern;
    case "minimal":
      return renderMinimal;
    case "classic":
    default:
      return renderClassic;
  }
}

/**
 * Loads an invoice + its customer for the given tenant, plus the tenant's chosen
 * template. Ownership is enforced in the query ({ _id, userId }) — requesting
 * another tenant's invoice returns 404, never their data.
 */
export async function loadInvoiceForRender(userId: string, invoiceId: string) {
  const invoice = await Invoice.findOne({ _id: invoiceId, userId });
  if (!invoice) throw new NotFoundError("Invoice");

  const customer = await Customer.findOne({ _id: invoice.customerId, userId });
  if (!customer) throw new NotFoundError("Customer");

  const user = await User.findOne({ _id: userId, deletedAt: { $exists: false } })
    .select("settings")
    .lean();
  const templateId = user?.settings?.templateId ?? "classic";

  return { invoice, customer, templateId };
}

/** Generates a PDF for an invoice owned by the tenant. */
export async function generateInvoicePDFForUser(userId: string, invoiceId: string) {
  const { invoice, customer, templateId } = await loadInvoiceForRender(userId, invoiceId);
  const pdf = await renderInvoicePDF(invoice, customer, templateId);
  return { pdf, invoiceNumber: invoice.invoiceNumber };
}

/** Renders an invoice to HTML for the tenant (preview / print / debugging). */
export async function generateInvoiceHTMLForUser(userId: string, invoiceId: string) {
  const { invoice, customer, templateId } = await loadInvoiceForRender(userId, invoiceId);
  return renderInvoiceHTML(invoice, customer, templateId);
}
