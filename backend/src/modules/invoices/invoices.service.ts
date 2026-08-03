import { Invoice } from "../../database/models/index.js";
import { NotFoundError, ConflictError } from "../../common/errors/index.js";
import type { CreateInvoiceInput, UpdateInvoiceInput } from "./invoices.validation.js";
import type { PaginationParams, ITaxComponent } from "../../common/types/index.js";
import { getSkipTake, buildPaginationMeta } from "../../common/utils/pagination.js";
import { paginatedResponse } from "../../common/response.js";
import { isDuplicateKeyError } from "../../common/utils/mongo.js";
import { generateInvoiceNumber } from "./invoices.numbering.js";

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
    filter.$or = [{ invoiceNumber: { $regex: filters.search, $options: "i" } }];
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
  const totals = computeTotals(items, taxComponents, discount);
  const invoiceNumber = await generateInvoiceNumber(userId);

  try {
    return await Invoice.create({
      userId,
      customerId: rest.customerId,
      invoiceNumber,
      ...totals,
      discount,
      currency: rest.currency,
      notes: rest.notes,
      dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      issuedAt: issuedAt ? new Date(issuedAt) : new Date(),
      items: items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: parseFloat((item.quantity * item.unitPrice).toFixed(2)),
      })),
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ConflictError("Invoice number conflict, please retry");
    }
    throw error;
  }
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
