"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu, Bell } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import Sidebar from "@/components/layout/Sidebar";
import Loading from "@/components/ui/Loading";

function getPageTitle(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0 || segments[0] !== "dashboard") return "Dashboard";
  if (segments.length === 1) return "Dashboard";

  const section = segments[1];
  if (section === "invoices") {
    if (segments[2] === "new") return "New Invoice";
    if (segments.length >= 3) return "Invoice Details";
    return "Invoices";
  }
  if (section === "customers") {
    if (segments[2] === "new") return "New Customer";
    if (segments.length >= 3) return "Customer Details";
    return "Customers";
  }
  if (section === "templates") return "Templates";
  if (section === "settings") return "Settings";
  if (section === "billing") return "Billing & Plans";
  if (section === "admin") {
    if (segments[2] === "users") return "User Management";
    if (segments[2] === "analytics") return "Admin Analytics";
    return "Admin";
  }

  const last = segments[segments.length - 1];
  if (/^[0-9a-fA-F]{24}$/.test(last)) {
    return `${section.charAt(0).toUpperCase() + section.slice(1)} Details`;
  }
  return last.replace(/-/g, " ");
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
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
      <div className="min-h-screen flex items-center justify-center">
        <Loading size="lg" text="Loading..." />
      </div>
    );
  }

  const pageTitle = getPageTitle(pathname || "");

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} isAdmin={isAdmin} />

      <div className="flex-1 flex flex-col lg:pl-64">
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold text-gray-900 capitalize">
              {pageTitle.replace(/-/g, " ")}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2 rounded-lg hover:bg-gray-100 relative">
              <Bell className="w-5 h-5 text-gray-500" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
