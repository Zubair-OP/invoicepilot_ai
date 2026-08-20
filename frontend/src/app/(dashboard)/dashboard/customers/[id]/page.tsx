"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Trash2, UserX } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import ErrorState from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { getErrorMessage, getErrorStatus } from "@/lib/api";
import type { Customer } from "@/types";

import { useToast } from "@/context/ToastContext";

function CustomerDetailSkeleton() {
  return (
    <div className="max-w-2xl mx-auto space-y-6" role="status" aria-label="Loading customer">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <Skeleton className="h-8 w-44 rounded-lg" />
        </div>
        <Skeleton className="h-10 w-24 rounded-lg" />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-28 rounded-md" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
        <div className="flex justify-end gap-2 pt-4">
          <Skeleton className="h-10 w-24 rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast, confirmModal } = useToast();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<"error" | "notfound" | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    taxId: "",
    notes: "",
  });

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { api } = await import("@/lib/api");
      const res = await api.getCustomer(params.id as string);
      if (res.success) {
        setCustomer(res.data);
        setForm({
          name: res.data.name || "",
          email: res.data.email || "",
          phone: res.data.phone || "",
          address: res.data.address || "",
          taxId: res.data.taxId || "",
          notes: res.data.notes || "",
        });
      } else {
        setLoadError("notfound");
      }
    } catch (err) {
      setLoadError(getErrorStatus(err) === 404 ? "notfound" : "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Customer name cannot be empty.", "Validation Error");
      return;
    }
    setSaving(true);
    try {
      const { api } = await import("@/lib/api");
      await api.updateCustomer(params.id as string, form);
      toast.success("Customer profile updated successfully!");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update customer"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirmModal({
      title: "Delete Customer",
      message: `Are you sure you want to delete customer "${customer?.name}"?`,
      confirmText: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    setDeleting(true);
    try {
      const { api } = await import("@/lib/api");
      await api.deleteCustomer(params.id as string);
      toast.info("Customer deleted.");
      router.push("/dashboard/customers");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete customer"));
      setDeleting(false);
    }
  };

  if (loading) return <CustomerDetailSkeleton />;

  if (loadError === "notfound") {
    return (
      <div className="max-w-2xl mx-auto min-h-[50vh] flex items-center justify-center">
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <UserX className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">Customer not found</h3>
          <p className="text-sm text-gray-500 mb-5 max-w-sm">
            This customer may have been deleted or the link is incorrect.
          </p>
          <Link href="/dashboard/customers">
            <Button variant="outline">Back to Customers</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (loadError === "error") {
    return (
      <div className="max-w-2xl mx-auto min-h-[50vh] flex items-center justify-center">
        <ErrorState
          title="Couldn't load this customer"
          description="We ran into a problem connecting. Please try again."
          onRetry={load}
        />
      </div>
    );
  }

  if (!customer) return <div className="text-center py-12 text-gray-500">Customer unavailable</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/customers" className="p-2 rounded-lg hover:bg-gray-100" aria-label="Back to customers">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h2 className="text-2xl font-bold text-gray-900">{customer.name}</h2>
        </div>
        <Button variant="danger" onClick={handleDelete} loading={deleting} loadingText="Deleting...">
          <Trash2 className="w-4 h-4 mr-2" aria-hidden="true" />
          Delete
        </Button>
      </div>

      <Card className="space-y-4">
        <Input label="Customer Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <div className="grid sm:grid-cols-2 gap-4">
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <Textarea label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} />
        <Input label="Tax ID" value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} />
        <Textarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
        <div className="flex justify-end gap-2 pt-4">
          <Link href="/dashboard/customers"><Button variant="outline">Cancel</Button></Link>
          <Button onClick={handleSave} loading={saving} loadingText="Saving...">
            <Save className="w-4 h-4 mr-2" aria-hidden="true" />
            Save Changes
          </Button>
        </div>
      </Card>
    </div>
  );
}