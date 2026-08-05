import mongoose from "mongoose";

// ─── API Response ───────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  code?: string;
  errors?: Record<string, string[]>;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: PaginationMeta;
}

// ─── Pagination ─────────────────────────────────────────
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface CursorPaginationParams {
  cursor?: string;
  limit: number;
}

// ─── Mongoose Document Types ────────────────────────────
export type UserRole = "USER" | "ADMIN";

export type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED";

// Per-tenant business defaults and invoice appearance. Pure data in Phase 3 —
// rendering uses `templateId` in Phase 5; the defaults pre-fill new invoices.
export interface IUserSettings {
  businessName?: string;
  businessAddress?: string;
  taxId?: string;                        // GSTIN / VAT number
  logoUrl?: string;
  defaultCurrency: string;               // default "USD"
  defaultPaymentTermsDays: number;       // default 30
  defaultTaxComponents: ITaxComponent[]; // pre-fill new invoices
  invoicePrefix: string;                 // default "INV"
  templateId: string;                    // default "classic"
  reminders?: IReminderSettings;         // dunning schedule (Phase 7) — schema-defaulted
}

export interface IUser {
  _id: mongoose.Types.ObjectId;
  clerkId: string;
  email: string;
  name: string;
  company?: string;
  avatar?: string;
  role: UserRole;
  settings: IUserSettings;
  subscription: IUserSubscription;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Billing / plan limits (Phase 8) ─────────────────────
export type PlanKey = "free" | "pro" | "business";

export type SubscriptionStatus = "active" | "past_due" | "canceled" | "trialing";

// The resource keys that usage is tracked for. Names mirror the plan `limits`
// fields so a plan lookup and a usage lookup share one vocabulary.
export type PlanLimitResource = "invoicesPerMonth" | "customers" | "aiGenerationsPerMonth";

// Per-tenant subscription state. `planKey` defaults to "free"; `currentPeriodStart`
// marks the current billing period's start so usage is counted per Stripe period
// (not calendar month). Free accounts have no Stripe period, so their usage window
// falls back to the start of the current month in `billing.limits`.
export interface IUserSubscription {
  planKey: PlanKey;              // default "free"
  stripeCustomerId?: string;     // Stripe customer_xxx
  stripeSubscriptionId?: string; // Stripe sub_xxx
  status: SubscriptionStatus;    // default "active"
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
}

export interface IActivityLog {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId | string;
  action: string;
  targetType?: string;
  targetId?: mongoose.Types.ObjectId | string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICustomer {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId | string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IInvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

// Generic tax component — works for GST (CGST/SGST/IGST), VAT, sales tax, etc.
export interface ITaxComponent {
  name: string;   // e.g. "CGST", "SGST", "VAT", "Sales Tax"
  rate: number;   // percentage, e.g. 9 for 9%
  amount: number; // computed: subtotal * rate / 100
}

// Kind of email dispatched for an invoice. Kept as a string union so the
// delivery history and the template registry stay in sync.
export type EmailType = "invoice" | "reminder" | "payment_received";

// A reminder milestone label, derived from the configured day-offset relative to
// `dueDate` — e.g. offset -3 → "upcoming_3", offset +7 → "overdue_7", offset 0 →
// "due". `manual` covers an ad-hoc reminder triggered from the API. It is an open
// string (not a closed union) because offsets are user-configurable. Recording
// the label is what guarantees a milestone never dunning-emails a customer twice.
export type ReminderType = string;

// One entry per reminder actually sent. Append-only, like `emailsSent`, but
// scoped to dunning so the sweep can ask "has this milestone fired?" cheaply.
export interface IReminderSent {
  type: ReminderType;
  sentAt: Date;
}

// Per-tenant dunning configuration. Offsets are days relative to `dueDate`:
// negative = before due (upcoming), positive = after due (overdue).
export interface IReminderSettings {
  enabled: boolean;
  offsets: number[];
}

// One entry per successful send — a lightweight audit trail on the invoice so a
// resend, reminder, or receipt is visible without querying ActivityLog.
export interface IEmailSent {
  to: string;
  sentAt: Date;
  type: EmailType;
}

export interface IInvoice {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId | string;
  customerId: mongoose.Types.ObjectId | ICustomer;
  invoiceNumber: string;
  status: InvoiceStatus;
  currency: string;
  subtotal: number;
  taxComponents: ITaxComponent[];
  tax: number;      // sum of all taxComponent amounts
  discount: number;
  total: number;
  notes?: string;
  items: IInvoiceItem[];
  issuedAt: Date;
  dueDate: Date;
  paidAt?: Date;
  emailsSent: IEmailSent[];
  remindersSent: IReminderSent[];   // dunning milestones already fired (Phase 7)
  lastReminderAt?: Date;            // when the most recent reminder was sent
  createdAt: Date;
  updatedAt: Date;
}

// ─── Resolved auth attached to every authenticated request ──
export interface RequestUser {
  userId: string;   // Mongo ObjectId string — use this for all DB queries
  clerkId: string;  // Clerk user_xxx ID
  role: UserRole;
}

// ─── Express Request augmentation ───────────────────────
declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
      id: string;
    }
  }
}
