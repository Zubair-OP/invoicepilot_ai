"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  DollarSign,
  Clock,
  AlertTriangle,
  Plus,
  ArrowUpRight,
  TrendingUp,
  Users,
  Zap,
  ChevronRight,
  CheckCircle2,
  Circle,
  Sparkles,
} from "lucide-react";
import Loading from "@/components/ui/Loading";
import EmptyState from "@/components/ui/EmptyState";
import { formatCurrency, formatDate, getStatusColor } from "@/lib/utils";
import type { DashboardData } from "@/types";

/* ─────────────────────────────────────────────────────────────────────────
   Status pill helper
   ───────────────────────────────────────────────────────────────────── */
function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    PAID: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
    SENT: "bg-blue-50 text-blue-700 border-blue-200/80",
    DRAFT: "bg-slate-100 text-slate-600 border-slate-200",
    OVERDUE: "bg-red-50 text-red-700 border-red-200/80",
    CANCELLED: "bg-slate-100 text-slate-400 border-slate-200",
  };
  const cls = map[status?.toUpperCase()] ?? "bg-slate-100 text-slate-500 border-slate-200";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}
    >
      {status}
    </span>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [greeting, setGreeting] = useState("Good morning");

  useEffect(() => {
    const h = new Date().getHours();
    if (h >= 12 && h < 17) setGreeting("Good afternoon");
    else if (h >= 17) setGreeting("Good evening");
  }, []);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const { api } = await import("@/lib/api");
        const res = await api.getDashboard();
        if (res.success) setData(res.data);
      } catch (err: any) {
        setError(err.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loading size="lg" text="Loading dashboard..." />
      </div>
    );
  if (error)
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">{error}</p>
        </div>
      </div>
    );
  if (!data) return <EmptyState title="No data available" />;

  const totalOutstanding = data.totals.outstanding.reduce(
    (sum, t) => sum + t.amount,
    0
  );
  const totalPaid = data.totals.paid.reduce((sum, t) => sum + t.amount, 0);
  const overdueCount = data.totals.overdue.count;
  const totalInvoices = data.invoicesByStatus.reduce(
    (sum, s) => sum + s.count,
    0
  );

  const stats = [
    {
      label: "Total Invoices",
      value: String(totalInvoices),
      subtext: "All time",
      icon: FileText,
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-600",
      accentBar: "from-blue-500 to-indigo-500",
      trend: "+12% this month",
      trendUp: true,
    },
    {
      label: "Outstanding",
      value: formatCurrency(totalOutstanding),
      subtext: "Awaiting payment",
      icon: Clock,
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-600",
      accentBar: "from-amber-400 to-orange-500",
      trend: "Due soon",
      trendUp: null,
    },
    {
      label: "Total Collected",
      value: formatCurrency(totalPaid),
      subtext: "Paid invoices",
      icon: DollarSign,
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-600",
      accentBar: "from-emerald-500 to-teal-500",
      trend: "Revenue collected",
      trendUp: true,
    },
    {
      label: "Overdue",
      value: String(overdueCount),
      subtext: overdueCount === 0 ? "All clear 🎉" : "Need attention",
      icon: AlertTriangle,
      iconBg: "bg-red-500/10",
      iconColor: "text-red-600",
      accentBar: "from-red-400 to-rose-500",
      trend: overdueCount > 0 ? "Action needed" : "All clear",
      trendUp: overdueCount === 0,
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl">
      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-emerald-600 mb-0.5">
            {greeting} 👋
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Your Invoice Overview
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Here&apos;s what&apos;s happening with your business today.
          </p>
        </div>
        <Link
          href="/dashboard/invoices/new"
          id="dashboard-new-invoice-btn"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shrink-0"
        >
          <Zap className="w-4 h-4" />
          New Invoice
        </Link>
      </div>

      {/* ── Stats grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="relative bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden group"
          >
            {/* Coloured top accent bar */}
            <div
              className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.accentBar} opacity-80`}
            />
            <div className="flex items-start justify-between mb-4">
              <div
                className={`w-10 h-10 rounded-xl ${stat.iconBg} flex items-center justify-center group-hover:scale-110 transition-transform duration-200`}
              >
                <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
              </div>
              {stat.trendUp !== null && (
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    stat.trendUp
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-red-50 text-red-600"
                  }`}
                >
                  {stat.trendUp ? "↑" : "↓"} {stat.trend}
                </span>
              )}
            </div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              {stat.label}
            </p>
            <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {stat.value}
            </p>
            <p className="text-xs text-slate-400 mt-1">{stat.subtext}</p>
          </div>
        ))}
      </div>

      {/* ── Two-column section ──────────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Invoices — 2/3 width */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 text-blue-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Recent Invoices
              </h3>
            </div>
            <Link
              href="/dashboard/invoices"
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              View all <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {data.recentInvoices.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No invoices yet"
                description="Create your first invoice to get started"
                action={
                  <Link
                    href="/dashboard/invoices/new"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 active:scale-95 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Create Invoice
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100">
                    <th className="text-left py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Invoice
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">
                      Date
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-right py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.recentInvoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      <td className="py-3.5 px-6">
                        <Link
                          href={`/dashboard/invoices/${inv.id}`}
                          className="font-semibold text-slate-800 hover:text-emerald-600 transition-colors flex items-center gap-1.5 group-hover:gap-2"
                        >
                          {inv.invoiceNumber}
                          <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all text-emerald-500" />
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium">
                        {inv.customerName}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 text-xs hidden sm:table-cell">
                        {formatDate(inv.issuedAt)}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusPill status={inv.status} />
                      </td>
                      <td className="py-3.5 px-6 text-right font-bold text-slate-900">
                        {formatCurrency(inv.total, inv.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right column — Top Customers + Quick Actions */}
        <div className="space-y-6">
          {/* Top Customers */}
          {data.topCustomers.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
                <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                  <Users className="w-4 h-4 text-purple-600" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Top Customers
                </h3>
              </div>
              <div className="p-4 space-y-2">
                {data.topCustomers.map((customer, idx) => (
                  <div
                    key={customer.customerId}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group"
                  >
                    {/* Rank badge */}
                    <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                      {idx + 1}
                    </div>
                    {/* Avatar initials */}
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {customer.name
                        .split(" ")
                        .map((w: string) => w[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-sm truncate">
                        {customer.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {customer.invoiceCount} invoice
                        {customer.invoiceCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <p className="font-bold text-slate-900 text-sm shrink-0">
                      {formatCurrency(customer.revenue, customer.currency)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-slate-700/50 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700/50">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Quick Actions</h3>
              </div>
            </div>
            <div className="p-3 space-y-1.5">
              {[
                {
                  label: "Create AI Invoice",
                  href: "/dashboard/invoices/new",
                  icon: Zap,
                  highlight: true,
                },
                {
                  label: "Add Customer",
                  href: "/dashboard/customers",
                  icon: Users,
                  highlight: false,
                },
                {
                  label: "Browse Templates",
                  href: "/dashboard/templates",
                  icon: FileText,
                  highlight: false,
                },
                {
                  label: "View All Invoices",
                  href: "/dashboard/invoices",
                  icon: TrendingUp,
                  highlight: false,
                },
              ].map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                    action.highlight
                      ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                      : "text-slate-400 hover:bg-slate-700/50 hover:text-slate-100"
                  }`}
                >
                  <action.icon className="w-4 h-4 shrink-0" />
                  {action.label}
                  <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Invoice Status breakdown bar ───────────────────────────── */}
      {data.invoicesByStatus.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="w-4 h-4 text-slate-400" />
            <h3 className="text-base font-bold text-slate-900">
              Invoice Status Breakdown
            </h3>
          </div>
          <div className="space-y-3">
            {data.invoicesByStatus.map((s, idx) => {
              const statusName = s.status || (s as any)._id || `status-${idx}`;
              const pct =
                totalInvoices > 0
                  ? Math.round((s.count / totalInvoices) * 100)
                  : 0;
              const colMap: Record<string, string> = {
                PAID: "bg-emerald-500",
                SENT: "bg-blue-500",
                DRAFT: "bg-slate-300",
                OVERDUE: "bg-red-500",
                CANCELLED: "bg-slate-200",
              };
              const bar = colMap[statusName.toUpperCase()] ?? "bg-slate-300";
              return (
                <div key={statusName} className="flex items-center gap-4">
                  <div className="w-20 text-xs font-semibold text-slate-500 uppercase tracking-wide shrink-0">
                    {statusName}
                  </div>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${bar} transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="w-8 text-xs font-bold text-slate-700 text-right shrink-0">
                    {s.count}
                  </div>
                  <div className="w-10 text-xs text-slate-400 text-right shrink-0">
                    {pct}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
