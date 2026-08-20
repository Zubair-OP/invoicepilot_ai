"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  CreditCard,
  LogOut,
  X,
  ChevronRight,
  LayoutTemplate,
} from "lucide-react";
import { SignOutButton } from "@clerk/nextjs";
import BrandLogo from "@/components/common/BrandLogo";
import { cn } from "@/lib/utils";

const navigation = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    name: "Invoices",
    href: "/dashboard/invoices",
    icon: FileText,
    exact: false,
  },
  {
    name: "Customers",
    href: "/dashboard/customers",
    icon: Users,
    exact: false,
  },
  {
    name: "Templates",
    href: "/dashboard/templates",
    icon: LayoutTemplate,
    exact: false,
  },
  {
    name: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    exact: false,
  },
  {
    name: "Billing",
    href: "/dashboard/billing",
    icon: CreditCard,
    exact: false,
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string, exact: boolean) =>
    exact
      ? pathname === href
      : pathname === href || pathname?.startsWith(href + "/");

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden print:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] lg:translate-x-0 lg:fixed lg:z-auto print:hidden",
          "bg-slate-900 border-r border-slate-800/80 flex flex-col",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* ── Brand header ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-slate-800/80 shrink-0">
          <BrandLogo
            size="xs"
            theme="dark"
            showBadge={true}
            href="/dashboard"
            onClick={onClose}
          />
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Navigation ────────────────────────────────────────────── */}
        <nav
          className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto"
          aria-label="Sidebar navigation"
        >
          <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
            Menu
          </p>
          {navigation.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "group flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                  active
                    ? "bg-emerald-500/15 text-emerald-400 shadow-sm"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 shrink-0",
                      active
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-slate-800 text-slate-400 group-hover:bg-slate-700 group-hover:text-slate-200"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                  </div>
                  <span>{item.name}</span>
                </div>
                {active && (
                  <ChevronRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* ── Sign out footer ───────────────────────────────────────── */}
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
    </>
  );
}