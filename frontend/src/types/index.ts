export interface User {
  _id: string;
  clerkId: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN";
  company?: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  _id: string;
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface TaxComponent {
  name: string;
  rate: number;
  amount: number;
}

export type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED";

export interface Invoice {
  _id: string;
  userId: string;
  customerId: string;
  customer?: Customer;
  invoiceNumber: string;
  status: InvoiceStatus;
  items: InvoiceItem[];
  currency: string;
  taxComponents: TaxComponent[];
  discount: number;
  subtotal: number;
  taxTotal: number;
  total: number;
  notes?: string;
  issuedAt: string;
  dueDate?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceTemplate {
  id: string;
  name: string;
  description: string;
  previewUrl?: string;
}

export interface CustomSmtpSettings {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
}

export interface UserSettings {
  businessName?: string;
  businessEmail?: string;
  businessPhone?: string;
  businessAddress?: string;
  taxId?: string;
  logoUrl?: string;
  defaultCurrency: string;
  defaultPaymentTermsDays: number;
  defaultTaxComponents: { name: string; rate: number; amount: number }[];
  invoicePrefix: string;
  templateId: string;
  customSmtp?: CustomSmtpSettings;
  reminders: {
    enabled: boolean;
    offsets: number[];
  };
}

export interface Plan {
  key: string;
  name: string;
  description: string;
  priceMonthly: number;
  checkoutEnabled: boolean;
  limits: {
    invoicesPerMonth: { limit: number; unlimited: boolean };
    customers: { limit: number; unlimited: boolean };
    aiGenerationsPerMonth: { limit: number; unlimited: boolean };
    templatesAllowed: string[];
  };
}

export interface Subscription {
  planKey: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
}

export interface Usage {
  invoices: { usage: number; limit: number; remaining: number; unlimited: boolean };
  customers: { usage: number; limit: number; remaining: number; unlimited: boolean };
  ai: { usage: number; limit: number; remaining: number; unlimited: boolean };
}

export interface BillingInfo {
  subscription: Subscription | null;
  plan: Plan;
  usage: Usage;
}

export interface DashboardData {
  period: { from: string; to: string };
  totals: {
    outstanding: { currency: string; amount: number; count: number }[];
    paid: { currency: string; amount: number; count: number }[];
    overdue: { count: number; totals: { currency: string; amount: number; count: number }[] };
  };
  invoicesByStatus: { status: string; count: number; totals: { currency: string; amount: number; count: number }[] }[];
  recentInvoices: {
    id: string;
    invoiceNumber: string;
    status: string;
    currency: string;
    total: number;
    issuedAt: string;
    dueDate?: string;
    customerName: string;
  }[];
  topCustomers: { customerId: string; name: string; currency: string; revenue: number; invoiceCount: number }[];
  monthlyRevenueTrend: { month: string; totals: { currency: string; amount: number; count: number }[] }[];
  averageDaysToPayment: number | null;
}

export interface AdminAnalytics {
  period: { from: string; to: string };
  users: { total: number; growth: number };
  activeSubscriptionsByPlan: { planKey: string; count: number; mrr: number }[];
  mrr: number;
  invoiceVolume: { count: number; totalByCurrency: { currency: string; amount: number; count: number }[] };
  aiUsage: { total: number; byKind: { kind: string; count: number }[] };
  signupsOverTime: { date: string; count: number }[];
  aiUsageOverTime: { date: string; count: number }[];
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  code?: string;
  errors?: Record<string, string[]>;
}
