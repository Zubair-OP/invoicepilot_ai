"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  Sparkles,
  Shield,
  CheckCircle2,
} from "lucide-react";

export default function Footer() {
  const pathname = usePathname();

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    targetId: string
  ) => {
    if (pathname === "/") {
      e.preventDefault();
      const element = document.getElementById(targetId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
        window.history.pushState(null, "", `#${targetId}`);
      }
    }
  };

  return (
    <footer
      className="bg-white text-slate-600 border-t border-slate-200/80"
      aria-label="Site footer"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
        {/* ── Main footer grid ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-10 lg:gap-12">
          {/* Brand Info — 2 cols wide */}
          <div className="col-span-2">
            <Link
              href="/"
              className="flex items-center gap-2.5 mb-4 group"
              aria-label="InvoicePilot AI — Home"
            >
              <div className="w-8 h-8 bg-gradient-to-tr from-emerald-600 to-green-500 rounded-xl flex items-center justify-center shadow-md shadow-emerald-600/20 group-hover:scale-105 transition-transform">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-extrabold text-slate-900 tracking-tight">
                Invoice<span className="text-emerald-600">Pilot</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> AI
              </span>
            </Link>
            <p className="text-sm text-slate-500 max-w-sm mb-5 leading-relaxed">
              The AI-first invoice management platform for modern freelancers,
              consultants, and fast-growing businesses. GST-compliant, fast, and
              always free to start.
            </p>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-3 py-1.5 rounded-full w-fit">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              All systems operational • 99.9% Uptime
            </div>
          </div>

          {/* Product Links */}
          <nav aria-label="Product navigation">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">
              Product
            </h3>
            <ul className="space-y-2.5">
              <li>
                <a
                  href="/#features"
                  onClick={(e) => handleNavClick(e, "features")}
                  className="text-sm text-slate-500 hover:text-emerald-600 transition-colors"
                >
                  Features
                </a>
              </li>
              <li>
                <a
                  href="/#how-it-works"
                  onClick={(e) => handleNavClick(e, "how-it-works")}
                  className="text-sm text-slate-500 hover:text-emerald-600 transition-colors"
                >
                  How It Works
                </a>
              </li>
              <li>
                <a
                  href="/#pricing"
                  onClick={(e) => handleNavClick(e, "pricing")}
                  className="text-sm text-slate-500 hover:text-emerald-600 transition-colors"
                >
                  Pricing
                </a>
              </li>
              <li>
                <a
                  href="/#faq"
                  onClick={(e) => handleNavClick(e, "faq")}
                  className="text-sm text-slate-500 hover:text-emerald-600 transition-colors"
                >
                  FAQ
                </a>
              </li>
            </ul>
          </nav>

          {/* Use Cases — keyword-rich internal links for topical authority */}
          <nav aria-label="Use cases navigation">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">
              Use Cases
            </h3>
            <ul className="space-y-2.5">
              <li>
                <Link
                  href="/register"
                  className="text-sm text-slate-500 hover:text-emerald-600 transition-colors"
                  title="Free invoice generator for freelancers"
                >
                  Freelance Invoicing
                </Link>
              </li>
              <li>
                <Link
                  href="/register"
                  className="text-sm text-slate-500 hover:text-emerald-600 transition-colors"
                  title="GST invoice generator online India"
                >
                  GST Invoice Generator
                </Link>
              </li>
              <li>
                <Link
                  href="/register"
                  className="text-sm text-slate-500 hover:text-emerald-600 transition-colors"
                  title="Agency billing and invoice management"
                >
                  Agency Billing
                </Link>
              </li>
              <li>
                <Link
                  href="/register"
                  className="text-sm text-slate-500 hover:text-emerald-600 transition-colors"
                  title="Invoice software for consultants"
                >
                  Consultant Invoices
                </Link>
              </li>
              <li>
                <Link
                  href="/register"
                  className="text-sm text-slate-500 hover:text-emerald-600 transition-colors"
                  title="Small business invoice management software"
                >
                  Small Business Billing
                </Link>
              </li>
            </ul>
          </nav>

          {/* Core Capabilities */}
          <nav aria-label="Capabilities navigation">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">
              Capabilities
            </h3>
            <ul className="space-y-2.5 text-sm text-slate-500">
              <li>Prompt-to-Invoice AI</li>
              <li>GST &amp; Reverse Tax</li>
              <li>Pixel-Perfect PDF</li>
              <li>Email Delivery &amp; Status</li>
              <li>Revenue Analytics</li>
            </ul>
          </nav>

          {/* Security & Compliance */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">
              Trust &amp; Safety
            </h3>
            <ul className="space-y-2.5 text-sm text-slate-500">
              <li className="flex items-center gap-1.5 text-slate-700 font-medium">
                <Shield className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                256-bit AES Encryption
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2
                  className="w-3.5 h-3.5 text-emerald-600"
                  aria-hidden="true"
                />
                GST Compliant
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2
                  className="w-3.5 h-3.5 text-emerald-600"
                  aria-hidden="true"
                />
                Stripe Verified
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2
                  className="w-3.5 h-3.5 text-emerald-600"
                  aria-hidden="true"
                />
                Daily Cloud Backups
              </li>
            </ul>
          </div>
        </div>

        {/* ── Sub-footer ────────────────────────────────────────────────── */}
        <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-400">
            &copy; {new Date().getFullYear()} InvoicePilot AI. Crafted for
            precision and high growth.
          </p>
          <nav
            aria-label="Legal navigation"
            className="flex items-center gap-6 text-xs text-slate-400 font-medium"
          >
            <span className="hover:text-slate-600 transition-colors cursor-pointer">
              Privacy Policy
            </span>
            <span className="hover:text-slate-600 transition-colors cursor-pointer">
              Terms of Service
            </span>
            <span className="hover:text-slate-600 transition-colors cursor-pointer">
              Security
            </span>
          </nav>
        </div>
      </div>
    </footer>
  );
}
