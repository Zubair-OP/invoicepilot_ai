"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Users,
  FileText,
  DollarSign,
  ShieldCheck,
  ArrowUpRight,
  RefreshCw,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import AdminLoading from "./loading";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { AdminAnalytics, User as UserModel } from "@/types";

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [users, setUsers] = useState<UserModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rangeDays, setRangeDays] = useState<7 | 30 | 90>(30);
  const [hoveredSignupIdx, setHoveredSignupIdx] = useState<number | null>(null);
  const [hoveredAiIdx, setHoveredAiIdx] = useState<number | null>(null);

  const loadData = useCallback(async (days: number, isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const { api } = await import("@/lib/api");
      const toDate = new Date();
      const fromDate = new Date(toDate.getTime() - days * 24 * 60 * 60 * 1000);

      const [analyticsRes, usersRes] = await Promise.all([
        api.adminGetAnalytics({
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
        }),
        api.adminGetUsers({ page: "1", limit: "6" }),
      ]);

      if (analyticsRes.success && analyticsRes.data) {
        setData(analyticsRes.data);
      }
      if (usersRes.success && usersRes.data) {
        setUsers(usersRes.data);
      }
    } catch (err) {
      console.error("Failed to load admin analytics:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => loadData(rangeDays), 0);
    return () => clearTimeout(t);
  }, [rangeDays, loadData]);

  if (loading) {
    return <AdminLoading />;
  }

  if (!data) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm max-w-lg mx-auto my-12">
        <ShieldCheck className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-900 mb-1">Couldn&apos;t load platform analytics</h3>
        <p className="text-xs text-slate-500 mb-4">
          We ran into a problem connecting to the platform data. Please try again.
        </p>
        <button
          onClick={() => loadData(rangeDays)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-semibold hover:bg-purple-700 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      </div>
    );
  }

  // Live Signups Data Points from backend
  const signupsData = (() => {
    if (!data.signupsOverTime || data.signupsOverTime.length === 0) return [];
    return data.signupsOverTime.map((d) => ({
      date: d.date,
      count: d.count,
      label: d.date.slice(5), // MM-DD
    }));
  })();

  // Live AI Usage Data Points from backend
  const aiData = (() => {
    if (!data.aiUsageOverTime || data.aiUsageOverTime.length === 0) return [];
    return data.aiUsageOverTime.map((d) => ({
      date: d.date,
      count: d.count,
      label: d.date.slice(5), // MM-DD
    }));
  })();

  // Donut chart calculations for active subscriptions
  const planColorMap: Record<string, { bg: string; text: string; hex: string }> = {
    starter: { bg: "bg-emerald-500", text: "text-emerald-600", hex: "#10b981" },
    pro: { bg: "bg-blue-600", text: "text-blue-600", hex: "#2563eb" },
    enterprise: { bg: "bg-purple-600", text: "text-purple-600", hex: "#9333ea" },
  };

  const subscriptionPlans = (() => {
    if (!data.activeSubscriptionsByPlan) return [];
    const total = data.activeSubscriptionsByPlan.reduce((acc, p) => acc + p.count, 0);
    return data.activeSubscriptionsByPlan.map((plan) => ({
      ...plan,
      percentage: total > 0 ? Math.round((plan.count / total) * 100) : 0,
      color: planColorMap[plan.planKey.toLowerCase()] || {
        bg: "bg-slate-400",
        text: "text-slate-600",
        hex: "#94a3b8",
      },
    }));
  })();

  const totalActiveSubscribers = (data.activeSubscriptionsByPlan || []).reduce(
    (acc, p) => acc + p.count,
    0
  );

  // Helper for generating dynamic SVG line paths
  const svgWidth = 600;
  const svgHeight = 200;
  const paddingX = 35;
  const paddingY = 25;

  const maxSignupVal = Math.max(...signupsData.map((d) => d.count), 4);
  const getSignupCoords = (count: number, index: number) => {
    const totalPoints = signupsData.length || 1;
    const x =
      totalPoints === 1
        ? svgWidth / 2
        : paddingX + (index / (totalPoints - 1)) * (svgWidth - paddingX * 2);
    const y =
      svgHeight -
      paddingY -
      (count / maxSignupVal) * (svgHeight - paddingY * 2);
    return { x, y };
  };

  const signupCoords = signupsData.map((d, i) => getSignupCoords(d.count, i));
  const makeSmoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return "";
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const mx = (p0.x + p1.x) / 2;
      path += ` C ${mx} ${p0.y}, ${mx} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    return path;
  };

  const signupLinePath = makeSmoothPath(signupCoords);
  const signupAreaPath =
    signupCoords.length > 1
      ? `${signupLinePath} L ${signupCoords[signupCoords.length - 1].x} ${
          svgHeight - paddingY
        } L ${signupCoords[0].x} ${svgHeight - paddingY} Z`
      : "";

  // Helper for Donut circumference
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  let accumulatedDonutOffset = 0;
  const donutSlices = subscriptionPlans.map((item) => {
    const pct = totalActiveSubscribers > 0 ? item.count / totalActiveSubscribers : 0;
    const strokeDash = pct * circumference;
    const offset = accumulatedDonutOffset;
    accumulatedDonutOffset += strokeDash;
    return {
      ...item,
      strokeDasharray: `${strokeDash} ${circumference - strokeDash}`,
      strokeDashoffset: -offset,
    };
  });

  // Max AI value for AI Usage Chart
  const maxAiVal = Math.max(...aiData.map((d) => d.count), 5);

  return (
    <div className="space-y-6 animate-fadeIn text-slate-800">
      {/* ── Top Header Bar with Live Sync & Range Filters ─────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl p-4 sm:px-6 border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                Platform Analytics & Operations
              </h2>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Sync
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Aggregated across all registered tenants, subscriptions and AI jobs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Time Range Selector */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            {([7, 30, 90] as const).map((days) => (
              <button
                key={days}
                onClick={() => setRangeDays(days)}
                className={`px-3 py-1 rounded-lg transition-all ${
                  rangeDays === days
                    ? "bg-white text-slate-900 shadow-sm font-bold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {days}D
              </button>
            ))}
          </div>

          {/* Manual Refresh Button */}
          <button
            onClick={() => loadData(rangeDays, true)}
            disabled={refreshing}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:text-purple-600 hover:border-purple-200 bg-white transition shadow-sm disabled:opacity-50"
            title="Refresh Live Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-purple-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── Live Key Highlights Bar ───────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Metric 1: Total Users */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Total Users</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{data.users.total}</div>
          <div className="text-[11px] font-semibold text-emerald-600 mt-1 flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" />
            +{data.users.growth} new in {rangeDays}d
          </div>
        </div>

        {/* Metric 2: Monthly Recurring Revenue */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Monthly Revenue (MRR)</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{formatCurrency(data.mrr)}</div>
          <div className="text-[11px] font-semibold text-slate-500 mt-1">
            {totalActiveSubscribers} active paid plans
          </div>
        </div>

        {/* Metric 3: Invoices Issued */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Issued Invoices</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <FileText className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{data.invoiceVolume.count}</div>
          <div className="text-[11px] font-semibold text-slate-500 mt-1 truncate">
            {data.invoiceVolume.totalByCurrency.length > 0
              ? data.invoiceVolume.totalByCurrency.map((c) => `${c.currency} ${c.amount.toLocaleString()}`).join(", ")
              : "In period range"}
          </div>
        </div>

        {/* Metric 4: AI Operations */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">AI & OCR Invocations</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{data.aiUsage.total}</div>
          <div className="text-[11px] font-semibold text-slate-500 mt-1">
            {data.aiUsage.byKind.find((k) => k.kind === "generate")?.count || 0} generations, {data.aiUsage.byKind.find((k) => k.kind === "chat")?.count || 0} chat
          </div>
        </div>
      </div>

      {/* ── Main Charts Grid (Live Signups Line + Subscription Donut) ──── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* 1. Live User Signups Over Time (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Live User Registration Trend</h3>
                <p className="text-xs text-slate-400">
                  Daily user onboarding counts from MongoDB (Past {rangeDays} Days)
                </p>
              </div>

              {hoveredSignupIdx !== null && signupsData[hoveredSignupIdx] && (
                <div className="bg-purple-600 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow-sm">
                  {signupsData[hoveredSignupIdx].date}: {signupsData[hoveredSignupIdx].count} signups
                </div>
              )}
            </div>

            {/* SVG Live Line Chart */}
            <div className="relative w-full h-[200px] mt-2">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full h-full overflow-visible"
              >
                <defs>
                  <linearGradient id="liveSignupGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#9333ea" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#9333ea" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Gridlines */}
                {[0.25, 0.5, 0.75, 1].map((p, idx) => {
                  const y =
                    svgHeight -
                    paddingY -
                    p * (svgHeight - paddingY * 2);
                  return (
                    <g key={idx}>
                      <line
                        x1={paddingX}
                        y1={y}
                        x2={svgWidth - paddingX}
                        y2={y}
                        stroke="#f1f5f9"
                        strokeDasharray="4 4"
                        strokeWidth="1.5"
                      />
                      <text
                        x={paddingX - 8}
                        y={y + 3}
                        fontSize="10"
                        fill="#94a3b8"
                        textAnchor="end"
                      >
                        {Math.round(p * maxSignupVal)}
                      </text>
                    </g>
                  );
                })}

                {/* Area Gradient */}
                {signupAreaPath && <path d={signupAreaPath} fill="url(#liveSignupGrad)" />}

                {/* Main Curve */}
                {signupLinePath && (
                  <path
                    d={signupLinePath}
                    fill="none"
                    stroke="#9333ea"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                )}

                {/* Interactive Points */}
                {signupCoords.map((pt, i) => (
                  <g
                    key={i}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredSignupIdx(i)}
                    onMouseLeave={() => setHoveredSignupIdx(null)}
                  >
                    {/* Hover column background */}
                    {hoveredSignupIdx === i && (
                      <line
                        x1={pt.x}
                        y1={paddingY}
                        x2={pt.x}
                        y2={svgHeight - paddingY}
                        stroke="#c084fc"
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                      />
                    )}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={hoveredSignupIdx === i ? 5.5 : 3.5}
                      fill="#ffffff"
                      stroke="#9333ea"
                      strokeWidth="2.5"
                      className="transition-all"
                    />
                  </g>
                ))}

                {/* Date Labels on X Axis */}
                {signupsData.map((d, i) => {
                  const interval = rangeDays === 90 ? 15 : rangeDays === 30 ? 5 : 1;
                  if (i % interval !== 0 && i !== signupsData.length - 1) return null;
                  const pt = getSignupCoords(0, i);
                  return (
                    <text
                      key={i}
                      x={pt.x}
                      y={svgHeight - 6}
                      fontSize="10"
                      fill="#64748b"
                      textAnchor="middle"
                      fontWeight="500"
                    >
                      {d.label}
                    </text>
                  );
                })}
              </svg>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
            <span>Period: {data.period.from.slice(0, 10)} to {data.period.to.slice(0, 10)}</span>
            <span className="font-semibold text-purple-700">
              Total Growth: +{data.users.growth} users
            </span>
          </div>
        </div>

        {/* 2. Live Subscriptions & Revenue by Plan (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">Active Subscriptions</h3>
            <p className="text-xs text-slate-400 mb-3">Breakdown by current billing plan tier</p>

            {/* Donut Chart */}
            <div className="relative w-36 h-36 mx-auto my-1">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  stroke="#f1f5f9"
                  strokeWidth="20"
                  fill="transparent"
                />
                {totalActiveSubscribers > 0 ? (
                  donutSlices.map((slice, i) => (
                    <circle
                      key={i}
                      cx="80"
                      cy="80"
                      r={radius}
                      stroke={slice.color.hex}
                      strokeWidth="20"
                      fill="transparent"
                      strokeDasharray={slice.strokeDasharray}
                      strokeDashoffset={slice.strokeDashoffset}
                      strokeLinecap="round"
                      className="transition-all duration-500"
                    />
                  ))
                ) : (
                  <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    stroke="#e2e8f0"
                    strokeWidth="20"
                    fill="transparent"
                  />
                )}
              </svg>

              {/* Center Callout */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  MRR
                </span>
                <span className="text-lg font-extrabold text-slate-900">
                  {formatCurrency(data.mrr)}
                </span>
              </div>
            </div>
          </div>

          {/* Subscriptions Table / Legend */}
          <div className="space-y-2 pt-3 border-t border-slate-100">
            {subscriptionPlans.length > 0 ? (
              subscriptionPlans.map((plan, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: plan.color.hex }}
                    />
                    <span className="font-semibold text-slate-700 capitalize">
                      {plan.planKey} Tier
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-slate-500">{plan.count} active</span>
                    <span className="font-bold text-slate-900">{formatCurrency(plan.mrr)}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-2 text-xs text-slate-400">
                No active paid subscriptions found
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom Section (Live AI Activity Graph + Live Tenant Users Table) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* 3. Live AI & OCR Activity Chart (6 cols) */}
        <div className="lg:col-span-6 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Live AI & OCR Processing</h3>
                <p className="text-xs text-slate-400">
                  Daily AI invocations (Generation & Chat) from MongoDB
                </p>
              </div>

              {hoveredAiIdx !== null && aiData[hoveredAiIdx] && (
                <div className="bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow-sm">
                  {aiData[hoveredAiIdx].date}: {aiData[hoveredAiIdx].count} runs
                </div>
              )}
            </div>

            {/* AI Bar Graph */}
            <div className="relative h-[160px] flex items-end justify-between gap-1 pt-6 px-2">
              {aiData.length > 0 ? (
                aiData.map((item, i) => {
                  const heightPct = maxAiVal > 0 ? (item.count / maxAiVal) * 100 : 0;
                  const isHovered = hoveredAiIdx === i;
                  return (
                    <div
                      key={i}
                      className="flex-1 flex flex-col items-center gap-1 h-full justify-end cursor-pointer group"
                      onMouseEnter={() => setHoveredAiIdx(i)}
                      onMouseLeave={() => setHoveredAiIdx(null)}
                    >
                      <div
                        className={`w-full max-w-[14px] rounded-t-sm transition-all duration-200 ${
                          isHovered
                            ? "bg-amber-500 shadow-md"
                            : item.count > 0
                            ? "bg-amber-400 hover:bg-amber-500"
                            : "bg-slate-100"
                        }`}
                        style={{ height: `${Math.max(heightPct, 4)}%` }}
                        title={`${item.date}: ${item.count} AI operations`}
                      />
                      {(rangeDays === 7 || (rangeDays === 30 && i % 5 === 0)) && (
                        <span className="text-[9px] font-semibold text-slate-400">
                          {item.label}
                        </span>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="w-full text-center py-12 text-xs text-slate-400">
                  No AI usage logs recorded in this period
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
            <span>AI Generations: {data.aiUsage.byKind.find((k) => k.kind === "generate")?.count || 0}</span>
            <span>Chat Queries: {data.aiUsage.byKind.find((k) => k.kind === "chat")?.count || 0}</span>
          </div>
        </div>

        {/* 4. Live Registered Accounts / Tenants Table (6 cols) */}
        <div className="lg:col-span-6 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Latest Registered Tenants</h3>
                <p className="text-xs text-slate-400">Live platform accounts directly from database</p>
              </div>

              <Link
                href="/admin/users"
                className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600 hover:text-purple-700 hover:underline"
              >
                View all <ExternalLink className="w-3 h-3" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="text-left py-2 px-2">Account</th>
                    <th className="text-left py-2 px-2">Role</th>
                    <th className="text-left py-2 px-2">Plan</th>
                    <th className="text-right py-2 px-2">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.length > 0 ? (
                    users.slice(0, 5).map((u) => (
                      <tr key={u._id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-purple-100 text-purple-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                              {(u.name || u.email || "U").charAt(0).toUpperCase()}
                            </div>
                            <div className="truncate max-w-[140px]">
                              <p className="font-semibold text-slate-900 truncate">
                                {u.name || "User"}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-2">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              u.role === "ADMIN"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="py-2.5 px-2">
                          <span className="capitalize font-medium text-slate-600">
                            {u.subscription?.planKey || "starter"}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right text-slate-500 font-medium text-[11px]">
                          {formatDate(u.createdAt)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="text-center py-6 text-slate-400">
                        No registered users found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
            <span>Total Accounts: {data.users.total}</span>
            <span className="font-semibold text-slate-700">
              Active Sync: <strong className="text-emerald-600">Connected</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
