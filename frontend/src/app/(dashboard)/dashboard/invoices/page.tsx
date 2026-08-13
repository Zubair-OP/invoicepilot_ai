"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Filter, MoreVertical, FileText, Download, Send, Trash2, Eye } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Loading from "@/components/ui/Loading";
import EmptyState from "@/components/ui/EmptyState";
import { formatCurrency, formatDate, getStatusColor } from "@/lib/utils";
import type { Invoice } from "@/types";

import { useToast } from "@/context/ToastContext";

export default function InvoicesPage() {
  const { toast, confirmModal } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const { api } = await import("@/lib/api");
      const params: Record<string, string> = { page: String(page), limit: "10" };
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const res = await api.getInvoices(params);
      if (res.success) {
        setInvoices(res.data);
        if (res.meta) setTotalPages(res.meta.totalPages);
      }
    } catch {
      // Error handling
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [page, statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchInvoices();
  };

  const handleDelete = async (id: string, invoiceNumber?: string) => {
    const ok = await confirmModal({
      title: "Delete Draft Invoice",
      message: `Are you sure you want to delete ${invoiceNumber || "this draft invoice"}?`,
      confirmText: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    try {
      const { api } = await import("@/lib/api");
      await api.deleteInvoice(id);
      setInvoices(invoices.filter((inv) => inv._id !== id));
      toast.success("Draft invoice deleted.");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete invoice");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Invoices</h2>
          <p className="text-sm text-gray-500 mt-1">Manage and track all your invoices</p>
        </div>
        <Link href="/dashboard/invoices/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Invoice
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search invoices..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">Search</Button>
        </form>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">All Status</option>
          <option value="DRAFT">Draft</option>
          <option value="SENT">Sent</option>
          <option value="PAID">Paid</option>
          <option value="OVERDUE">Overdue</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </Card>

      {/* Invoice List */}
      {loading ? (
        <Loading size="lg" text="Loading invoices..." />
      ) : invoices.length === 0 ? (
        <EmptyState
          title="No invoices found"
          description={search ? "Try a different search term" : "Create your first invoice to get started"}
          action={
            !search && (
              <Link href="/dashboard/invoices/new">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Invoice
                </Button>
              </Link>
            )
          }
        />
      ) : (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Invoice</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Customer</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 hidden sm:table-cell">Date</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">Amount</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv._id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <Link href={`/dashboard/invoices/${inv._id}`} className="font-medium text-gray-900 hover:text-green-600 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-400" />
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {((typeof inv.customerId === "object" && inv.customerId !== null ? (inv.customerId as any).name : inv.customer?.name) || "—")}
                    </td>
                    <td className="py-3 px-4 text-gray-500 hidden sm:table-cell">{formatDate(inv.issuedAt)}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(inv.status)}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-gray-900">
                      {formatCurrency(inv.total, inv.currency)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/dashboard/invoices/${inv._id}`} className="p-1.5 rounded hover:bg-gray-100" title="View">
                          <Eye className="w-4 h-4 text-gray-500" />
                        </Link>
                        <a href={`${process.env.NEXT_PUBLIC_API_URL}/invoices/${inv._id}/pdf`} className="p-1.5 rounded hover:bg-gray-100" title="Download PDF" target="_blank">
                          <Download className="w-4 h-4 text-gray-500" />
                        </a>
                        {inv.status === "DRAFT" && (
                          <button onClick={() => handleDelete(inv._id)} className="p-1.5 rounded hover:bg-red-50" title="Delete">
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
