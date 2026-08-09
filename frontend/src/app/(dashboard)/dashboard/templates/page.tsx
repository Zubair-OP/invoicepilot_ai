"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Loading from "@/components/ui/Loading";
import type { InvoiceTemplate } from "@/types";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTemplate, setCurrentTemplate] = useState("classic");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const { api } = await import("@/lib/api");
        const [tplRes, settingsRes] = await Promise.all([api.getTemplates(), api.getSettings()]);
        if (tplRes.success) setTemplates(tplRes.data);
        if (settingsRes.success) setCurrentTemplate(settingsRes.data.templateId || "classic");
      } catch {} finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSelect = async (templateId: string) => {
    setSaving(true);
    try {
      const { api } = await import("@/lib/api");
      await api.updateSettings({ templateId });
      setCurrentTemplate(templateId);
    } catch (err: any) {
      alert(err.message || "Failed to update template");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading size="lg" text="Loading templates..." />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Invoice Templates</h2>
        <p className="text-sm text-gray-500 mt-1">Choose a template for your invoices</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template) => (
          <Card
            key={template.id}
            className={`relative cursor-pointer transition-all hover:shadow-md ${
              currentTemplate === template.id ? "ring-2 ring-green-500" : ""
            }`}
            onClick={() => handleSelect(template.id)}
          >
            {currentTemplate === template.id && (
              <div className="absolute top-3 right-3 w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
            )}
            <div className="aspect-[3/4] bg-gray-50 rounded-lg mb-4 flex items-center justify-center border border-gray-100">
              <div className="text-center p-4">
                <div className="w-16 h-20 bg-white border border-gray-200 rounded shadow-sm mx-auto mb-2" />
                <p className="text-xs text-gray-400">Preview</p>
              </div>
            </div>
            <h3 className="font-semibold text-gray-900">{template.name}</h3>
            <p className="text-sm text-gray-500 mt-1">{template.description}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
