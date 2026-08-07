import { Invoice, User } from "../../database/models/index.js";
import { NotFoundError, ConflictError } from "../../common/errors/index.js";
import type { CreateInvoiceInput, UpdateInvoiceInput } from "./invoices.validation.js";
import type { PaginationParams, ITaxComponent } from "../../common/types/index.js";
import { getSkipTake, buildPaginationMeta } from "../../common/utils/pagination.js";
import { escapeRegex } from "../../common/utils/regex.js";
import { paginatedResponse } from "../../common/response.js";
import { isDuplicateKeyError } from "../../common/utils/mongo.js";
import { generateInvoiceNumber } from "./invoices.numbering.js";
import { recordUsage } from "../billing/index.js";

function computeTotals(
  items: CreateInvoiceInput["items"],
  taxComponents: CreateInvoiceInput["taxComponents"],
  discount: number
) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  const resolvedComponents: ITaxComponent[] = (taxComponents ?? []).map((tc) => ({
    name: tc.name,
    rate: tc.rate,
    amount: parseFloat(((subtotal * tc.rate) / 100).toFixed(2)),
  }));

  const tax = resolvedComponents.reduce((sum, tc) => sum + tc.amount, 0);
  const total = parseFloat((subtotal + tax - discount).toFixed(2));

  return { subtotal, taxComponents: resolvedComponents, tax, total };
}

export async function list(
  userId: string,
  pagination: PaginationParams,
  filters?: { status?: string; search?: string }
) {
  const filter: Record<string, unknown> = { userId };
  if (filters?.status) filter.status = filters.status;
  if (filters?.search) {
    // User-controlled — escape before interpolation (ReDoS hardening, Phase 10).
    filter.$or = [{ invoiceNumber: { $regex: escapeRegex(filters.search), $options: "i" } }];
  }

  const { skip, take } = getSkipTake(pagination);
  const [invoices, total] = await Promise.all([
    Invoice.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(take)
      .populate("customerId", "name email")
      .lean(),
    Invoice.countDocuments(filter),
  ]);

  return paginatedResponse(invoices, buildPaginationMeta(total, pagination));
}

export async function getById(userId: string, invoiceId: string) {
  const invoice = await Invoice.findOne({ _id: invoiceId, userId }).populate("customerId").lean();
  if (!invoice) throw new NotFoundError("Invoice");
  return invoice;
}

export async function create(userId: string, data: CreateInvoiceInput) {
  const { items, taxComponents, discount = 0, dueDate, issuedAt, ...rest } = data;

  // Fall back to the tenant's settings for anything the request omits. Explicit
  // request values always win; `??` treats only `undefined` (omitted) as "inherit",
  // so an explicit `[]` for taxComponents still means "no tax".
  const settings = await getUserSettings(userId);
  const currency = rest.currency ?? settings.defaultCurrency;
  const resolvedTaxComponents = taxComponents ?? settings.defaultTaxComponents;
  const resolvedDueDate = dueDate
    ? new Date(dueDate)
    : new Date(Date.now() + settings.defaultPaymentTermsDays * 24 * 60 * 60 * 1000);

  const totals = computeTotals(items, resolvedTaxComponents, discount);
  const invoiceNumber = await generateInvoiceNumber(userId, settings.invoicePrefix);

  try {
    const invoice = await Invoice.create({
      userId,
      customerId: rest.customerId,
      invoiceNumber,
      ...totals,
      discount,
      currency,
      notes: rest.notes,
      dueDate: resolvedDueDate,
      issuedAt: issuedAt ? new Date(issuedAt) : new Date(),
      items: items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: parseFloat((item.quantity * item.unitPrice).toFixed(2)),
      })),
    });

    // Best-effort: bump the tenant's period usage; must not fail the create.
    await recordUsage("invoicesPerMonth", userId);
    return invoice;
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ConflictError("Invoice number conflict, please retry");
    }
    throw error;
  }
}

/**
 * Loads the tenant's invoice defaults. Returns hardcoded fallbacks if the user
 * or settings are somehow absent, so invoice creation never fails purely because
 * settings could not be read.
 */
async function getUserSettings(userId: string) {
  const user = await User.findOne({ _id: userId, deletedAt: { $exists: false } })
    .select("settings")
    .lean();
  return (
    user?.settings ?? {
      defaultCurrency: "USD",
      defaultPaymentTermsDays: 30,
      defaultTaxComponents: [] as ITaxComponent[],
      invoicePrefix: "INV",
      templateId: "classic",
    }
  );
}

export async function update(userId: string, invoiceId: string, data: UpdateInvoiceInput) {
  const invoice = await Invoice.findOne({ _id: invoiceId, userId });
  if (!invoice) throw new NotFoundError("Invoice");

  // Sent/Paid invoices are legal documents — only notes and status transitions allowed.
  const isLocked = invoice.status === "SENT" || invoice.status === "PAID";
  if (isLocked && (data.items || data.taxComponents !== undefined || data.discount !== undefined)) {
    throw new ConflictError("Cannot modify line items on a sent or paid invoice");
  }

  if (data.items) {
    const totals = computeTotals(data.items, data.taxComponents ?? invoice.taxComponents, data.discount ?? invoice.discount);
    invoice.items = data.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: parseFloat((item.quantity * item.unitPrice).toFixed(2)),
    }));
    Object.assign(invoice, totals);
  }

  if (data.discount !== undefined && !isLocked) invoice.discount = data.discount;
  if (data.notes !== undefined) invoice.notes = data.notes;
  if (data.status) invoice.status = data.status;
  if (data.dueDate) invoice.dueDate = new Date(data.dueDate);

  await invoice.save();
  return invoice.populate("customerId");
}

export async function remove(userId: string, invoiceId: string) {
  const invoice = await Invoice.findOne({ _id: invoiceId, userId });
  if (!invoice) throw new NotFoundError("Invoice");
  if (invoice.status === "PAID") throw new ConflictError("Cannot delete a paid invoice");
  await invoice.deleteOne();
}

export async function markAsSent(userId: string, invoiceId: string) {
  const invoice = await Invoice.findOne({ _id: invoiceId, userId });
  if (!invoice) throw new NotFoundError("Invoice");
  if (invoice.status !== "DRAFT") throw new ConflictError("Only draft invoices can be marked as sent");
  invoice.status = "SENT";
  await invoice.save();
  return invoice;
}

export async function markAsPaid(userId: string, invoiceId: string) {
  const invoice = await Invoice.findOne({ _id: invoiceId, userId });
  if (!invoice) throw new NotFoundError("Invoice");
  if (invoice.status === "PAID") throw new ConflictError("Invoice is already paid");
  invoice.status = "PAID";
  invoice.paidAt = new Date();
  await invoice.save();
  return invoice;
}
