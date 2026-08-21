"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Bell } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import Sidebar from "@/components/layout/Sidebar";
import Loading from "@/components/ui/Loading";

/* ── Breadcrumb-aware page titles ──────────────────────────────────────── */
function getPageMeta(pathname: string): { title: string; subtitle: string } {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0 || segments[0] !== "dashboard")
    return { title: "Dashboard", subtitle: "Overview of your invoicing activity" };
  if (segments.length === 1)
    return { title: "Dashboard", subtitle: "Overview of your invoicing activity" };

  const section = segments[1];
  if (section === "invoices") {
    if (segments[2] === "new")
      return { title: "New Invoice", subtitle: "Create a new invoice with AI assistance" };
    if (segments.length >= 3)
      return { title: "Invoice Details", subtitle: "View and manage invoice" };
    return { title: "Invoices", subtitle: "Manage and track all your invoices" };
  }
  if (section === "customers") {
    if (segments[2] === "new")
      return { title: "New Customer", subtitle: "Add a new customer to your database" };
    if (segments.length >= 3)
      return { title: "Customer Details", subtitle: "View customer profile and history" };
    return { title: "Customers", subtitle: "Manage your client database" };
  }
  if (section === "templates")
    return { title: "Templates", subtitle: "Manage your invoice templates" };
  if (section === "settings")
    return { title: "Settings", subtitle: "Configure your account and preferences" };
  if (section === "billing")
    return { title: "Billing & Plans", subtitle: "Manage your subscription and usage" };

  const last = segments[segments.length - 1];
  const clean = /^[0-9a-fA-F]{24}$/.test(last)
    ? `${section.charAt(0).toUpperCase() + section.slice(1)} Details`
    : last.replace(/-/g, " ");
  return { title: clean, subtitle: "" };
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    async function loadUser() {
      try {
        const { api } = await import("@/lib/api");
        const res = await api.getMe();
        if (res.success && res.data?.role === "ADMIN") {
          router.replace("/admin");
          return;
        }
      } catch {
        // Not logged in or error
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loading size="lg" text="Loading..." />
      </div>
    );
  }

  const { title, subtitle } = getPageMeta(pathname || "");

  return (
    <div className="min-h-screen flex bg-slate-50 print:bg-white print:min-h-0 print:block">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* ── Main content area ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col lg:pl-64 min-w-0 print:pl-0 print:block">
        {/* ── Top header bar ──────────────────────────────────────── */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 h-16 flex items-center justify-between px-4 sm:px-6 gap-4 print:hidden">
          {/* Left — mobile burger + page title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              id="sidebar-toggle"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors active:scale-95 shrink-0"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-slate-900 capitalize leading-tight truncate">
                {title}
              </h1>
              {subtitle && (
                <p className="text-xs text-slate-400 font-normal truncate hidden sm:block">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Right — bell + avatar */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Notification bell */}
            <button
              className="relative p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white" />
            </button>

            {/* User avatar */}
            <div className="pl-1">
              <UserButton />
            </div>
          </div>
        </header>

        {/* ── Page content ──────────────────────────────────────────── */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto print:p-0 print:overflow-visible print:block">
          {children}
        </main>
      </div>
    </div>
  );
}
