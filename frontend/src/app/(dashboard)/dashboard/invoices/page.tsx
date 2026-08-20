"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, FileText, Download, Trash2, Eye, Loader2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ErrorState from "@/components/ui/ErrorState";
import EmptyState from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency, formatDate, getStatusColor } from "@/lib/utils";
import type { Invoice } from "@/types";

import { useToast } from "@/context/ToastContext";

function InvoiceTableSkeleton() {
  return (
    <Card padding={false}>
      <div className="p-6 space-y-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="h-4 w-24 rounded-md" />
            <Skeleton className="h-4 w-16 rounded-md" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-4 w-16 rounded-md ml-auto" />
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function InvoicesPage() {
  const { toast, confirmModal } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchInvoices = async () => {
    setLoading(true);
    setError(null);
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
      setError("We couldn't load your invoices right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setActionId(id);
    try {
      const { api } = await import("@/lib/api");
      await api.deleteInvoice(id);
      setInvoices((prev) => prev.filter((inv) => inv._id !== id));
      toast.success("Draft invoice deleted.");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete invoice");
    } finally {
      setActionId(null);
    }
  };

  const handleDownloadPdf = async (id: string, invoiceNumber?: string) => {
    setActionId(id);
    try {
      const { api } = await import("@/lib/api");
      toast.info("Preparing your PDF, this usually takes a few seconds...", "Downloading");
      await api.downloadInvoicePdf(id, invoiceNumber);
      toast.success("PDF downloaded successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to download PDF");
    } finally {
      setActionId(null);
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
        <InvoiceTableSkeleton />
      ) : error ? (
        <Card>
          <ErrorState
            title="Couldn't load your invoices"
            description="We ran into a problem connecting. Please try again."
            onRetry={fetchInvoices}
          />
        </Card>
      ) : invoices.length === 0 ? (
        <EmptyState
          title={search || statusFilter ? "No invoices match your filters" : "No invoices yet"}
          description={
            search || statusFilter
              ? "Try adjusting your search or filters"
              : "Create your first invoice to get started"
          }
          action={
            !search && !statusFilter && (
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
                {invoices.map((inv) => {
                  const busy = actionId === inv._id;
                  return (
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
                          <Link
                            href={`/dashboard/invoices/${inv._id}`}
                            className="p-1.5 rounded hover:bg-gray-100"
                            title="View"
                            aria-label={`View invoice ${inv.invoiceNumber}`}
                          >
                            <Eye className="w-4 h-4 text-gray-500" />
                          </Link>
                          <button
                            onClick={() => handleDownloadPdf(inv._id, inv.invoiceNumber)}
                            className="p-1.5 rounded hover:bg-gray-100 transition-colors disabled:opacity-50"
                            title="Download PDF"
                            aria-label={`Download PDF for ${inv.invoiceNumber}`}
                            disabled={busy}
                          >
                            {busy ? (
                              <Loader2 className="w-4 h-4 text-green-600 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4 text-gray-500" />
                            )}
                          </button>
                          {inv.status === "DRAFT" && (
                            <button
                              onClick={() => handleDelete(inv._id, inv.invoiceNumber)}
                              className="p-1.5 rounded hover:bg-red-50 disabled:opacity-50"
                              title="Delete"
                              aria-label={`Delete invoice ${inv.invoiceNumber}`}
                              disabled={busy}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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