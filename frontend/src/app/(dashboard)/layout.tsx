"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu, Bell, Search } from "lucide-react";
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
  if (section === "admin") {
    if (segments[2] === "users")
      return { title: "User Management", subtitle: "Manage platform users" };
    return { title: "Admin", subtitle: "Platform administration" };
  }

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
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    async function loadUser() {
      try {
        const { api } = await import("@/lib/api");
        const res = await api.getMe();
        if (res.success && res.data?.role === "ADMIN") {
          setIsAdmin(true);
        }
      } catch {
        // Not logged in or error
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loading size="lg" text="Loading..." />
      </div>
    );
  }

  const { title, subtitle } = getPageMeta(pathname || "");

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isAdmin={isAdmin}
      />

      {/* ── Main content area ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col lg:pl-64 min-w-0">
        {/* ── Top header bar ──────────────────────────────────────── */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 h-16 flex items-center justify-between px-4 sm:px-6 gap-4">
          {/* Left — mobile burger + page title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              id="sidebar-toggle"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors shrink-0"
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

          {/* Right — search + bell + avatar */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Search hint — desktop only */}
            <button className="hidden md:flex items-center gap-2 px-3 py-2 text-sm text-slate-400 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors">
              <Search className="w-4 h-4" />
              <span className="text-xs">Search...</span>
              <kbd className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold bg-white border border-slate-200 rounded text-slate-400">
                ⌘K
              </kbd>
            </button>

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
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </header>

        {/* ── Page content ──────────────────────────────────────────── */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
