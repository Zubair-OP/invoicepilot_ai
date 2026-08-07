import { Customer, Invoice } from "../../database/models/index.js";
import { NotFoundError } from "../../common/errors/index.js";
import type { CreateCustomerInput, UpdateCustomerInput } from "./customers.validation.js";
import type { PaginationParams, ICustomer, IInvoice } from "../../common/types/index.js";
import { getSkipTake, buildPaginationMeta } from "../../common/utils/pagination.js";
import { escapeRegex } from "../../common/utils/regex.js";
import { paginatedResponse } from "../../common/response.js";
import { recordUsage } from "../billing/index.js";

/** Subset of invoice fields shown in a customer's recent-activity list. */
type RecentInvoice = Pick<IInvoice, "_id" | "invoiceNumber" | "total" | "status" | "issuedAt">;

type CustomerWithInvoices = ICustomer & { invoices: RecentInvoice[] };

export async function list(userId: string, pagination: PaginationParams, search?: string) {
  const filter: Record<string, unknown> = { userId };

  if (search) {
    // `search` is user input — escape it before interpolating into $regex or a
    // crafted term like `(a+)+$` (ReDoS) could hang the query engine.
    const escaped = escapeRegex(search);
    filter.$or = [
      { name: { $regex: escaped, $options: "i" } },
      { email: { $regex: escaped, $options: "i" } },
    ];
  }

  const { skip, take } = getSkipTake(pagination);

  const [customers, total] = await Promise.all([
    Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(take).lean(),
    Customer.countDocuments(filter),
  ]);

  return paginatedResponse(customers, buildPaginationMeta(total, pagination));
}

export async function getById(userId: string, customerId: string): Promise<CustomerWithInvoices> {
  const customer = await Customer.findOne({ _id: customerId, userId }).lean<ICustomer>();
  if (!customer) throw new NotFoundError("Customer");

  const recentInvoices = await Invoice.find({ customerId: customer._id, userId })
    .select("invoiceNumber total status issuedAt")
    .sort({ issuedAt: -1 })
    .limit(5)
    .lean<RecentInvoice[]>();

  return { ...customer, invoices: recentInvoices };
}

export async function create(userId: string, data: CreateCustomerInput) {
  const customer = await Customer.create({ ...data, userId });
  // Best-effort: bump the tenant's period usage; must not fail the create.
  await recordUsage("customers", userId);
  return customer;
}

export async function update(userId: string, customerId: string, data: UpdateCustomerInput) {
  const customer = await Customer.findOne({ _id: customerId, userId });
  if (!customer) throw new NotFoundError("Customer");

  Object.assign(customer, data);
  await customer.save();
  return customer;
}

export async function remove(userId: string, customerId: string) {
  const customer = await Customer.findOne({ _id: customerId, userId });
  if (!customer) throw new NotFoundError("Customer");
  await customer.deleteOne();
}
