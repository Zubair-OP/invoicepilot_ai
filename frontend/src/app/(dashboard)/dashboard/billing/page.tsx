"use client";

import { useEffect, useState } from "react";
import { Check, CreditCard, ExternalLink } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Loading from "@/components/ui/Loading";
import Badge from "@/components/ui/Badge";
import type { BillingInfo, Plan } from "@/types";

import { useToast } from "@/context/ToastContext";

export default function BillingPage() {
  const { toast } = useToast();
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const { api } = await import("@/lib/api");
        const [subRes, plansRes] = await Promise.all([api.getSubscription(), api.getPlans()]);
        if (subRes.success) setBilling(subRes.data);
        if (plansRes.success) setPlans(plansRes.data);
      } catch {} finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleCheckout = async (planKey: string) => {
    setCheckoutLoading(planKey);
    try {
      const { api } = await import("@/lib/api");
      const res = await api.createCheckout(planKey);
      if (res.data?.url) {
        window.location.href = res.data.url;
      }
    } catch (err: any) {
      toast.error(err.message || "Checkout session failed");
    } finally {
      setCheckoutLoading("");
    }
  };

  const handlePortal = async () => {
    try {
      const { api } = await import("@/lib/api");
      const res = await api.openPortal();
      if (res.data?.url) {
        window.location.href = res.data.url;
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to open customer billing portal");
    }
  };

  if (loading) return <Loading size="lg" text="Loading billing..." />;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Billing & Subscription</h2>
        <p className="text-sm text-gray-500 mt-1">Manage your subscription and billing</p>
      </div>

      {/* Current Plan */}
      {billing && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Current Plan</h3>
            {billing.subscription && (
              <Button variant="outline" size="sm" onClick={handlePortal}>
                <ExternalLink className="w-4 h-4 mr-2" />
                Manage Subscription
              </Button>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-500">Plan</p>
              <p className="text-lg font-bold text-gray-900">{billing.plan.name}</p>
              <p className="text-sm text-gray-500 mt-1">{billing.plan.description}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <Badge variant={billing.subscription?.status === "active" ? "success" : "warning"}>
                {billing.subscription?.status || "No subscription"}
              </Badge>
            </div>
          </div>
        </Card>
      )}

      {/* Usage Overview */}
      {billing && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-gray-900">Current Period Usage</h3>
              <p className="text-xs text-gray-500 mt-0.5">Track your monthly plan consumption</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {Object.entries(billing.usage).map(([key, usage]) => {
              const labelMap: Record<string, string> = {
                invoices: "Invoices Created",
                customers: "Saved Customers",
                ai: "AI Generations",
              };
              const label = labelMap[key] || key;
              const percent = usage.unlimited ? 0 : Math.min((usage.usage / usage.limit) * 100, 100);
              const barColor = percent >= 100 ? "bg-rose-500" : percent >= 80 ? "bg-amber-500" : "bg-emerald-500";

              return (
                <div key={key} className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-500">{label}</p>
                    {!usage.unlimited && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        percent >= 100 ? "bg-rose-100 text-rose-700" : "bg-gray-100 text-gray-700"
                      }`}>
                        {Math.round(percent)}%
                      </span>
                    )}
                  </div>
                  <p className="text-2xl font-black text-gray-900">
                    {usage.unlimited ? "Unlimited" : `${usage.usage} / ${usage.limit}`}
                  </p>
                  {!usage.unlimited ? (
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`${barColor} h-2 rounded-full transition-all duration-500`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-emerald-600 font-semibold">No limits on your plan</p>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Plans */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Plans</h3>
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrent = billing?.plan.key === plan.key;
            return (
              <Card
                key={plan.key}
                className={`relative ${isCurrent ? "ring-2 ring-green-500" : ""}`}
              >
                {isCurrent && (
                  <Badge variant="success" className="absolute -top-3 left-1/2 -translate-x-1/2">
                    Current Plan
                  </Badge>
                )}
                <h4 className="text-xl font-bold text-gray-900">{plan.name}</h4>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  ${plan.priceMonthly}
                  <span className="text-sm font-normal text-gray-500">/mo</span>
                </p>
                <p className="text-sm text-gray-500 mt-2 mb-4">{plan.description}</p>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="w-4 h-4 text-green-600" />
                    {plan.limits.invoicesPerMonth.unlimited ? "Unlimited" : plan.limits.invoicesPerMonth.limit} invoices/month
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="w-4 h-4 text-green-600" />
                    {plan.limits.customers.unlimited ? "Unlimited" : plan.limits.customers.limit} customers
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="w-4 h-4 text-green-600" />
                    {plan.limits.aiGenerationsPerMonth.unlimited ? "Unlimited" : plan.limits.aiGenerationsPerMonth.limit} AI generations
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="w-4 h-4 text-green-600" />
                    {plan.limits.templatesAllowed.length} templates
                  </li>
                </ul>
                {!isCurrent && plan.checkoutEnabled && (
                  <Button
                    className="w-full"
                    variant={plan.key === "pro" ? "primary" : "outline"}
                    onClick={() => handleCheckout(plan.key)}
                    disabled={checkoutLoading === plan.key}
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    {checkoutLoading === plan.key ? "Loading..." : `Upgrade to ${plan.name}`}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
