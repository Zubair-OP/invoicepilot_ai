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

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const { api } = await import("@/lib/api");
        const res = await api.getInvoice(params.id as string);
        if (res.success) setInvoice(res.data);
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
          break;
        case "pay":
          await api.payInvoice(invoice!._id);
          break;
        case "email":
          await api.sendInvoiceEmail(invoice!._id);
          alert("Invoice sent via email!");
          break;
        case "void":
          if (!confirm(`Are you sure you want to void invoice ${invoice!.invoiceNumber}?\n\nThis will mark it as CANCELLED. You can restore it later if needed.`)) return;
          await api.voidInvoice(invoice!._id);
          break;
        case "unvoid":
          if (!confirm(`Restore invoice ${invoice!.invoiceNumber} back to its previous status?`)) return;
          await api.unvoidInvoice(invoice!._id);
          break;
        case "delete":
          if (!confirm("Permanently delete this draft invoice? This cannot be undone.")) return;
          await api.deleteInvoice(invoice!._id);
          router.push("/dashboard/invoices");
          return;
      }
      const res = await api.getInvoice(params.id as string);
      if (res.success) setInvoice(res.data);
    } catch (err: any) {
      alert(err.message || "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <Loading size="lg" text="Loading invoice..." />;
  if (!invoice) return <div className="text-center py-12 text-gray-500">Invoice not found</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
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
      <Card>
        <div className="flex flex-wrap gap-2 items-center">

          {/* ── DRAFT: send email (marks as SENT), download, delete ── */}
          {invoice.status === "DRAFT" && (<>
            <Button onClick={() => handleAction("email")} disabled={actionLoading}>
              <Mail className="w-4 h-4 mr-2" />
              Send via Email
            </Button>
            <a href={`${process.env.NEXT_PUBLIC_API_URL}/invoices/${invoice._id}/pdf`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline"><Download className="w-4 h-4 mr-2" />Download PDF</Button>
            </a>
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
            <a href={`${process.env.NEXT_PUBLIC_API_URL}/invoices/${invoice._id}/pdf`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline"><Download className="w-4 h-4 mr-2" />Download PDF</Button>
            </a>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" />Print
            </Button>
            <Button variant="danger" onClick={() => handleAction("void")} disabled={actionLoading}>
              <Ban className="w-4 h-4 mr-2" />Void Invoice
            </Button>
          </>)}

          {/* ── PAID: download & void only — no email, no re-pay ── */}
          {invoice.status === "PAID" && (<>
            <a href={`${process.env.NEXT_PUBLIC_API_URL}/invoices/${invoice._id}/pdf`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline"><Download className="w-4 h-4 mr-2" />Download PDF</Button>
            </a>
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
            <a href={`${process.env.NEXT_PUBLIC_API_URL}/invoices/${invoice._id}/pdf`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline"><Download className="w-4 h-4 mr-2" />Download PDF</Button>
            </a>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" />Print
            </Button>
          </>)}

        </div>
      </Card>


      {/* Invoice Preview */}
      <Card className="print:shadow-none print:border-none">
        <div className="bg-white p-8 border border-gray-200 rounded-lg">
          {/* Header */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-2xl font-bold text-green-600">INVOICE</h1>
              <p className="text-gray-500 mt-1">#{invoice.invoiceNumber}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Date: {formatDate(invoice.issuedAt)}</p>
              {invoice.dueDate && (
                <p className="text-sm text-gray-500">Due: {formatDate(invoice.dueDate)}</p>
              )}
              {invoice.paidAt && (
                <p className="text-sm text-green-600">Paid: {formatDate(invoice.paidAt)}</p>
              )}
            </div>
          </div>

          {/* Bill To */}
          {(() => {
            const customer = (typeof invoice.customerId === "object" && invoice.customerId !== null
              ? invoice.customerId
              : invoice.customer) as any;

            return (
              <div className="mb-8">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Bill To</p>
                <p className="font-semibold text-gray-900 text-base">{customer?.name || "—"}</p>
                {customer?.email && <p className="text-sm text-gray-600">{customer.email}</p>}
                {customer?.phone && <p className="text-sm text-gray-600">{customer.phone}</p>}
                {customer?.address && <p className="text-sm text-gray-600">{customer.address}</p>}
              </div>
            );
          })()}

          {/* Items Table */}
          <table className="w-full text-sm mb-8">
            <thead>
              <tr className="bg-green-600 text-white">
                <th className="text-left py-2 px-4 rounded-l-lg">#</th>
                <th className="text-left py-2 px-4">Description</th>
                <th className="text-right py-2 px-4">Qty</th>
                <th className="text-right py-2 px-4">Rate</th>
                <th className="text-right py-2 px-4 rounded-r-lg">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item: any, i: number) => {
                const itemAmount = item.total ?? item.amount ?? (item.quantity * item.unitPrice);
                return (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-3 px-4 text-gray-500">{i + 1}</td>
                    <td className="py-3 px-4 text-gray-900">{item.description}</td>
                    <td className="py-3 px-4 text-right text-gray-600">{item.quantity}</td>
                    <td className="py-3 px-4 text-right text-gray-600">{formatCurrency(item.unitPrice, invoice.currency)}</td>
                    <td className="py-3 px-4 text-right font-medium text-gray-900">{formatCurrency(itemAmount, invoice.currency)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span>{formatCurrency(invoice.subtotal, invoice.currency)}</span>
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
                  <span className="text-red-600">-{formatCurrency(invoice.discount, invoice.currency)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-gray-200 flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="text-green-600">{formatCurrency(invoice.total, invoice.currency)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Notes</p>
              <p className="text-sm text-gray-600">{invoice.notes}</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
