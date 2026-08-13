import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "DRAFT":
      return "bg-slate-100 text-slate-600 border border-slate-300";
    case "SENT":
      return "bg-blue-100 text-blue-700 border border-blue-300";
    case "PAID":
      return "bg-emerald-100 text-emerald-700 border border-emerald-300";
    case "OVERDUE":
      return "bg-red-100 text-red-700 border border-red-300";
    case "CANCELLED":
      return "bg-orange-100 text-orange-600 border border-orange-300 line-through";
    default:
      return "bg-gray-100 text-gray-700 border border-gray-200";
  }
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}
