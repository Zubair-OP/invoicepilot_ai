"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, DollarSign, Download, Mail, FileText, Trash2, Printer, Ban } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Loading from "@/components/ui/Loading";
import Badge from "@/components/ui/Badge";
import { formatCurrency, formatDate, getStatusColor } from "@/lib/utils";
import type { Invoice } from "@/types";

import { useToast } from "@/context/ToastContext";

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast, confirmModal } = useToast();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [templateId, setTemplateId] = useState<string>("classic");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const { api } = await import("@/lib/api");
        const [invRes, settingsRes] = await Promise.all([
          api.getInvoice(params.id as string),
          api.getSettings(),
        ]);
        if (invRes.success) setInvoice(invRes.data);
        if (settingsRes.success && settingsRes.data?.templateId) {
          setTemplateId(settingsRes.data.templateId);
        }
      } catch {} finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  const handleAction = async (action: string) => {
    setActionLoading(true);
    try {
      const { api } = await import("@/lib/api");
      switch (action) {
        case "send":
          await api.sendInvoice(invoice!._id);
          toast.success("Invoice marked as sent!");
          break;
        case "pay":
          await api.payInvoice(invoice!._id);
          toast.success("Invoice marked as paid!");
          break;
        case "email":
          await api.sendInvoiceEmail(invoice!._id);
          toast.success("Invoice sent via email with PDF attachment!");
          break;
        case "void": {
          const ok = await confirmModal({
            title: "Void Invoice",
            message: `Are you sure you want to void invoice ${invoice!.invoiceNumber}?\n\nThis will mark it as CANCELLED. You can restore it later if needed.`,
            confirmText: "Void Invoice",
            variant: "danger",
          });
          if (!ok) return;
          await api.voidInvoice(invoice!._id);
          toast.warning("Invoice has been voided.");
          break;
        }
        case "unvoid": {
          const ok = await confirmModal({
            title: "Restore Invoice",
            message: `Restore invoice ${invoice!.invoiceNumber} back to its previous status?`,
            confirmText: "Restore",
            variant: "primary",
          });
          if (!ok) return;
          await api.unvoidInvoice(invoice!._id);
          toast.success("Invoice restored successfully!");
          break;
        }
        case "delete": {
          const ok = await confirmModal({
            title: "Delete Draft Invoice",
            message: "Permanently delete this draft invoice? This action cannot be undone.",
            confirmText: "Delete",
            variant: "danger",
          });
          if (!ok) return;
          await api.deleteInvoice(invoice!._id);
          toast.info("Draft invoice deleted.");
          router.push("/dashboard/invoices");
          return;
        }
      }
      const res = await api.getInvoice(params.id as string);
      if (res.success) setInvoice(res.data);
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!invoice) return;
    setActionLoading(true);
    try {
      const { api } = await import("@/lib/api");
      toast.info("Generating PDF, please wait...", "Downloading");
      await api.downloadInvoicePdf(invoice._id, invoice.invoiceNumber);
      toast.success("PDF downloaded successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate PDF");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <Loading size="lg" text="Loading invoice..." />;
  if (!invoice) return <div className="text-center py-12 text-gray-500">Invoice not found</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 print:m-0 print:p-0 print:max-w-none print:space-y-0">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/invoices" className="p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{invoice.invoiceNumber}</h2>
            <p className="text-sm text-gray-500">Created {formatDate(invoice.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(invoice.status)}`}>
            {invoice.status}
          </span>
        </div>
      </div>

      {/* Actions — shown only based on invoice status */}
      <Card className="print:hidden">
        <div className="flex flex-wrap gap-2 items-center">

          {/* ── DRAFT: send email (marks as SENT), download, delete ── */}
          {invoice.status === "DRAFT" && (<>
            <Button onClick={() => handleAction("email")} disabled={actionLoading}>
              <Mail className="w-4 h-4 mr-2" />
              Send via Email
            </Button>
            <Button variant="outline" onClick={handleDownloadPdf} disabled={actionLoading}>
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" />Print
            </Button>
            <Button variant="danger" onClick={() => handleAction("delete")} disabled={actionLoading}>
              <Trash2 className="w-4 h-4 mr-2" />Delete Draft
            </Button>
          </>)}

          {/* ── SENT / OVERDUE: can pay, resend email, download, void ── */}
          {(invoice.status === "SENT" || invoice.status === "OVERDUE") && (<>
            <Button onClick={() => handleAction("pay")} disabled={actionLoading}>
              <DollarSign className="w-4 h-4 mr-2" />Mark as Paid
            </Button>
            <Button variant="outline" onClick={() => handleAction("email")} disabled={actionLoading}>
              <Mail className="w-4 h-4 mr-2" />
              {invoice.status === "OVERDUE" ? "Send Reminder" : "Resend Email"}
            </Button>
            <Button variant="outline" onClick={handleDownloadPdf} disabled={actionLoading}>
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" />Print
            </Button>
            <Button variant="danger" onClick={() => handleAction("void")} disabled={actionLoading}>
              <Ban className="w-4 h-4 mr-2" />Void Invoice
            </Button>
          </>)}

          {/* ── PAID: download & void only — no email, no re-pay ── */}
          {invoice.status === "PAID" && (<>
            <Button variant="outline" onClick={handleDownloadPdf} disabled={actionLoading}>
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" />Print
            </Button>
            <Button variant="danger" onClick={() => handleAction("void")} disabled={actionLoading}>
              <Ban className="w-4 h-4 mr-2" />Void Invoice
            </Button>
          </>)}

          {/* ── CANCELLED: show restore button prominently + download ── */}
          {invoice.status === "CANCELLED" && (<>
            <span className="text-sm text-orange-600 font-medium mr-2">⚠ This invoice has been voided</span>
            <Button
              onClick={() => handleAction("unvoid")}
              disabled={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              ↩ Restore Invoice
            </Button>
            <Button variant="outline" onClick={handleDownloadPdf} disabled={actionLoading}>
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" />Print
            </Button>
          </>)}

        </div>
      </Card>


      {/* Invoice Preview (Dynamically styled by selected template) */}
      <Card className="invoice-print-root print:p-0 print:shadow-none print:border-none print:rounded-none print:bg-transparent">
        <div className={`invoice-print-document p-8 rounded-xl border transition-all duration-300 ${
          templateId === "modern"
            ? "bg-white border-indigo-100 shadow-sm"
            : templateId === "minimal"
            ? "bg-white border-slate-300 shadow-none font-mono text-slate-900"
            : "bg-white border-gray-200"
        }`}>
          {/* Header */}
          {templateId === "modern" ? (
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white p-6 rounded-xl flex justify-between items-start mb-8 shadow-md">
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight">INVOICE</h1>
                <p className="text-indigo-100 text-sm mt-0.5">#{invoice.invoiceNumber}</p>
              </div>
              <div className="text-right text-xs space-y-1">
                <p className="text-indigo-100">Issued: <span className="font-semibold text-white">{formatDate(invoice.issuedAt)}</span></p>
                {invoice.dueDate && (
                  <p className="text-indigo-100">Due: <span className="font-semibold text-white">{formatDate(invoice.dueDate)}</span></p>
                )}
                {invoice.paidAt && (
                  <p className="text-emerald-300 font-bold">Paid: {formatDate(invoice.paidAt)}</p>
                )}
              </div>
            </div>
          ) : templateId === "minimal" ? (
            <div className="flex justify-between items-end border-b-2 border-slate-900 pb-4 mb-8">
              <div>
                <h1 className="text-2xl font-black tracking-widest text-slate-900">INVOICE</h1>
                <p className="text-xs text-slate-500 mt-1">NO: {invoice.invoiceNumber}</p>
              </div>
              <div className="text-right text-xs space-y-1 text-slate-600">
                <p>DATE: <span className="font-bold text-slate-900">{formatDate(invoice.issuedAt)}</span></p>
                {invoice.dueDate && (
                  <p>DUE: <span className="font-bold text-slate-900">{formatDate(invoice.dueDate)}</span></p>
                )}
                {invoice.paidAt && (
                  <p className="font-bold text-slate-900">PAID: {formatDate(invoice.paidAt)}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-2xl font-bold text-green-600">INVOICE</h1>
                <p className="text-gray-500 mt-1">#{invoice.invoiceNumber}</p>
              </div>
              <div className="text-right text-sm">
                <p className="text-gray-500">Date: {formatDate(invoice.issuedAt)}</p>
                {invoice.dueDate && (
                  <p className="text-gray-500">Due: {formatDate(invoice.dueDate)}</p>
                )}
                {invoice.paidAt && (
                  <p className="text-green-600 font-semibold">Paid: {formatDate(invoice.paidAt)}</p>
                )}
              </div>
            </div>
          )}

          {/* Bill To */}
          {(() => {
            const customer = (typeof invoice.customerId === "object" && invoice.customerId !== null
              ? invoice.customerId
              : invoice.customer) as any;

            return (
              <div className={`mb-8 p-4 rounded-lg ${
                templateId === "modern"
                  ? "bg-indigo-50/50 border border-indigo-100"
                  : templateId === "minimal"
                  ? "border border-slate-200 bg-slate-50/50"
                  : "border-0"
              }`}>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1 font-semibold">Bill To</p>
                <p className="font-bold text-gray-900 text-base">{customer?.name || "—"}</p>
                {customer?.email && <p className="text-sm text-gray-600">{customer.email}</p>}
                {customer?.phone && <p className="text-sm text-gray-600">{customer.phone}</p>}
                {customer?.address && <p className="text-sm text-gray-600">{customer.address}</p>}
              </div>
            );
          })()}

          {/* Items Table */}
          <table className="w-full text-sm mb-8">
            <thead>
              <tr className={
                templateId === "modern"
                  ? "bg-indigo-50 text-indigo-950 font-bold border-b border-indigo-100"
                  : templateId === "minimal"
                  ? "border-b-2 border-slate-900 text-slate-900 font-bold text-xs uppercase"
                  : "bg-green-600 text-white"
              }>
                <th className="text-left py-2.5 px-4 rounded-l-lg">#</th>
                <th className="text-left py-2.5 px-4">Description</th>
                <th className="text-right py-2.5 px-4">Qty</th>
                <th className="text-right py-2.5 px-4">Rate</th>
                <th className="text-right py-2.5 px-4 rounded-r-lg">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoice.items.map((item: any, i: number) => {
                const itemAmount = item.total ?? item.amount ?? (item.quantity * item.unitPrice);
                return (
                  <tr key={i} className={templateId === "modern" ? "hover:bg-indigo-50/20" : "hover:bg-gray-50"}>
                    <td className="py-3 px-4 text-gray-500">{i + 1}</td>
                    <td className="py-3 px-4 text-gray-900 font-medium">{item.description}</td>
                    <td className="py-3 px-4 text-right text-gray-600">{item.quantity}</td>
                    <td className="py-3 px-4 text-right text-gray-600">{formatCurrency(item.unitPrice, invoice.currency)}</td>
                    <td className="py-3 px-4 text-right font-bold text-gray-900">{formatCurrency(itemAmount, invoice.currency)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end">
            <div className={`w-72 space-y-2 p-4 rounded-xl ${
              templateId === "modern"
                ? "bg-indigo-50/50 border border-indigo-100"
                : templateId === "minimal"
                ? "border border-slate-300"
                : "bg-gray-50 border border-gray-100"
            }`}>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-semibold">{formatCurrency(invoice.subtotal, invoice.currency)}</span>
              </div>
              {invoice.taxComponents.map((tax, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-500">{tax.name}</span>
                  <span>{formatCurrency(tax.amount, invoice.currency)}</span>
                </div>
              ))}
              {invoice.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Discount</span>
                  <span className="text-red-600 font-medium">-{formatCurrency(invoice.discount, invoice.currency)}</span>
                </div>
              )}
              <div className={`pt-2 border-t flex justify-between font-extrabold text-lg ${
                templateId === "modern"
                  ? "border-indigo-200 text-indigo-700"
                  : templateId === "minimal"
                  ? "border-slate-900 text-slate-900"
                  : "border-gray-200 text-green-600"
              }`}>
                <span>Total</span>
                <span>{formatCurrency(invoice.total, invoice.currency)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1 font-semibold">Notes</p>
              <p className="text-sm text-gray-600">{invoice.notes}</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
