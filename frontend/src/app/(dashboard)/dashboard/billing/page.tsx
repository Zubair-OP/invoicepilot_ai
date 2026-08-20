"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Check, CreditCard, ExternalLink, RefreshCw, Sparkles, LayoutTemplate, ShieldCheck, Crown } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ErrorState from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import Badge from "@/components/ui/Badge";
import { getErrorMessage } from "@/lib/api";
import { useProgressiveStatus } from "@/hooks/useProgressiveStatus";
import type { BillingInfo, Plan } from "@/types";
import { useToast } from "@/context/ToastContext";

function formatLimit(val: number | { limit: number; unlimited: boolean } | undefined): string {
  if (val === undefined || val === null) return "0";
  if (typeof val === "number") {
    return val === -1 ? "Unlimited" : String(val);
  }
  return val.unlimited || val.limit === -1 ? "Unlimited" : String(val.limit);
}

function BillingSkeleton() {
  return (
    <div className="max-w-5xl mx-auto space-y-6" role="status" aria-label="Loading billing">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-52 rounded-lg" />
          <Skeleton className="h-4 w-72 rounded-md" />
        </div>
        <Skeleton className="h-9 w-40 rounded-xl" />
      </div>
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <Skeleton className="h-5 w-32 rounded-md mb-5" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-16 rounded-md" />
              <Skeleton className="h-6 w-28 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <Skeleton className="h-5 w-40 rounded-md mb-5" />
        <div className="grid sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
      <div>
        <Skeleton className="h-5 w-36 rounded-md mb-4" />
        <div className="grid md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

function BillingContent() {
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState("");
  const [portalLoading, setPortalLoading] = useState(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const slowStatus = useProgressiveStatus(checkoutLoading !== "" || syncing || portalLoading);

  const loadBillingData = async (sessionId?: string): Promise<BillingInfo | null> => {
    try {
      const { api } = await import("@/lib/api");
      const [subRes, plansRes] = await Promise.all([
        api.getSubscription(sessionId ? { session_id: sessionId } : undefined),
        api.getPlans(),
      ]);
      if (subRes.success) {
        setBilling(subRes.data);
      }
      if (plansRes.success) {
        setPlans(plansRes.data);
      }
      setError(false);
      return subRes.data;
    } catch (err) {
      setError(true);
      toast.error(getErrorMessage(err, "We couldn't load your billing information right now."));
      return null;
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const checkoutStatus = searchParams?.get("checkout");
      const sessionId = searchParams?.get("session_id") || undefined;

      try {
        if (checkoutStatus === "success") {
          const { api } = await import("@/lib/api");
          // Sync directly with Stripe API
          await api.syncSubscription(sessionId);
          const data = await loadBillingData(sessionId);
          if (cancelled) return;
          setShowSuccessBanner(true);
          toast.success(
            `🎉 Payment successful! You are now subscribed to the ${data?.plan?.name || "Premium"} plan.`
          );
        } else if (checkoutStatus === "cancelled") {
          toast.info("Checkout process was cancelled.");
          await loadBillingData();
        } else {
          await loadBillingData();
        }
      } catch {
        await loadBillingData();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleManualSync = async () => {
    setSyncing(true);
    setError(false);
    try {
      const { api } = await import("@/lib/api");
      await api.syncSubscription();
      const data = await loadBillingData();
      toast.success(
        `Subscription synced! Active plan: ${data?.plan?.name || "Free"}`
      );
    } catch (err) {
      toast.error(getErrorMessage(err, "We couldn't sync your subscription right now."));
    } finally {
      setSyncing(false);
    }
  };

  const handleCheckout = async (planKey: string) => {
    setCheckoutLoading(planKey);
    try {
      const { api } = await import("@/lib/api");
      const res = await api.createCheckout(planKey);
      if (res.data?.url) {
        window.location.assign(res.data.url);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "We couldn't start the checkout. Please try again."));
      setCheckoutLoading("");
    }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const { api } = await import("@/lib/api");
      const res = await api.openPortal();
      if (res.data?.url) {
        window.location.assign(res.data.url);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "We couldn't open the billing portal right now."));
    } finally {
      setPortalLoading(false);
    }
  };

  const retry = async () => {
    setLoading(true);
    setError(false);
    await loadBillingData();
    setLoading(false);
  };

  if (loading) return <BillingSkeleton />;
  if (error && !billing) {
    return (
      <div className="max-w-5xl mx-auto min-h-[50vh] flex items-center justify-center">
        <ErrorState
          title="Couldn't load your billing information"
          description="We ran into a problem connecting. Your plan and payment details are safe — please try again."
          onRetry={retry}
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Billing & Subscription</h2>
          <p className="text-sm text-gray-500 mt-1">Manage your plan, limits, and billing details</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualSync}
            loading={syncing}
            loadingText="Syncing..."
            className="text-xs text-gray-700 hover:text-gray-900"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            Sync with Stripe
          </Button>
        </div>
      </div>

      {/* Celebration Banner after successful checkout */}
      {showSuccessBanner && billing && (
        <div className="bg-gradient-to-r from-emerald-600 via-green-600 to-teal-700 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-xs font-bold text-white mb-1">
                <ShieldCheck className="w-4 h-4" aria-hidden="true" /> Subscription Active
              </div>
              <h3 className="text-xl sm:text-2xl font-extrabold">
                🎉 Welcome to the {billing.plan.name} Plan!
              </h3>
              <p className="text-sm text-green-100 max-w-xl">
                Your payment was verified. All {billing.plan.limits.templatesAllowed.length} design templates, higher AI limits, {billing.plan.limits.customReminderInterval ? "custom email reminder intervals, " : ""}and invoicing capabilities are now unlocked and ready to use.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/dashboard/templates">
                <Button className="bg-white text-emerald-800 hover:bg-emerald-50 font-bold border-0 shadow-md">
                  <LayoutTemplate className="w-4 h-4 mr-1.5" aria-hidden="true" />
                  Choose Template
                </Button>
              </Link>
              <Link href="/dashboard/invoices/new">
                <Button variant="outline" className="bg-white/10 text-white border-white/30 hover:bg-white/20">
                  Create Invoice
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Current Plan */}
      {billing && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Current Plan</h3>
            <div className="flex items-center gap-2">
              {billing.subscription && (
                <Button variant="outline" size="sm" onClick={handlePortal} loading={portalLoading} loadingText="Opening...">
                  <ExternalLink className="w-4 h-4 mr-2" aria-hidden="true" />
                  Manage in Stripe
                </Button>
              )}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-gray-500">Plan</p>
              <p className="text-lg font-bold text-gray-900 flex items-center gap-2">
                {billing.plan.name}
                {billing.plan.key !== "free" && (
                  <Sparkles className="w-4 h-4 text-amber-500 fill-amber-500" aria-hidden="true" />
                )}
              </p>
              <p className="text-sm text-gray-500 mt-1">{billing.plan.description}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <div className="mt-1">
                <Badge variant={billing.subscription?.status === "active" ? "success" : "warning"}>
                  {billing.subscription?.status ? billing.subscription.status.toUpperCase() : "ACTIVE (FREE)"}
                </Badge>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500">Invoice Templates</p>
              <p className="text-base font-bold text-gray-900 mt-1">
                {billing.plan.limits.templatesAllowed.length} Unlocked
              </p>
              <Link
                href="/dashboard/templates"
                className="text-xs text-green-600 hover:text-green-700 font-medium inline-flex items-center gap-1 mt-1"
              >
                Configure Templates &rarr;
              </Link>
            </div>
            <div>
              <p className="text-sm text-gray-500">Email Automation</p>
              <div className="mt-1">
                {billing.plan.limits.customReminderInterval ? (
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/80">
                    <Crown className="w-3.5 h-3.5 text-amber-600 fill-amber-500" aria-hidden="true" /> Custom Frequency
                  </span>
                ) : (
                  <span className="text-sm font-medium text-gray-700">Daily Sweeps (24h)</span>
                )}
              </div>
              <Link
                href="/dashboard/settings"
                className="text-xs text-green-600 hover:text-green-700 font-medium inline-flex items-center gap-1 mt-1"
              >
                Configure Automation &rarr;
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* Usage Overview */}
      {billing && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Current Period Usage</h3>
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
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          percent >= 100 ? "bg-rose-100 text-rose-700" : "bg-gray-100 text-gray-700"
                        }`}
                      >
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
                className={`relative flex flex-col justify-between ${
                  isCurrent ? "ring-2 ring-green-500 shadow-md" : ""
                }`}
              >
                {isCurrent && (
                  <Badge variant="success" className="absolute -top-3 left-1/2 -translate-x-1/2 shadow-sm">
                    Current Plan
                  </Badge>
                )}
                <div>
                  <h4 className="text-xl font-bold text-gray-900">{plan.name}</h4>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    ${plan.priceMonthly}
                    <span className="text-sm font-normal text-gray-500">/mo</span>
                  </p>
                  <p className="text-sm text-gray-500 mt-2 mb-4">{plan.description}</p>
                  <ul className="space-y-2.5 mb-6">
                    <li className="flex items-center gap-2 text-sm text-gray-700">
                      <Check className="w-4 h-4 text-green-600 shrink-0" aria-hidden="true" />
                      <span><strong>{formatLimit(plan.limits.invoicesPerMonth)}</strong> invoices/month</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm text-gray-700">
                      <Check className="w-4 h-4 text-green-600 shrink-0" aria-hidden="true" />
                      <span><strong>{formatLimit(plan.limits.customers)}</strong> customers</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm text-gray-700">
                      <Check className="w-4 h-4 text-green-600 shrink-0" aria-hidden="true" />
                      <span><strong>{formatLimit(plan.limits.aiGenerationsPerMonth)}</strong> AI generations</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm text-gray-700">
                      <Check className="w-4 h-4 text-green-600 shrink-0" aria-hidden="true" />
                      <span><strong className="text-gray-900">{plan.limits.templatesAllowed.length} {plan.limits.templatesAllowed.length === 1 ? "Template" : "Templates"}</strong> ({plan.limits.templatesAllowed.join(", ")})</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm text-gray-700">
                      {plan.limits.customReminderInterval ? (
                        <>
                          <Crown className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" aria-hidden="true" />
                          <span className="text-amber-900 font-semibold bg-amber-50/80 px-1.5 py-0.5 rounded border border-amber-200/60">
                            Custom Reminder Cadence (1h–12h)
                          </span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 text-gray-400 shrink-0" aria-hidden="true" />
                          <span className="text-gray-500">Standard Reminders (Daily 24h)</span>
                        </>
                      )}
                    </li>
                  </ul>
                </div>

                <div>
                  {!isCurrent && plan.checkoutEnabled && (
                    <Button
                      className="w-full"
                      variant={plan.key === "pro" || plan.key === "premium" ? "primary" : "outline"}
                      onClick={() => handleCheckout(plan.key)}
                      loading={checkoutLoading === plan.key}
                      loadingText="Preparing secure checkout..."
                      disabled={checkoutLoading !== "" && checkoutLoading !== plan.key}
                    >
                      <CreditCard className="w-4 h-4 mr-2" aria-hidden="true" />
                      Upgrade to {plan.name}
                    </Button>
                  )}
                  {isCurrent && (
                    <div className="w-full py-2 text-center text-xs font-bold text-green-700 bg-green-50 rounded-lg border border-green-200">
                      Active Plan
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
        {slowStatus && (
          <p className="mt-4 text-xs text-gray-500" role="status">{slowStatus}</p>
        )}
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<BillingSkeleton />}>
      <BillingContent />
    </Suspense>
  );
}