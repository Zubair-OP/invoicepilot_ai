"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock, Sparkles, Crown, Zap, ArrowRight } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Loading from "@/components/ui/Loading";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/context/ToastContext";
import type { InvoiceTemplate, BillingInfo } from "@/types";

interface TemplateVisual {
  id: string;
  name: string;
  tier: "Free" | "Pro" | "Enterprise";
  tierKey: "free" | "pro" | "premium";
  color: string;
  description: string;
  features: string[];
}

const TEMPLATE_META: TemplateVisual[] = [
  {
    id: "classic",
    name: "Classic Emerald",
    tier: "Free",
    tierKey: "free",
    color: "from-emerald-500 to-green-600",
    description: "Traditional corporate layout with bordered table, clear hierarchy, and green accents.",
    features: ["GST & Tax Breakdown", "Traditional Bordered Table", "Bank & Payment Details", "Free for All Users"],
  },
  {
    id: "modern",
    name: "Modern Indigo",
    tier: "Pro",
    tierKey: "pro",
    color: "from-indigo-600 to-violet-600",
    description: "Contemporary sans-serif aesthetic with floating header banner and sleek modern typography.",
    features: ["Gradient Brand Banner", "Clean Sans-Serif Typography", "Highlight Badges", "Pro Plan Required"],
  },
  {
    id: "minimal",
    name: "Enterprise Slate",
    tier: "Enterprise",
    tierKey: "premium",
    color: "from-slate-800 to-slate-950",
    description: "High-end luxury monochrome design focused on precision, numbers, and clean grid structure.",
    features: ["Ultra-Clean Minimalist Grid", "Monochrome Luxury Palette", "Compact Item Layout", "Enterprise / Premium Plan Required"],
  },
];

export default function TemplatesPage() {
  const router = useRouter();
  const { toast, confirmModal } = useToast();
  const [loading, setLoading] = useState(true);
  const [currentTemplate, setCurrentTemplate] = useState("classic");
  const [userPlanKey, setUserPlanKey] = useState<string>("free");
  const [allowedTemplates, setAllowedTemplates] = useState<string[]>(["classic"]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const { api } = await import("@/lib/api");
        const [settingsRes, subRes] = await Promise.all([
          api.getSettings(),
          api.getSubscription(),
        ]);
        if (settingsRes.success) {
          setCurrentTemplate(settingsRes.data.templateId || "classic");
        }
        if (subRes.success && subRes.data) {
          const planKey = subRes.data.subscription?.planKey || subRes.data.plan?.key || "free";
          setUserPlanKey(planKey);
          if (subRes.data.plan?.limits?.templatesAllowed) {
            setAllowedTemplates(subRes.data.plan.limits.templatesAllowed);
          } else if (planKey === "premium") {
            setAllowedTemplates(["classic", "modern", "minimal"]);
          } else if (planKey === "pro") {
            setAllowedTemplates(["classic", "modern"]);
          } else {
            setAllowedTemplates(["classic"]);
          }
        }
      } catch {} finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const isTemplateUnlocked = (tpl: TemplateVisual) => {
    if (allowedTemplates.includes(tpl.id)) return true;
    if (tpl.tierKey === "free") return true;
    if (tpl.tierKey === "pro") return userPlanKey === "pro" || userPlanKey === "premium";
    if (tpl.tierKey === "premium") return userPlanKey === "premium";
    return false;
  };

  const handleSelect = async (tpl: TemplateVisual) => {
    const unlocked = isTemplateUnlocked(tpl);

    if (!unlocked) {
      const ok = await confirmModal({
        title: `Unlock ${tpl.name}`,
        message: `The "${tpl.name}" template is available exclusively on the ${tpl.tier} Plan.\n\nWould you like to view our subscription plans to upgrade and unlock all premium templates?`,
        confirmText: `Upgrade to ${tpl.tier}`,
        cancelText: "Maybe Later",
        variant: "primary",
      });

      if (ok) {
        router.push("/dashboard/billing");
      }
      return;
    }

    if (currentTemplate === tpl.id) {
      toast.info(`"${tpl.name}" is already your active template.`);
      return;
    }

    setSaving(true);
    try {
      const { api } = await import("@/lib/api");
      await api.updateSettings({ templateId: tpl.id });
      setCurrentTemplate(tpl.id);
      toast.success(`Active invoice template set to "${tpl.name}"!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update template");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading size="lg" text="Loading invoice templates..." />;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-gray-900 via-slate-800 to-gray-900 text-white p-6 sm:p-8 rounded-2xl shadow-xl">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold text-green-400 border border-white/10">
            <Sparkles className="w-3.5 h-3.5" />
            Template Gallery
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Invoice Design Templates</h2>
          <p className="text-sm text-gray-300 max-w-xl">
            Choose your preferred template style. All generated PDFs, emails, and previews will automatically use your selected design.
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-2 bg-white/5 border border-white/10 p-3 rounded-xl">
          <Crown className="w-5 h-5 text-amber-400" />
          <div className="text-xs">
            <p className="text-gray-400">Current Plan</p>
            <p className="font-bold text-white capitalize">{userPlanKey} Tier</p>
          </div>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        {TEMPLATE_META.map((tpl) => {
          const isSelected = currentTemplate === tpl.id;
          const unlocked = isTemplateUnlocked(tpl);

          return (
            <div
              key={tpl.id}
              onClick={() => handleSelect(tpl)}
              className={`group relative flex flex-col justify-between bg-white rounded-2xl border-2 transition-all duration-300 cursor-pointer overflow-hidden shadow-sm hover:shadow-xl ${
                isSelected
                  ? "border-green-600 ring-4 ring-green-600/10 shadow-green-100"
                  : unlocked
                  ? "border-gray-200 hover:border-gray-400"
                  : "border-gray-200 bg-gray-50/70 opacity-95 hover:border-amber-400"
              }`}
            >
              {/* Top Banner & Status Badge */}
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                      tpl.tier === "Free"
                        ? "bg-green-100 text-green-700 border border-green-200"
                        : tpl.tier === "Pro"
                        ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                        : "bg-slate-900 text-amber-300 border border-slate-700"
                    }`}
                  >
                    {tpl.tier === "Free" ? "Free Tier" : tpl.tier === "Pro" ? "Pro Tier" : "Enterprise"}
                  </span>

                  {isSelected ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-full border border-green-200">
                      <Check className="w-3.5 h-3.5 text-green-600" /> Active
                    </span>
                  ) : !unlocked ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                      <Lock className="w-3 h-3 text-amber-600" /> Locked
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-gray-500 group-hover:text-gray-900">
                      Available
                    </span>
                  )}
                </div>

                {/* Miniature Visual Mockup */}
                <div className="relative rounded-xl border border-gray-200 bg-white p-4 shadow-inner overflow-hidden">
                  {/* Mockup Header */}
                  <div className={`h-8 w-full rounded-md bg-gradient-to-r ${tpl.color} mb-3 flex items-center px-3 justify-between text-[9px] font-bold text-white shadow-sm`}>
                    <span>INVOICE</span>
                    <span>#INV-001</span>
                  </div>

                  {/* Mockup Items */}
                  <div className="space-y-1.5 text-[8px] text-gray-500">
                    <div className="flex justify-between border-b border-gray-100 pb-1 font-semibold text-gray-700">
                      <span>Description</span>
                      <span>Amount</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Website Development</span>
                      <span className="font-semibold text-gray-900">$1,000.00</span>
                    </div>
                    <div className="flex justify-between">
                      <span>GST (10%)</span>
                      <span>$100.00</span>
                    </div>
                  </div>

                  {/* Mockup Total */}
                  <div className="mt-3 pt-1.5 border-t border-gray-200 flex justify-between items-center text-[10px] font-extrabold text-gray-900">
                    <span>Total</span>
                    <span className={`text-[11px] font-black ${
                      tpl.id === "classic"
                        ? "text-emerald-600"
                        : tpl.id === "modern"
                        ? "text-indigo-600"
                        : "text-slate-900"
                    }`}>
                      $1,100.00
                    </span>
                  </div>

                  {!unlocked && (
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] flex flex-col items-center justify-center text-white gap-1.5 p-4 text-center">
                      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                        <Lock className="w-4 h-4 text-white" />
                      </div>
                      <p className="text-xs font-bold">Upgrade to {tpl.tier}</p>
                    </div>
                  )}
                </div>

                {/* Template Info */}
                <div>
                  <h3 className="text-lg font-bold text-gray-900 group-hover:text-green-600 transition-colors">
                    {tpl.name}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{tpl.description}</p>
                </div>

                {/* Feature Pills */}
                <div className="space-y-1 pt-1">
                  {tpl.features.map((feat, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                      <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-green-600" : "bg-gray-400"}`} />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Action Footer */}
              <div className="p-4 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between">
                {isSelected ? (
                  <span className="text-xs font-bold text-green-700 flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-green-600" /> Currently Selected
                  </span>
                ) : unlocked ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full justify-center group-hover:bg-green-600 group-hover:text-white group-hover:border-green-600 transition-colors"
                  >
                    Select Template
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="w-full justify-center bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-sm border-0"
                  >
                    <Zap className="w-3.5 h-3.5 mr-1" /> Upgrade to {tpl.tier}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
