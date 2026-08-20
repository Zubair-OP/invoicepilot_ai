const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

import type {
  AdminAnalytics,
  BillingInfo,
  Customer,
  DashboardData,
  Invoice,
  Plan,
  User,
  UserSettings,
} from "@/types";

/**
 * Backend envelope. `data` is present on success; `message` carries the
 * human-readable description for both success and failure responses.
 */
interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  code?: string;
  errors?: Record<string, string[]>;
}

/** Envelope returned by paginated list endpoints. */
interface PaginatedEnvelope<T> {
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

/** Draft invoice shape returned by the AI generator. */
interface InvoiceDraft {
  customerId?: string;
  items?: { description: string; quantity: number; unitPrice: number }[];
  currency?: string;
  taxComponents?: { name: string; rate: number }[];
  discount?: number;
  notes?: string;
  dueDate?: string;
}

/**
 * Resolve an unknown thrown value into a user-safe message. Falls back to the
 * caller-provided message, then to the generic friendly copy.
 */
export function getErrorMessage(err: unknown, fallback?: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback || ERROR_MESSAGES.generic;
}

/** Best-effort HTTP status for thrown errors (used to distinguish 404s). */
export function getErrorStatus(err: unknown): number | undefined {
  if (err instanceof ApiError) return err.status;
  return undefined;
}

/**
 * User-friendly messages for common failure modes. We deliberately avoid
 * exposing infrastructure details (host names, cold starts, etc.).
 */
const ERROR_MESSAGES = {
  network:
    "We couldn't reach our servers. Please check your connection and try again.",
  timeout:
    "This is taking a little longer than usual. Please don't close this page — try again in a moment.",
  unauthorized:
    "Your session has expired. Please sign in again to continue.",
  generic: "Something went wrong. Please try again.",
} as const;

export class ApiError extends Error {
  status?: number;
  code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

interface ClerkSessionLike {
  getToken: () => Promise<string | null>;
}

async function waitForClerkSession(timeoutMs = 4000): Promise<ClerkSessionLike | null> {
  if (typeof window === "undefined") return null;

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const win = window as unknown as {
      Clerk?: { session?: ClerkSessionLike; loaded?: boolean };
    };
    if (win.Clerk?.session) {
      return win.Clerk.session;
    }
    // If Clerk explicitly finished loading and there's no user signed in
    if (win.Clerk?.loaded && !win.Clerk.session) {
      return null;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  const win = window as unknown as {
    Clerk?: { session?: ClerkSessionLike; loaded?: boolean };
  };
  return win.Clerk?.session || null;
}

async function getToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const session = await waitForClerkSession();
    if (session && typeof session.getToken === "function") {
      return await session.getToken();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Aborts the request after `timeoutMs`. Falls back to the raw fetch when the
 * AbortController signal is already consumed by the caller.
 */
function createTimeoutSignal(timeoutMs?: number): AbortSignal | undefined {
  if (!timeoutMs) return undefined;
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), timeoutMs);
    return controller.signal;
  } catch {
    return undefined;
  }
}

function toFriendlyError(err: unknown, status?: number): Error {
  if (err instanceof ApiError) return err;
  if (err instanceof DOMException && err.name === "AbortError") {
    return new ApiError(ERROR_MESSAGES.timeout, status);
  }
  if (err instanceof TypeError) {
    // fetch rejects with TypeError on network failure
    return new ApiError(ERROR_MESSAGES.network, status);
  }
  if (err instanceof Error) return err;
  return new ApiError(ERROR_MESSAGES.generic, status);
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const token = await getToken();
  const { timeoutMs, ...fetchOptions } = options;

  const buildHeaders = (t: string | null) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((fetchOptions.headers as Record<string, string>) || {}),
    };
    if (t) {
      headers["Authorization"] = `Bearer ${t}`;
    }
    return headers;
  };

  const signal = createTimeoutSignal(timeoutMs);
  const mergedSignal =
    fetchOptions.signal && signal
      ? abortAny([fetchOptions.signal, signal])
      : signal || fetchOptions.signal;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...fetchOptions,
      headers: buildHeaders(token),
      signal: mergedSignal,
    });
  } catch (err) {
    throw toFriendlyError(err);
  }

  // If unauthorized, retry once with fresh token in case Clerk session just initialized
  if (response.status === 401) {
    const retryToken = await getToken();
    if (retryToken) {
      try {
        response = await fetch(`${API_BASE}${endpoint}`, {
          ...fetchOptions,
          headers: buildHeaders(retryToken),
          signal: mergedSignal,
        });
      } catch (err) {
        throw toFriendlyError(err);
      }
    }
  }

  if (!response.ok) {
    let message: string = ERROR_MESSAGES.generic;
    let code: string | undefined;
    try {
      const body = await response.json();
      if (body?.message) message = body.message;
      if (body?.code) code = body.code;
    } catch {
      // keep the generic message
    }

    if (response.status === 401) {
      message = ERROR_MESSAGES.unauthorized;
    }

    throw new ApiError(message, response.status, code);
  }

  return response.json();
}

function abortAny(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  signals.forEach((signal) => {
    if (signal.aborted) {
      controller.abort();
      return;
    }
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  });
  return controller.signal;
}

export const api = {
  // Users
  getMe: () => fetchApi<ApiEnvelope<User>>("/users/me"),
  updateMe: (data: Record<string, unknown>) => fetchApi<ApiEnvelope<User>>("/users/me", { method: "PATCH", body: JSON.stringify(data) }),

  // Customers
  getCustomers: (params?: Record<string, string>) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    return fetchApi<PaginatedEnvelope<Customer>>(`/customers${query}`);
  },
  getCustomer: (id: string) => fetchApi<ApiEnvelope<Customer>>(`/customers/${id}`),
  createCustomer: (data: Record<string, unknown>) => fetchApi<ApiEnvelope<Customer>>("/customers", { method: "POST", body: JSON.stringify(data) }),
  updateCustomer: (id: string, data: Record<string, unknown>) => fetchApi<ApiEnvelope<Customer>>(`/customers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteCustomer: (id: string) => fetchApi<ApiEnvelope<{ message: string }>>(`/customers/${id}`, { method: "DELETE" }),

  // Invoices
  getInvoices: (params?: Record<string, string>) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    return fetchApi<PaginatedEnvelope<Invoice>>(`/invoices${query}`);
  },
  getInvoice: (id: string) => fetchApi<ApiEnvelope<Invoice>>(`/invoices/${id}`),
  createInvoice: (data: Record<string, unknown>) => fetchApi<ApiEnvelope<Invoice>>("/invoices", { method: "POST", body: JSON.stringify(data) }),
  updateInvoice: (id: string, data: Record<string, unknown>) => fetchApi<ApiEnvelope<Invoice>>(`/invoices/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteInvoice: (id: string) => fetchApi<ApiEnvelope<{ message: string }>>(`/invoices/${id}`, { method: "DELETE" }),
  sendInvoice: (id: string) => fetchApi<ApiEnvelope<Invoice>>(`/invoices/${id}/send`, { method: "PATCH" }),
  payInvoice: (id: string) => fetchApi<ApiEnvelope<Invoice>>(`/invoices/${id}/pay`, { method: "PATCH" }),
  voidInvoice: (id: string) => fetchApi<ApiEnvelope<Invoice>>(`/invoices/${id}/void`, { method: "PATCH" }),
  unvoidInvoice: (id: string) => fetchApi<ApiEnvelope<Invoice>>(`/invoices/${id}/unvoid`, { method: "PATCH" }),
  getInvoicePdf: (id: string) => `${API_BASE}/invoices/${id}/pdf`,
  getInvoicePreview: (id: string) => `${API_BASE}/invoices/${id}/preview`,
  downloadInvoicePdf: async (id: string, invoiceNumber?: string): Promise<void> => {
    const token = await getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE}/invoices/${id}/pdf`, {
        headers,
        signal: createTimeoutSignal(45000),
      });
    } catch (err) {
      throw toFriendlyError(err);
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: "Failed to download PDF" }));
      throw new ApiError(
        err.message || "We couldn't prepare your PDF right now. Please try again.",
        response.status
      );
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Invoice-${invoiceNumber || id}.pdf`;
    document.body.appendChild(link);
    link.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(link);
  },
  sendInvoiceEmail: (id: string, data?: Record<string, unknown>) => fetchApi<ApiEnvelope<Invoice>>(`/invoices/${id}/send-email`, { method: "POST", body: JSON.stringify(data || {}) }),
  remindInvoice: (id: string) => fetchApi<ApiEnvelope<Invoice>>(`/invoices/${id}/remind`, { method: "POST" }),

  // AI
  generateInvoice: (prompt: string) => fetchApi<ApiEnvelope<InvoiceDraft>>("/ai/generate-invoice", { method: "POST", body: JSON.stringify({ prompt }) }),
  aiChat: (messages: { role: string; content: string }[]) => fetchApi<ApiEnvelope<{ reply: string }>>("/ai/chat", { method: "POST", body: JSON.stringify({ messages }) }),

  // Templates
  getTemplates: () => fetchApi<ApiEnvelope<{ id: string; name: string }[]>>("/templates"),

  // Settings
  getSettings: () => fetchApi<ApiEnvelope<UserSettings>>("/settings"),
  updateSettings: (data: Record<string, unknown>) => fetchApi<ApiEnvelope<UserSettings>>("/settings", { method: "PATCH", body: JSON.stringify(data) }),

  // Billing
  getPlans: () => fetchApi<ApiEnvelope<Plan[]>>("/billing/plans"),
  getSubscription: (params?: { session_id?: string }) => {
    const query = params?.session_id ? `?session_id=${encodeURIComponent(params.session_id)}` : "";
    return fetchApi<ApiEnvelope<BillingInfo>>(`/billing/subscription${query}`);
  },
  syncSubscription: (sessionId?: string) =>
    fetchApi<ApiEnvelope<BillingInfo>>("/billing/sync", { method: "POST", body: JSON.stringify({ sessionId }) }),
  createCheckout: (planKey: string) => fetchApi<ApiEnvelope<{ url: string }>>("/billing/checkout", { method: "POST", body: JSON.stringify({ planKey }) }),
  openPortal: () => fetchApi<ApiEnvelope<{ url: string }>>("/billing/portal", { method: "POST" }),

  // Dashboard
  getDashboard: (params?: Record<string, string>) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    return fetchApi<ApiEnvelope<DashboardData>>(`/dashboard${query}`);
  },

  // Admin
  adminGetUsers: (params?: Record<string, string>) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    return fetchApi<PaginatedEnvelope<User>>(`/admin/users${query}`);
  },
  adminGetUser: (id: string) => fetchApi<ApiEnvelope<User>>(`/admin/users/${id}`),
  adminChangeRole: (id: string, role: string) => fetchApi<ApiEnvelope<User>>(`/admin/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role }) }),
  adminGetAnalytics: (params?: Record<string, string>) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    return fetchApi<ApiEnvelope<AdminAnalytics>>(`/admin/analytics${query}`);
  },
};

export { ERROR_MESSAGES, toFriendlyError };