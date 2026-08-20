"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Sparkles, Save } from "lucide-react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/context/ToastContext";
import { formatCurrency } from "@/lib/utils";
import { getErrorMessage } from "@/lib/api";
import { useProgressiveStatus } from "@/hooks/useProgressiveStatus";
import type { Customer } from "@/types";

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export default function NewInvoicePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [customersError, setCustomersError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const slowStatus = useProgressiveStatus(aiLoading);

  const [form, setForm] = useState({
    customerId: "",
    items: [{ description: "", quantity: 1, unitPrice: 0 }] as InvoiceItem[],
    currency: "USD",
    taxComponents: [] as { name: string; rate: number }[],
    discount: 0,
    notes: "",
    dueDate: "",
  });

  useEffect(() => {
    async function load() {
      setLoading(true);
      setCustomersError(false);
      try {
        const { api } = await import("@/lib/api");
        const res = await api.getCustomers({ limit: "100" });
        if (res.success) setCustomers(res.data);
      } catch {
        setCustomersError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const addItem = () => {
    setForm({ ...form, items: [...form.items, { description: "", quantity: 1, unitPrice: 0 }] });
  };

  const removeItem = (index: number) => {
    if (form.items.length <= 1) return;
    setForm({ ...form, items: form.items.filter((_, i) => i !== index) });
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const items = [...form.items];
    items[index] = { ...items[index], [field]: value };
    setForm({ ...form, items });
  };

  const subtotal = form.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxTotal = form.taxComponents.reduce((sum, t) => sum + (subtotal * t.rate) / 100, 0);
  const total = subtotal + taxTotal - form.discount;

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) {
      toast.warning("Please enter a prompt describing the invoice");
      return;
    }
    setAiLoading(true);
    try {
      const { api } = await import("@/lib/api");
      const res = await api.generateInvoice(aiPrompt);
      if (res.success && res.data) {
        const draft = res.data;
        setForm((prev) => ({
          ...prev,
          customerId: draft.customerId || "",
          items: draft.items?.length ? draft.items : prev.items,
          currency: draft.currency || prev.currency,
          taxComponents: draft.taxComponents || [],
          discount: draft.discount || 0,
          notes: draft.notes || "",
          dueDate: draft.dueDate ? draft.dueDate.split("T")[0] : "",
        }));
        setShowAi(false);
        toast.success("Invoice fields filled with AI successfully!");
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "AI generation failed"));
    } finally {
      setAiLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.customerId) {
      toast.error("Please select a customer");
      return;
    }
    if (form.items.some((item) => !item.description.trim())) {
      toast.error("Please fill in all item descriptions");
      return;
    }
    setSaving(true);
    try {
      const { api } = await import("@/lib/api");
      const res = await api.createInvoice({
        customerId: form.customerId,
        items: form.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        currency: form.currency,
        taxComponents: form.taxComponents,
        discount: form.discount,
        notes: form.notes,
        dueDate: form.dueDate || undefined,
      });
      if (res.success) {
        toast.success("Invoice created successfully!");
        router.push(`/dashboard/invoices/${res.data._id}`);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to create invoice"));
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="max-w-5xl mx-auto space-y-6" role="status" aria-label="Loading new invoice">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-36 rounded-lg" />
              <Skeleton className="h-4 w-48 rounded-md" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-36 rounded-xl" />
            <Skeleton className="h-10 w-40 rounded-xl" />
          </div>
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <Skeleton className="h-5 w-32 rounded-md mb-4" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-3">
              <Skeleton className="h-5 w-32 rounded-md" />
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <Skeleton className="h-5 w-36 rounded-md mb-4" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full rounded-lg mb-3" />
            ))}
          </div>
        </div>
      </div>
    );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/invoices" className="p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">New Invoice</h2>
            <p className="text-sm text-gray-500">Create a new invoice</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowAi(!showAi)}>
            <Sparkles className="w-4 h-4 mr-2" />
            Fill with AI
          </Button>
          <Button onClick={handleSave} loading={saving} loadingText="Saving invoice...">
            <Save className="w-4 h-4 mr-2" />
            Save Invoice
          </Button>
        </div>
      </div>

      {/* AI Panel */}
      {showAi && (
        <Card className="border-green-200 bg-green-50/50">
          <h3 className="font-semibold text-gray-900 mb-2">AI Invoice Assistant</h3>
          <p className="text-sm text-gray-600 mb-3">
            Describe your invoice in plain English and AI will fill the form fields.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g., Invoice for Acme Corp for 5 laptops at $45,000 each, 18% GST, due on 30th August"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              onKeyDown={(e) => e.key === "Enter" && handleAiGenerate()}
            />
            <Button onClick={handleAiGenerate} loading={aiLoading} loadingText="Generating with AI...">
              Generate
            </Button>
          </div>
          {slowStatus && (
            <p className="mt-2 text-xs text-gray-500" role="status">{slowStatus}</p>
          )}
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer */}
          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">Customer</h3>
            <Select
              label="Select Customer"
              id="customerId"
              value={form.customerId}
              onChange={(e) => setForm({ ...form, customerId: e.target.value })}
              options={[
                { value: "", label: "Choose a customer..." },
                ...customers.map((c) => ({ value: c._id, label: c.name })),
              ]}
            />
            {customersError ? (
              <p className="text-sm text-red-600 mt-2" role="alert">
                {"We couldn't load your customers."}{" "}
                <button
                  onClick={() => window.location.reload()}
                  className="text-red-700 underline font-medium hover:text-red-800"
                >
                  Try again
                </button>
              </p>
            ) : customers.length === 0 && (
              <p className="text-sm text-gray-500 mt-2">
                No customers yet.{" "}
                <Link href="/dashboard/customers/new" className="text-green-600 hover:underline">
                  Create one
                </Link>
              </p>
            )}
          </Card>

          {/* Items */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Line Items</h3>
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="w-4 h-4 mr-1" />
                Add Item
              </Button>
            </div>
            <div className="space-y-3">
              {form.items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    {index === 0 && <label className="block text-xs text-gray-500 mb-1">Description</label>}
                    <input
                      type="text"
                      placeholder="Item description"
                      value={item.description}
                      onChange={(e) => updateItem(index, "description", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div className="col-span-2">
                    {index === 0 && <label className="block text-xs text-gray-500 mb-1">Qty</label>}
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div className="col-span-2">
                    {index === 0 && <label className="block text-xs text-gray-500 mb-1">Unit Price</label>}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(index, "unitPrice", parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div className="col-span-2">
                    {index === 0 && <label className="block text-xs text-gray-500 mb-1">Amount</label>}
                    <p className="py-2 text-sm font-medium text-gray-900">
                      {formatCurrency(item.quantity * item.unitPrice, form.currency)}
                    </p>
                  </div>
                  <div className="col-span-1">
                    {index === 0 && <label className="block text-xs text-gray-500 mb-1">&nbsp;</label>}
                    <button
                      onClick={() => removeItem(index)}
                      className="p-2 rounded hover:bg-red-50 text-red-500"
                      disabled={form.items.length <= 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Tax & Discount */}
          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">Tax & Discount</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label="Discount"
                type="number"
                min="0"
                step="0.01"
                value={form.discount}
                onChange={(e) => setForm({ ...form, discount: parseFloat(e.target.value) || 0 })}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tax Components</label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setForm({ ...form, taxComponents: [...form.taxComponents, { name: "Tax", rate: 0 }] })}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Tax
                </Button>
              </div>
            </div>
            {form.taxComponents.length > 0 && (
              <div className="mt-3 space-y-2">
                {form.taxComponents.map((tax, i) => (
                  <div key={i} className="flex gap-2 items-end">
                    <input
                      type="text"
                      placeholder="Tax name"
                      value={tax.name}
                      onChange={(e) => {
                        const taxes = [...form.taxComponents];
                        taxes[i].name = e.target.value;
                        setForm({ ...form, taxComponents: taxes });
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Rate %"
                      min="0"
                      max="100"
                      value={tax.rate}
                      onChange={(e) => {
                        const taxes = [...form.taxComponents];
                        taxes[i].rate = parseFloat(e.target.value) || 0;
                        setForm({ ...form, taxComponents: taxes });
                      }}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <button
                      onClick={() => setForm({ ...form, taxComponents: form.taxComponents.filter((_, j) => j !== i) })}
                      className="p-2 rounded hover:bg-red-50 text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Notes */}
          <Card>
            <Textarea
              label="Notes"
              placeholder="Additional notes or payment terms..."
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Card>
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-24">
            <h3 className="font-semibold text-gray-900 mb-4">Invoice Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal, form.currency)}</span>
              </div>
              {form.taxComponents.map((tax, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-500">{tax.name} ({tax.rate}%)</span>
                  <span className="font-medium">{formatCurrency((subtotal * tax.rate) / 100, form.currency)}</span>
                </div>
              ))}
              {form.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Discount</span>
                  <span className="font-medium text-red-600">-{formatCurrency(form.discount, form.currency)}</span>
                </div>
              )}
              <div className="pt-3 border-t border-gray-200 flex justify-between">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="font-bold text-lg text-gray-900">{formatCurrency(total, form.currency)}</span>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <Select
                label="Currency"
                id="currency"
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                options={[
                  { value: "USD", label: "USD - US Dollar" },
                  { value: "INR", label: "INR - Indian Rupee" },
                  { value: "EUR", label: "EUR - Euro" },
                  { value: "GBP", label: "GBP - British Pound" },
                ]}
              />
              <Input
                label="Due Date"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
