"use client";

import { useEffect, useState } from "react";
import { Search, Shield, UserCheck, UserX, Loader2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ErrorState from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/utils";
import type { User } from "@/types";

import { useToast } from "@/context/ToastContext";

function UsersTableSkeleton() {
  return (
    <div className="p-6 space-y-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <Skeleton className="h-4 w-40 rounded-md" />
          <Skeleton className="h-4 w-24 rounded-md" />
          <Skeleton className="h-4 w-24 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-lg ml-auto" />
        </div>
      ))}
    </div>
  );
}

export default function AdminUsersPage() {
  const { toast, confirmModal } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(false);
    try {
      const { api } = await import("@/lib/api");
      const params: Record<string, string> = { page: String(page), limit: "10" };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      const res = await api.adminGetUsers(params);
      if (res.success) {
        setUsers(res.data);
        setTotalPages(res.meta?.totalPages || 1);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, roleFilter]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    const ok = await confirmModal({
      title: "Change User Role",
      message: `Change user role to ${newRole}?`,
      confirmText: "Change Role",
      variant: newRole === "ADMIN" ? "danger" : "primary",
    });
    if (!ok) return;
    setBusyId(userId);
    try {
      const { api } = await import("@/lib/api");
      await api.adminChangeRole(userId, newRole);
      setUsers(users.map((u) => (u._id === userId ? { ...u, role: newRole as "USER" | "ADMIN" } : u)));
      toast.success(`Role updated to ${newRole}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to change role");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              fetchUsers();
            }}
            className="flex-1 flex gap-2"
          >
            <div className="flex-1 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
              />
            </div>
            <Button type="submit" variant="secondary" size="md">
              Search
            </Button>
          </form>

          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          >
            <option value="">All Platform Roles</option>
            <option value="USER">Standard Users</option>
            <option value="ADMIN">Super Admins</option>
          </select>
        </div>

        {loading ? (
          <UsersTableSkeleton />
        ) : error ? (
          <div className="py-8">
            <ErrorState
              title="Couldn't load platform accounts"
              description="We ran into a problem connecting. Please try again."
              onRetry={fetchUsers}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                  <th className="text-left py-3.5 px-4 rounded-l-xl">User Profile</th>
                  <th className="text-left py-3.5 px-4">System Role</th>
                  <th className="text-left py-3.5 px-4 hidden sm:table-cell">Registration Date</th>
                  <th className="text-right py-3.5 px-4 rounded-r-xl">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-10 text-slate-400 text-sm">
                      {search || roleFilter ? "No users match your filters" : "No registered users found"}
                    </td>
                  </tr>
                ) : (
                users.map((user) => {
                  const initial = (user.name || user.email || "U").charAt(0).toUpperCase();
                  const isAdmin = user.role === "ADMIN";
                  const busy = busyId === user._id;

                  return (
                    <tr key={user._id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            isAdmin
                              ? "bg-purple-100 text-purple-700 border border-purple-200"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}>
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">{user.name || "Unnamed User"}</p>
                            <p className="text-xs text-slate-500 truncate">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                          isAdmin
                            ? "bg-purple-50 text-purple-700 border border-purple-200"
                            : "bg-slate-100 text-slate-700 border border-slate-200"
                        }`}>
                          {isAdmin && <Shield className="w-3 h-3 text-purple-600" />}
                          {user.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 text-xs hidden sm:table-cell font-medium">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {user.role === "USER" ? (
                            <button
                              onClick={() => handleRoleChange(user._id, "ADMIN")}
                              disabled={busy}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors disabled:opacity-60"
                              title="Promote to Admin"
                              aria-label={`Promote ${user.name || user.email} to Admin`}
                            >
                              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                              Promote
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRoleChange(user._id, "USER")}
                              disabled={busy}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors disabled:opacity-60"
                              title="Demote to User"
                              aria-label={`Demote ${user.name || user.email} to User`}
                            >
                              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserX className="w-3.5 h-3.5" />}
                              Demote
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
                )}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-4 border-t border-slate-100 mt-4">
            <p className="text-xs font-medium text-slate-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
