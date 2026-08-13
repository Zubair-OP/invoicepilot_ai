"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Loading from "@/components/ui/Loading";
import type { Customer } from "@/types";

import { useToast } from "@/context/ToastContext";

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast, confirmModal } = useToast();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    taxId: "",
    notes: "",
  });

  useEffect(() => {
    async function load() {
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
        }
      } catch {} finally {
        setLoading(false);
      }
    }
    load();
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
    } catch (err: any) {
      toast.error(err.message || "Failed to update customer");
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
    try {
      const { api } = await import("@/lib/api");
      await api.deleteCustomer(params.id as string);
      toast.info("Customer deleted.");
      router.push("/dashboard/customers");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete customer");
    }
  };

  if (loading) return <Loading size="lg" text="Loading customer..." />;
  if (!customer) return <div className="text-center py-12 text-gray-500">Customer not found</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/customers" className="p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h2 className="text-2xl font-bold text-gray-900">{customer.name}</h2>
        </div>
        <Button variant="danger" onClick={handleDelete}>
          <Trash2 className="w-4 h-4 mr-2" />
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
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
