import mongoose, { Schema, Document } from "mongoose";
import type {
  IInvoice,
  IInvoiceItem,
  ITaxComponent,
  IEmailSent,
  IReminderSent,
} from "../../common/types/index.js";

export type InvoiceDocument = IInvoice & Document;

const invoiceItemSchema = new Schema<IInvoiceItem>(
  {
    description: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

// Generic tax model: an invoice carries a list of named components rather than a
// single rate. This expresses GST (CGST+SGST intra-state, IGST inter-state), VAT,
// or plain sales tax without schema changes per jurisdiction.
const taxComponentSchema = new Schema<ITaxComponent>(
  {
    name: { type: String, required: true, trim: true },
    rate: { type: Number, required: true, min: 0, max: 100 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

// Append-only delivery log: one entry per successful send. Lets the UI show
// "last sent" and guards against a resend appearing to have never happened.
const emailSentSchema = new Schema<IEmailSent>(
  {
    to: { type: String, required: true, trim: true },
    sentAt: { type: Date, default: Date.now },
    type: {
      type: String,
      enum: ["invoice", "reminder", "payment_received"],
      required: true,
    },
  },
  { _id: false }
);

// Append-only dunning log: one entry per reminder milestone actually sent. The
// sweep checks this before sending so a customer is never dunned twice for the
// same milestone — duplicate reminder emails are the worst possible bug here.
// `type` is free-form (offsets are user-configurable), so no enum constraint.
const reminderSentSchema = new Schema<IReminderSent>(
  {
    type: { type: String, required: true, trim: true },
    sentAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const invoiceSchema = new Schema<InvoiceDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    invoiceNumber: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"],
      default: "DRAFT",
    },
    currency: { type: String, default: "USD", uppercase: true, trim: true },
    subtotal: { type: Number, required: true, min: 0 },
    taxComponents: { type: [taxComponentSchema], default: [] },
    tax: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    notes: { type: String, trim: true },
    items: { type: [invoiceItemSchema], required: true },
    issuedAt: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },
    paidAt: { type: Date },
    emailsSent: { type: [emailSentSchema], default: [] },
    remindersSent: { type: [reminderSentSchema], default: [] },
    lastReminderAt: { type: Date },
  },
  { timestamps: true }
);

// Invoice numbers are unique *per tenant*, not globally — every business runs its
// own INV-0001 sequence. A global unique index would let the first user to claim
// a number lock every other user out of it.
invoiceSchema.index({ userId: 1, invoiceNumber: 1 }, { unique: true });

// Supports the dashboard list view: tenant's invoices, newest first.
invoiceSchema.index({ userId: 1, createdAt: -1 });

// Supports status filtering within a tenant.
invoiceSchema.index({ userId: 1, status: 1 });

// Drives the overdue-reminder sweep (Phase 7): find unpaid invoices past due.
invoiceSchema.index({ status: 1, dueDate: 1 });

// Supports the per-customer invoice history on the customer detail view.
invoiceSchema.index({ customerId: 1, issuedAt: -1 });

export const Invoice = mongoose.model<InvoiceDocument>("Invoice", invoiceSchema);
