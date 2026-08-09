"use client";

import { useEffect, useState } from "react";
import { Users, FileText, DollarSign, Activity } from "lucide-react";
import Card from "@/components/ui/Card";
import Loading from "@/components/ui/Loading";
import { formatCurrency } from "@/lib/utils";
import type { AdminAnalytics } from "@/types";

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { api } = await import("@/lib/api");
        const res = await api.adminGetAnalytics();
        if (res.success) setData(res.data);
      } catch {} finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <Loading size="lg" text="Loading admin dashboard..." />;
  if (!data) return <div className="text-center py-12 text-gray-500">Failed to load analytics</div>;

  const stats = [
    {
      label: "Total Users",
      value: data.users.total,
      change: `+${data.users.growth}`,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Monthly Revenue",
      value: formatCurrency(data.mrr),
      change: "",
      icon: DollarSign,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Total Invoices",
      value: data.invoiceVolume.count,
      change: "",
      icon: FileText,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "AI Generations",
      value: data.aiUsage.total,
      change: "",
      icon: Activity,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Admin Dashboard</h2>
        <p className="text-sm text-gray-500 mt-1">Platform-wide analytics and management</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${stat.bg}`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              {stat.change && <p className="text-xs text-green-600">{stat.change} this period</p>}
            </div>
          </Card>
        ))}
      </div>

      {/* Subscriptions by Plan */}
      <Card>
        <h3 className="font-semibold text-gray-900 mb-4">Active Subscriptions</h3>
        <div className="space-y-3">
          {data.activeSubscriptionsByPlan.map((sub) => (
            <div key={sub.planKey} className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-gray-900 capitalize">{sub.planKey}</p>
                <p className="text-sm text-gray-500">{sub.count} subscribers</p>
              </div>
              <p className="font-semibold text-gray-900">{formatCurrency(sub.mrr)}/mo</p>
            </div>
          ))}
          {data.activeSubscriptionsByPlan.length === 0 && (
            <p className="text-sm text-gray-500">No active subscriptions</p>
          )}
        </div>
      </Card>

      {/* AI Usage */}
      <Card>
        <h3 className="font-semibold text-gray-900 mb-4">AI Usage Breakdown</h3>
        <div className="space-y-3">
          {data.aiUsage.byKind.map((kind) => (
            <div key={kind.kind} className="flex items-center justify-between py-2">
              <p className="text-gray-700 capitalize">{kind.kind}</p>
              <p className="font-medium text-gray-900">{kind.count}</p>
            </div>
          ))}
          {data.aiUsage.byKind.length === 0 && (
            <p className="text-sm text-gray-500">No AI usage recorded</p>
          )}
        </div>
      </Card>
    </div>
  );
}
