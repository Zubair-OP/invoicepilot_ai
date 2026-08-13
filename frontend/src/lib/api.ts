const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

async function waitForClerkSession(timeoutMs = 4000): Promise<any> {
  if (typeof window === "undefined") return null;

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const win = window as unknown as { Clerk?: any };
    if (win.Clerk?.session) {
      return win.Clerk.session;
    }
    // If Clerk explicitly finished loading and there's no user signed in
    if (win.Clerk?.loaded && !win.Clerk.session) {
      return null;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  const win = window as unknown as { Clerk?: any };
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

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  
  const buildHeaders = (t: string | null) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };
    if (t) {
      headers["Authorization"] = `Bearer ${t}`;
    }
    return headers;
  };

  let response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: buildHeaders(token),
  });

  // If unauthorized, retry once with fresh token in case Clerk session just initialized
  if (response.status === 401) {
    const retryToken = await getToken();
    if (retryToken) {
      response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: buildHeaders(retryToken),
      });
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Users
  getMe: () => fetchApi<any>("/users/me"),
  updateMe: (data: any) => fetchApi<any>("/users/me", { method: "PATCH", body: JSON.stringify(data) }),

  // Customers
  getCustomers: (params?: Record<string, string>) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    return fetchApi<any>(`/customers${query}`);
  },
  getCustomer: (id: string) => fetchApi<any>(`/customers/${id}`),
  createCustomer: (data: any) => fetchApi<any>("/customers", { method: "POST", body: JSON.stringify(data) }),
  updateCustomer: (id: string, data: any) => fetchApi<any>(`/customers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteCustomer: (id: string) => fetchApi<any>(`/customers/${id}`, { method: "DELETE" }),

  // Invoices
  getInvoices: (params?: Record<string, string>) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    return fetchApi<any>(`/invoices${query}`);
  },
  getInvoice: (id: string) => fetchApi<any>(`/invoices/${id}`),
  createInvoice: (data: any) => fetchApi<any>("/invoices", { method: "POST", body: JSON.stringify(data) }),
  updateInvoice: (id: string, data: any) => fetchApi<any>(`/invoices/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteInvoice: (id: string) => fetchApi<any>(`/invoices/${id}`, { method: "DELETE" }),
  sendInvoice: (id: string) => fetchApi<any>(`/invoices/${id}/send`, { method: "PATCH" }),
  payInvoice: (id: string) => fetchApi<any>(`/invoices/${id}/pay`, { method: "PATCH" }),
  voidInvoice: (id: string) => fetchApi<any>(`/invoices/${id}/void`, { method: "PATCH" }),
  unvoidInvoice: (id: string) => fetchApi<any>(`/invoices/${id}/unvoid`, { method: "PATCH" }),
  getInvoicePdf: (id: string) => `${API_BASE}/invoices/${id}/pdf`,
  getInvoicePreview: (id: string) => `${API_BASE}/invoices/${id}/preview`,
  downloadInvoicePdf: async (id: string, invoiceNumber?: string): Promise<void> => {
    const token = await getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}/invoices/${id}/pdf`, {
      headers,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: "Failed to download PDF" }));
      throw new Error(err.message || `HTTP ${response.status}`);
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
  sendInvoiceEmail: (id: string, data?: any) => fetchApi<any>(`/invoices/${id}/send-email`, { method: "POST", body: JSON.stringify(data || {}) }),
  remindInvoice: (id: string) => fetchApi<any>(`/invoices/${id}/remind`, { method: "POST" }),

  // AI
  generateInvoice: (prompt: string) => fetchApi<any>("/ai/generate-invoice", { method: "POST", body: JSON.stringify({ prompt }) }),
  aiChat: (messages: { role: string; content: string }[]) => fetchApi<any>("/ai/chat", { method: "POST", body: JSON.stringify({ messages }) }),

  // Templates
  getTemplates: () => fetchApi<any>("/templates"),

  // Settings
  getSettings: () => fetchApi<any>("/settings"),
  updateSettings: (data: any) => fetchApi<any>("/settings", { method: "PATCH", body: JSON.stringify(data) }),

  // Billing
  getPlans: () => fetchApi<any>("/billing/plans"),
  getSubscription: (params?: { session_id?: string }) => {
    const query = params?.session_id ? `?session_id=${encodeURIComponent(params.session_id)}` : "";
    return fetchApi<any>(`/billing/subscription${query}`);
  },
  syncSubscription: (sessionId?: string) =>
    fetchApi<any>("/billing/sync", { method: "POST", body: JSON.stringify({ sessionId }) }),
  createCheckout: (planKey: string) => fetchApi<any>("/billing/checkout", { method: "POST", body: JSON.stringify({ planKey }) }),
  openPortal: () => fetchApi<any>("/billing/portal", { method: "POST" }),

  // Dashboard
  getDashboard: (params?: Record<string, string>) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    return fetchApi<any>(`/dashboard${query}`);
  },

  // Admin
  adminGetUsers: (params?: Record<string, string>) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    return fetchApi<any>(`/admin/users${query}`);
  },
  adminGetUser: (id: string) => fetchApi<any>(`/admin/users/${id}`),
  adminChangeRole: (id: string, role: string) => fetchApi<any>(`/admin/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role }) }),
  adminGetAnalytics: (params?: Record<string, string>) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    return fetchApi<any>(`/admin/analytics${query}`);
  },
};
