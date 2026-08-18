"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Shield,
  LogOut,
  X,
  Menu,
  ChevronRight,
  Zap,
} from "lucide-react";
import { SignOutButton, UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import Loading from "@/components/ui/Loading";

const adminNav = [
  {
    name: "Analytics & Overview",
    href: "/admin",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    name: "User Management",
    href: "/admin/users",
    icon: Users,
    exact: false,
  },
];

function getAdminPageMeta(pathname: string): { title: string; subtitle: string } {
  if (pathname === "/admin/users" || pathname.startsWith("/admin/users/")) {
    return {
      title: "User Management",
      subtitle: "View and manage all registered platform users and system roles",
    };
  }
  return {
    title: "Admin Dashboard",
    subtitle: "Platform-wide growth metrics, MRR revenue, and AI usage",
  };
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function check() {
      try {
        const { api } = await import("@/lib/api");
        const res = await api.getMe();
        if (res.success && res.data?.role === "ADMIN") {
          setAuthorized(true);
        } else {
          router.replace("/dashboard");
        }
      } catch {
        router.replace("/login");
      } finally {
        setChecking(false);
      }
    }
    check();
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Loading size="lg" text="Verifying admin credentials..." />
      </div>
    );
  }

  if (!authorized) return null;

  const isActive = (href: string, exact: boolean) =>
    exact
      ? pathname === href
      : pathname === href || pathname?.startsWith(href + "/");

  const { title, subtitle } = getAdminPageMeta(pathname || "");

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Admin Sidebar ───────────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] lg:translate-x-0 lg:fixed lg:z-auto",
          "bg-slate-900 border-r border-slate-800/80 flex flex-col",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-slate-800/80 shrink-0">
          <Link
            href="/admin"
            className="flex items-center gap-2.5 group"
            onClick={() => setSidebarOpen(false)}
          >
            <div className="w-8 h-8 bg-gradient-to-tr from-purple-600 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/25 group-hover:scale-105 transition-transform">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-base font-extrabold text-white tracking-tight">
                  Invoice<span className="text-purple-400">Pilot</span>
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.2 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-md">
                  ADMIN
                </span>
              </div>
            </div>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto" aria-label="Admin navigation">
          <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
            Administration
          </p>
          {adminNav.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "group flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                  active
                    ? "bg-purple-500/15 text-purple-400 shadow-sm"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 shrink-0",
                      active
                        ? "bg-purple-500/20 text-purple-400"
                        : "bg-slate-800 text-slate-400 group-hover:bg-slate-700 group-hover:text-slate-200"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                  </div>
                  <span>{item.name}</span>
                </div>
                {active && (
                  <ChevronRight className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sign Out Footer */}
        <div className="p-3 border-t border-slate-800/80 shrink-0">
          <SignOutButton>
            <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-150 group">
              <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center group-hover:bg-red-500/20 transition-colors shrink-0">
                <LogOut className="w-4 h-4" />
              </div>
              Sign Out
            </button>
          </SignOutButton>
        </div>
      </aside>

      {/* ── Main content area ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col lg:pl-64 min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 h-16 flex items-center justify-between px-4 sm:px-6 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
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
                <p className="text-xs text-slate-500 hidden sm:block truncate mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden md:inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
              <Shield className="w-3.5 h-3.5" /> Super Admin
            </span>
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: "w-9 h-9 ring-2 ring-purple-500/20 ring-offset-2 hover:ring-purple-500/40 transition-all",
                },
              }}
            />
          </div>
        </header>

        {/* Main page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
