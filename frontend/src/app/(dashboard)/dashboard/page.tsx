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
} from "lucide-react";
import Card from "@/components/ui/Card";
import Loading from "@/components/ui/Loading";
import EmptyState from "@/components/ui/EmptyState";
import Badge from "@/components/ui/Badge";
import { formatCurrency, formatDate, getStatusColor } from "@/lib/utils";
import type { DashboardData } from "@/types";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const { api } = await import("@/lib/api");
        const res = await api.getDashboard();
        if (res.success) {
          setData(res.data);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  if (loading) return <Loading size="lg" text="Loading dashboard..." />;
  if (error) return <div className="text-center py-12 text-red-600">{error}</div>;
  if (!data) return <EmptyState title="No data available" />;

  const totalOutstanding = data.totals.outstanding.reduce((sum, t) => sum + t.amount, 0);
  const totalPaid = data.totals.paid.reduce((sum, t) => sum + t.amount, 0);
  const overdueCount = data.totals.overdue.count;
  const totalInvoices = data.invoicesByStatus.reduce((sum, s) => sum + s.count, 0);

  const stats = [
    {
      label: "Total Invoices",
      value: totalInvoices,
      icon: FileText,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Outstanding",
      value: formatCurrency(totalOutstanding),
      icon: Clock,
      color: "text-yellow-600",
      bg: "bg-yellow-50",
    },
    {
      label: "Paid",
      value: formatCurrency(totalPaid),
      icon: DollarSign,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Overdue",
      value: overdueCount,
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-sm text-gray-500 mt-1">Overview of your invoicing activity</p>
        </div>
        <Link
          href="/dashboard/invoices/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Invoice
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${stat.bg}`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Recent Invoices */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Invoices</h3>
          <Link
            href="/dashboard/invoices"
            className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
          >
            View all <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
        {data.recentInvoices.length === 0 ? (
          <EmptyState
            title="No invoices yet"
            description="Create your first invoice to get started"
            action={
              <Link
                href="/dashboard/invoices/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
              >
                <Plus className="w-4 h-4" />
                Create Invoice
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Invoice</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Customer</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Date</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.recentInvoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <Link href={`/dashboard/invoices/${inv.id}`} className="font-medium text-gray-900 hover:text-green-600">
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{inv.customerName}</td>
                    <td className="py-3 px-4 text-gray-500">{formatDate(inv.issuedAt)}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(inv.status)}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-gray-900">
                      {formatCurrency(inv.total, inv.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Top Customers */}
      {data.topCustomers.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Customers</h3>
          <div className="space-y-3">
            {data.topCustomers.map((customer) => (
              <div key={customer.customerId} className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-gray-900">{customer.name}</p>
                  <p className="text-sm text-gray-500">{customer.invoiceCount} invoices</p>
                </div>
                <p className="font-semibold text-gray-900">
                  {formatCurrency(customer.revenue, customer.currency)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
