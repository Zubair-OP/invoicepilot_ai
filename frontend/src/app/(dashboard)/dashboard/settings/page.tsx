"use client";

import { useEffect, useState } from "react";
import { Save, Building2, FileText, Bell, Crown } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import Loading from "@/components/ui/Loading";
import { useToast } from "@/context/ToastContext";
import type { UserSettings } from "@/types";

export default function SettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const { api } = await import("@/lib/api");
        const [settingsRes, billingRes] = await Promise.all([
          api.getSettings(),
          api.getSubscription(),
        ]);
        if (settingsRes.success) {
          setSettings(settingsRes.data);
        }
        if (billingRes.success) {
          setIsPremium(billingRes.data?.subscription?.planKey === "premium");
        }
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
          <p className="text-sm text-gray-500 mt-1">Configure your business profile, sender email, and invoice defaults</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>

      {/* Business Information */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-5 h-5 text-green-600" />
          <h3 className="font-semibold text-gray-900">Business Profile & Contact</h3>
        </div>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="Business Name"
              value={settings.businessName || ""}
              onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
              placeholder="e.g. Acme Studio"
            />
            <div>
              <Input
                label="Business / Sender Email"
                type="email"
                value={settings.businessEmail || ""}
                onChange={(e) => setSettings({ ...settings, businessEmail: e.target.value })}
                placeholder="contact@yourdomain.com"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Emails to your clients will appear from this business name and all client replies will go to this email.
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="Business Phone"
              value={settings.businessPhone || ""}
              onChange={(e) => setSettings({ ...settings, businessPhone: e.target.value })}
              placeholder="+1 (555) 000-0000"
            />
            <Input
              label="Tax ID / GSTIN / VAT"
              value={settings.taxId || ""}
              onChange={(e) => setSettings({ ...settings, taxId: e.target.value })}
              placeholder="e.g. 27AABCU9603R1ZM"
            />
          </div>

          <Textarea
            label="Business Address"
            value={settings.businessAddress || ""}
            onChange={(e) => setSettings({ ...settings, businessAddress: e.target.value })}
            placeholder="123 Business Street, Suite 100, City, Country"
            rows={2}
          />
        </div>
      </Card>

      {/* Invoice Defaults */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-green-600" />
          <h3 className="font-semibold text-gray-900">Invoice Defaults</h3>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Select
            label="Default Currency"
            id="currency"
            value={settings.defaultCurrency}
            onChange={(e) => setSettings({ ...settings, defaultCurrency: e.target.value })}
            options={[
              { value: "USD", label: "USD ($)" },
              { value: "INR", label: "INR (₹)" },
              { value: "EUR", label: "EUR (€)" },
              { value: "GBP", label: "GBP (£)" },
              { value: "CAD", label: "CAD ($)" },
              { value: "AUD", label: "AUD ($)" },
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
              { value: "classic", label: "Classic Emerald" },
              { value: "modern", label: "Modern Indigo" },
              { value: "minimal", label: "Enterprise Slate" },
            ]}
          />
        </div>
      </Card>

      {/* Payment Reminders */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold text-gray-900">Automated Payment Reminders</h3>
        </div>
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.reminders.enabled}
              onChange={(e) => setSettings({ ...settings, reminders: { ...settings.reminders, enabled: e.target.checked } })}
              className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
            />
            <span className="text-sm font-medium text-gray-700">Enable automatic payment reminders for overdue invoices</span>
          </label>
          {settings.reminders.enabled && (
            <>
              <Input
                label="Reminder Schedule (days relative to due date, e.g. -3 = 3 days before, 1 = 1 day after)"
                value={settings.reminders.offsets.join(", ")}
                onChange={(e) => setSettings({
                  ...settings,
                  reminders: { ...settings.reminders, offsets: e.target.value.split(",").map(Number).filter(Boolean) }
                })}
                placeholder="-3, 1, 7, 14"
              />

              {/* Custom sweep interval — premium only */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Check Interval (minutes)
                  </label>
                  {!isPremium && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">
                      <Crown className="w-3 h-3" />
                      Premium
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  min={5}
                  max={1440}
                  disabled={!isPremium}
                  value={settings.reminders.intervalMinutes ?? 5}
                  onChange={(e) => setSettings({
                    ...settings,
                    reminders: {
                      ...settings.reminders,
                      intervalMinutes: Math.max(5, Math.min(1440, parseInt(e.target.value) || 5)),
                    },
                  })}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${
                    isPremium
                      ? "border-gray-300 bg-white text-gray-900"
                      : "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                  }`}
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  {isPremium
                    ? "How often the system checks your invoices for due reminders. Lower = faster delivery, higher = less frequent checks."
                    : "Upgrade to Premium to customize how often reminders are checked. Default: every 5 minutes."}
                </p>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

