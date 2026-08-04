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
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
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
