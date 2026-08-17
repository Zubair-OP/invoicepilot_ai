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
          const loadedData = settingsRes.data;
          if (loadedData?.reminders && (typeof loadedData.reminders.intervalMinutes !== "number" || loadedData.reminders.intervalMinutes < 15)) {
            loadedData.reminders.intervalMinutes = 1440;
          }
          setSettings(loadedData);
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
      const payload = { ...settings };
      if (payload.reminders && (typeof payload.reminders.intervalMinutes !== "number" || payload.reminders.intervalMinutes < 5)) {
        payload.reminders.intervalMinutes = 1440;
      }
      await api.updateSettings(payload);
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

              {/* Custom sweep interval / Check Frequency */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Check Frequency
                  </label>
                  {!isPremium && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">
                      <Crown className="w-3 h-3" />
                      Premium Feature
                    </span>
                  )}
                </div>
                <Select
                  id="reminderInterval"
                  disabled={!isPremium}
                  value={String(settings.reminders.intervalMinutes ?? 1440)}
                  onChange={(e) => setSettings({
                    ...settings,
                    reminders: {
                      ...settings.reminders,
                      intervalMinutes: parseInt(e.target.value) || 1440,
                    },
                  })}
                  options={[
                    { value: "60", label: "Every 1 Hour (60 mins)" },
                    { value: "120", label: "Every 2 Hours (120 mins)" },
                    { value: "240", label: "Every 4 Hours (240 mins)" },
                    { value: "360", label: "Every 6 Hours (360 mins)" },
                    { value: "720", label: "Every 12 Hours (720 mins)" },
                    { value: "1440", label: "Daily / Every 24 Hours (Default)" },
                  ]}
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  {isPremium
                    ? "Choose how often the system sweeps your active invoices to check and dispatch due payment reminders."
                    : "Free & Pro plans check invoices once per day (Every 24 Hours). Upgrade to Premium to check as frequently as every hour."}
                </p>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

