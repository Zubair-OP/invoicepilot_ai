"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import Loading from "@/components/ui/Loading";
import { useToast } from "@/context/ToastContext";

export default function SettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const { api } = await import("@/lib/api");
        const res = await api.getSettings();
        if (res.success) setSettings(res.data);
      } catch {} finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const { api } = await import("@/lib/api");
      await api.updateSettings(settings);
      toast.success("Business settings saved successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading size="lg" text="Loading settings..." />;
  if (!settings) return <div className="text-center py-12 text-gray-500">Failed to load settings</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
          <p className="text-sm text-gray-500 mt-1">Configure your business and invoice settings</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>

      <Card>
        <h3 className="font-semibold text-gray-900 mb-4">Business Information</h3>
        <div className="space-y-4">
          <Input
            label="Business Name"
            value={settings.businessName || ""}
            onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
            placeholder="Your Business Name"
          />
          <Textarea
            label="Business Address"
            value={settings.businessAddress || ""}
            onChange={(e) => setSettings({ ...settings, businessAddress: e.target.value })}
            placeholder="123 Business St, City, Country"
            rows={2}
          />
          <Input
            label="Tax ID / GSTIN"
            value={settings.taxId || ""}
            onChange={(e) => setSettings({ ...settings, taxId: e.target.value })}
            placeholder="27AABCU9603R1ZM"
          />
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold text-gray-900 mb-4">Invoice Defaults</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <Select
            label="Default Currency"
            id="currency"
            value={settings.defaultCurrency}
            onChange={(e) => setSettings({ ...settings, defaultCurrency: e.target.value })}
            options={[
              { value: "USD", label: "USD" },
              { value: "INR", label: "INR" },
              { value: "EUR", label: "EUR" },
              { value: "GBP", label: "GBP" },
            ]}
          />
          <Input
            label="Payment Terms (days)"
            type="number"
            min="0"
            value={settings.defaultPaymentTermsDays}
            onChange={(e) => setSettings({ ...settings, defaultPaymentTermsDays: parseInt(e.target.value) || 30 })}
          />
          <Input
            label="Invoice Prefix"
            value={settings.invoicePrefix}
            onChange={(e) => setSettings({ ...settings, invoicePrefix: e.target.value })}
            placeholder="INV"
          />
          <Select
            label="Default Template"
            id="template"
            value={settings.templateId}
            onChange={(e) => setSettings({ ...settings, templateId: e.target.value })}
            options={[
              { value: "classic", label: "Classic" },
              { value: "modern", label: "Modern" },
              { value: "minimal", label: "Minimal" },
            ]}
          />
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold text-gray-900 mb-4">Payment Reminders</h3>
        <div className="space-y-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.reminders.enabled}
              onChange={(e) => setSettings({ ...settings, reminders: { ...settings.reminders, enabled: e.target.checked } })}
              className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
            />
            <span className="text-sm text-gray-700">Enable automatic payment reminders</span>
          </label>
          {settings.reminders.enabled && (
            <Input
              label="Reminder Days (comma-separated, negative = before due date)"
              value={settings.reminders.offsets.join(", ")}
              onChange={(e) => setSettings({
                ...settings,
                reminders: { ...settings.reminders, offsets: e.target.value.split(",").map(Number).filter(Boolean) }
              })}
              placeholder="-3, 1, 7, 14"
            />
          )}
        </div>
      </Card>
    </div>
  );
}
