"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Edit, Trash2, Eye, Loader2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ErrorState from "@/components/ui/ErrorState";
import EmptyState from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/utils";
import type { Customer } from "@/types";

import { useToast } from "@/context/ToastContext";

function CustomerTableSkeleton() {
  return (
    <Card padding={false}>
      <div className="p-6 space-y-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-4 w-32 rounded-md" />
            <Skeleton className="h-4 w-40 rounded-md" />
            <Skeleton className="h-4 w-24 rounded-md" />
            <Skeleton className="h-4 w-16 rounded-md ml-auto" />
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function CustomersPage() {
  const { toast, confirmModal } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const { api } = await import("@/lib/api");
      const params: Record<string, string> = { page: String(page), limit: "10" };
      if (search) params.search = search;
      const res = await api.getCustomers(params);
      if (res.success) {
        setCustomers(res.data);
        if (res.meta) setTotalPages(res.meta.totalPages);
      }
    } catch {
      setError("We couldn't load your customers right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchCustomers();
  };

  const handleDelete = async (id: string, name?: string) => {
    const ok = await confirmModal({
      title: "Delete Customer",
      message: `Are you sure you want to delete ${name ? `"${name}"` : "this customer"}?`,
      confirmText: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    setDeletingId(id);
    try {
      const { api } = await import("@/lib/api");
      await api.deleteCustomer(id);
      setCustomers((prev) => prev.filter((c) => c._id !== id));
      toast.success("Customer deleted successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete customer");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Customers</h2>
          <p className="text-sm text-gray-500 mt-1">Manage your client contacts</p>
        </div>
        <Link href="/dashboard/customers/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Customer
          </Button>
        </Link>
      </div>

      <Card>
        <form onSubmit={handleSearch} className="mb-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search customers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <Button type="submit" variant="secondary" size="sm">Search</Button>
          </div>
        </form>

        {loading ? (
          <CustomerTableSkeleton />
        ) : error ? (
          <ErrorState
            title="Couldn't load your customers"
            description="We ran into a problem connecting. Please try again."
            onRetry={fetchCustomers}
          />
        ) : customers.length === 0 ? (
          <EmptyState
            title={search ? "No customers match your search" : "No customers yet"}
            description={search ? "Try a different search term" : "Add your first customer"}
            action={
              !search && (
                <Link href="/dashboard/customers/new">
                  <Button><Plus className="w-4 h-4 mr-2" />Add Customer</Button>
                </Link>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Email</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 hidden sm:table-cell">Phone</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 hidden md:table-cell">Created</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => {
                  const busy = deletingId === customer._id;
                  return (
                    <tr key={customer._id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <Link href={`/dashboard/customers/${customer._id}`} className="font-medium text-gray-900 hover:text-green-600">
                          {customer.name}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{customer.email || "—"}</td>
                      <td className="py-3 px-4 text-gray-500 hidden sm:table-cell">{customer.phone || "—"}</td>
                      <td className="py-3 px-4 text-gray-500 hidden md:table-cell">{formatDate(customer.createdAt)}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/dashboard/customers/${customer._id}`}
                            className="p-1.5 rounded hover:bg-gray-100"
                            title="View"
                            aria-label={`View customer ${customer.name}`}
                          >
                            <Eye className="w-4 h-4 text-gray-500" />
                          </Link>
                          <Link
                            href={`/dashboard/customers/${customer._id}/edit`}
                            className="p-1.5 rounded hover:bg-gray-100"
                            title="Edit"
                            aria-label={`Edit customer ${customer.name}`}
                          >
                            <Edit className="w-4 h-4 text-gray-500" />
                          </Link>
                          <button
                            onClick={() => handleDelete(customer._id, customer.name)}
                            className="p-1.5 rounded hover:bg-red-50 disabled:opacity-50"
                            title="Delete"
                            aria-label={`Delete customer ${customer.name}`}
                            disabled={busy}
                          >
                            {busy ? (
                              <Loader2 className="w-4 h-4 text-red-500 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4 text-red-500" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

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
    </div>
  );
}