"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";

export default function NewCustomerPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    taxId: "",
    notes: "",
  });

  const handleSave = async () => {
    if (!form.name.trim()) {
      alert("Customer name is required");
      return;
    }
    setSaving(true);
    try {
      const { api } = await import("@/lib/api");
      const res = await api.createCustomer(form);
      if (res.success) {
        router.push("/dashboard/customers");
      }
    } catch (err: any) {
      alert(err.message || "Failed to create customer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/customers" className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Add Customer</h2>
          <p className="text-sm text-gray-500">Create a new customer contact</p>
        </div>
      </div>

      <Card className="space-y-4">
        <Input
          label="Customer Name *"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Acme Corp"
        />
        <div className="grid sm:grid-cols-2 gap-4">
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="billing@acme.com"
          />
          <Input
            label="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+1 234 567 890"
          />
        </div>
        <Textarea
          label="Address"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          placeholder="123 Main St, City, Country"
          rows={2}
        />
        <Input
          label="Tax ID / GSTIN"
          value={form.taxId}
          onChange={(e) => setForm({ ...form, taxId: e.target.value })}
          placeholder="27AABCU9603R1ZM"
        />
        <Textarea
          label="Notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Internal notes about this customer"
          rows={2}
        />
        <div className="flex justify-end gap-2 pt-4">
          <Link href="/dashboard/customers">
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Save Customer"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
