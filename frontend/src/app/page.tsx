"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  ArrowRight,
  FileText,
  Zap,
  Shield,
  Users,
  BarChart3,
  Send,
  Download,
  Sparkles,
  Check,
  ChevronDown,
  Star,
  CheckCircle2,
  DollarSign,
  Layers,
  Globe,
  Cpu,
  Quote,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Button from "@/components/ui/Button";

/* ─────────────────────────────────────────────────────────────────────────────
   FAQ PAGE JSON-LD  (injected per-page — Google indexes FAQ rich results
   directly from these, separate from the SoftwareApplication schema in layout)
   ───────────────────────────────────────────────────────────────────────── */
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How does the AI invoice creation work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You can simply type a natural phrase like 'Invoice Microsoft for 30 hours of AI consulting at $120/hr with 18% GST due in 14 days'. InvoicePilot's AI parser instantly detects the client, items, quantities, rates, currency, and tax breakdown and populates your invoice in under 2 seconds.",
      },
    },
    {
      "@type": "Question",
      name: "Is InvoicePilot compliant with GST and tax regulations?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes! InvoicePilot includes built-in support for Indian GST (CGST, SGST, IGST), HSN/SAC codes, reverse charge mechanism, and state code validation, as well as VAT and international tax zero-rating for exports.",
      },
    },
    {
      "@type": "Question",
      name: "Can I customize the templates with my company logo and colors?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Absolutely. You can upload high-resolution logos, specify your brand primary and accent colors, select from modern font pairings, add custom payment instructions, and attach your digital signature.",
      },
    },
    {
      "@type": "Question",
      name: "How does the free tier work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Our Starter plan is 100% free forever with no credit card required. You get 5 free invoices per month, AI generations, PDF exports, and client management. You can upgrade anytime as your business expands.",
      },
    },
    {
      "@type": "Question",
      name: "Can I send invoices directly to my client's email?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. You can send professional emails with customized subject lines and personalized message templates, complete with an attached PDF invoice and direct payment links.",
      },
    },
    {
      "@type": "Question",
      name: "Is my financial and client data secure?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "We take security with utmost seriousness. All data is encrypted with 256-bit AES encryption in transit and at rest. We never sell your data and use industry-standard security protocols.",
      },
    },
    {
      "@type": "Question",
      name: "Is InvoicePilot a free GST invoice generator for India?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. InvoicePilot's free Starter plan lets you generate fully GST-compliant invoices — with automatic CGST, SGST, and IGST split, HSN/SAC codes, and state validation — at no cost, forever. No credit card required.",
      },
    },
    {
      "@type": "Question",
      name: "Which types of freelancers and businesses use InvoicePilot?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "InvoicePilot is used by independent freelancers (designers, developers, writers, consultants), boutique creative agencies, SaaS startups, and registered GST businesses across India and globally. Any professional who bills clients regularly saves hours every week.",
      },
    },
    {
      "@type": "Question",
      name: "Can I generate invoices in multiple currencies?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Business Scale plan users can generate invoices in multiple currencies with live FX-aware formatting, ideal for freelancers billing international clients in USD, EUR, GBP, or AED.",
      },
    },
  ],
};

const demoPrompts = [
  {
    label: "Web App Design",
    prompt: "Invoice Stripe for 40 hours of Next.js UI/UX redesign at $95/hr, 18% GST",
    client: "Stripe Inc.",
    amount: "$4,484.00",
    items: [
      { desc: "Next.js UI/UX Frontend Redesign", qty: "40 hrs", rate: "$95.00", total: "$3,800.00" },
      { desc: "CGST (9%) + SGST (9%)", qty: "Tax", rate: "18%", total: "$684.00" },
    ],
  },
  {
    label: "AI Cloud Consulting",
    prompt: "Invoice Vercel for AI Pipeline Architecture Consulting, fixed price $2,500 with zero tax export",
    client: "Vercel Corp.",
    amount: "$2,500.00",
    items: [
      { desc: "AI Pipeline & LLM Routing Architecture", qty: "1 Milestone", rate: "$2,500.00", total: "$2,500.00" },
      { desc: "Export of Services (LUT - 0% Tax)", qty: "LUT", rate: "0%", total: "$0.00" },
    ],
  },
  {
    label: "Monthly SEO Retainer",
    prompt: "Invoice Acme Tech for Monthly SEO & Content Marketing Retainer, $1,800 + 18% GST",
    client: "Acme Tech Ltd.",
    amount: "$2,124.00",
    items: [
      { desc: "Monthly Performance SEO & Content Sprint", qty: "1 Mo", rate: "$1,800.00", total: "$1,800.00" },
      { desc: "Integrated GST (IGST 18%)", qty: "Tax", rate: "18%", total: "$324.00" },
    ],
  },
];

const features = [
  {
    icon: <Sparkles className="w-6 h-6 text-white" />,
    iconBg: "bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 shadow-lg shadow-emerald-500/25 ring-4 ring-emerald-50/80",
    badge: "AI Powered",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
    title: "Instant AI Prompt-to-Invoice",
    description:
      "Type one natural English sentence like 'Bill Acme for 20h design at $80/hr' and watch AI extract customer details, calculate taxes, and build your invoice instantly.",
    featured: true,
  },
  {
    icon: <Shield className="w-6 h-6 text-white" />,
    iconBg: "bg-gradient-to-tr from-blue-600 via-indigo-500 to-cyan-400 shadow-lg shadow-blue-500/25 ring-4 ring-blue-50/80",
    badge: "Compliance",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200/80",
    title: "Smart GST & Multi-Tax Engine",
    description:
      "Automated CGST/SGST/IGST breakdown, HSN/SAC code mapping, reverse charge flags, and custom tax configurations.",
    featured: false,
  },
  {
    icon: <Download className="w-6 h-6 text-white" />,
    iconBg: "bg-gradient-to-tr from-purple-600 via-fuchsia-500 to-pink-400 shadow-lg shadow-purple-500/25 ring-4 ring-purple-50/80",
    badge: "PDF Engine",
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200/80",
    title: "Pixel-Perfect PDF Generation",
    description:
      "Export high-resolution, vector-crisp PDFs with your exact brand palette, logo, digital signature, and terms.",
    featured: false,
  },
  {
    icon: <Send className="w-6 h-6 text-white" />,
    iconBg: "bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-400 shadow-lg shadow-amber-500/25 ring-4 ring-amber-50/80",
    badge: "1-Click Send",
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200/80",
    title: "Direct Client Email & Tracking",
    description:
      "Email invoices directly with attached PDFs. Know the moment your client views, downloads, or pays.",
    featured: false,
  },
  {
    icon: <BarChart3 className="w-6 h-6 text-white" />,
    iconBg: "bg-gradient-to-tr from-teal-500 via-emerald-500 to-green-400 shadow-lg shadow-teal-500/25 ring-4 ring-teal-50/80",
    badge: "Analytics",
    badgeColor: "bg-teal-50 text-teal-700 border-teal-200/80",
    title: "Real-Time Revenue Dashboard",
    description:
      "Get real-time insights into monthly recurring revenue, overdue receivables, cashflow forecasts, and client lifecycles.",
    featured: false,
  },
  {
    icon: <Layers className="w-6 h-6 text-white" />,
    iconBg: "bg-gradient-to-tr from-rose-500 via-pink-500 to-purple-400 shadow-lg shadow-rose-500/25 ring-4 ring-rose-50/80",
    badge: "Branding",
    badgeColor: "bg-rose-50 text-rose-700 border-rose-200/80",
    title: "Premium Designer Templates",
    description:
      "Switch seamlessly between Minimalist, Corporate, Modern, and Creative layouts with custom typography and accent colors.",
    featured: false,
  },
];

const steps = [
  {
    step: "01",
    title: "Describe or Select",
    description:
      "Type your invoice requirements in natural language or choose a client from your saved database.",
    icon: <Sparkles className="w-5 h-5 text-white" />,
    iconBg: "bg-gradient-to-tr from-emerald-500 to-teal-400 shadow-md shadow-emerald-500/25",
  },
  {
    step: "02",
    title: "AI Auto-Calculates",
    description:
      "Our engine maps line items, applies exact GST rates, and renders a live interactive preview.",
    icon: <Cpu className="w-5 h-5 text-white" />,
    iconBg: "bg-gradient-to-tr from-blue-500 to-indigo-500 shadow-md shadow-blue-500/25",
  },
  {
    step: "03",
    title: "Deliver & Share",
    description:
      "Send directly through secure email or download a print-ready vector PDF in 1 click.",
    icon: <Send className="w-5 h-5 text-white" />,
    iconBg: "bg-gradient-to-tr from-purple-500 to-pink-500 shadow-md shadow-purple-500/25",
  },
  {
    step: "04",
    title: "Track & Reconcile",
    description:
      "Automated payment status tracking, overdue reminders, and dashboard financial insights.",
    icon: <CheckCircle2 className="w-5 h-5 text-white" />,
    iconBg: "bg-gradient-to-tr from-amber-500 to-emerald-500 shadow-md shadow-amber-500/25",
  },
];

/* ── WHO USES INVOICEPILOT — Buyer-stage awareness (Stage 2–3 intent) ── */
const useCases = [
  {
    icon: <FileText className="w-6 h-6 text-emerald-600" />,
    bg: "bg-emerald-50",
    title: "Freelancers & Independent Consultants",
    description:
      "Stop wasting billable hours building invoices in Word or Excel. Type one sentence and get a professional, GST-compliant PDF ready to send in under 60 seconds.",
    keywords: ["Freelance invoice generator", "Invoice for consultants"],
  },
  {
    icon: <Users className="w-6 h-6 text-blue-600" />,
    bg: "bg-blue-50",
    title: "Creative Agencies & Studios",
    description:
      "Manage hundreds of client invoices per month across multiple projects and currencies — with team access, custom templates, and one-click bulk delivery.",
    keywords: ["Agency billing software", "Creative studio invoices"],
  },
  {
    icon: <Globe className="w-6 h-6 text-purple-600" />,
    bg: "bg-purple-50",
    title: "GST-Registered Businesses in India",
    description:
      "Auto-generate CGST/SGST/IGST splits, apply correct HSN/SAC codes, and stay 100% compliant with Indian tax regulations — without a chartered accountant.",
    keywords: ["GST invoice software India", "IGST CGST SGST invoice generator"],
  },
  {
    icon: <DollarSign className="w-6 h-6 text-amber-600" />,
    bg: "bg-amber-50",
    title: "SaaS Startups & Tech Teams",
    description:
      "Invoice enterprise clients with multi-currency support, milestone billing, and LUT zero-rated export invoices for international service delivery.",
    keywords: ["SaaS invoice software", "Multi-currency invoice generator"],
  },
];

/* ── TESTIMONIALS — Review sentiment language drives conversion ── */
const testimonials = [
  {
    name: "Rahul M.",
    role: "Full-Stack Developer • Freelancer",
    rating: 5,
    text: "I used to spend 30–40 minutes on every invoice. Now I just type what I did and InvoicePilot handles the GST, the PDF, and the email. Literally feels illegal how fast it is.",
    avatar: "RM",
    avatarBg: "bg-emerald-100 text-emerald-700",
  },
  {
    name: "Priya S.",
    role: "Creative Director • Boutique Agency",
    rating: 5,
    text: "We handle 50+ invoices a month for different clients. The team access and custom templates alone saved us hours every week. GST compliance is flawless — our CA hasn't flagged a single invoice.",
    avatar: "PS",
    avatarBg: "bg-blue-100 text-blue-700",
  },
  {
    name: "Ankit V.",
    role: "AI Consultant • Solo Operator",
    rating: 5,
    text: "The AI understands my prompts perfectly. 'Invoice Stripe for 40 hours at $95 with IGST' — done. I was worried about the free plan limits, but honestly the Starter tier covers my whole month.",
    avatar: "AV",
    avatarBg: "bg-purple-100 text-purple-700",
  },
];

const faqs = [
  {
    q: "How does the AI invoice creation work?",
    a: "You can simply type a natural phrase like 'Invoice Microsoft for 30 hours of AI consulting at $120/hr with 18% GST due in 14 days'. InvoicePilot's AI parser instantly detects the client, items, quantities, rates, currency, and tax breakdown and populates your invoice in under 2 seconds.",
  },
  {
    q: "Is InvoicePilot compliant with GST and tax regulations?",
    a: "Yes! InvoicePilot includes built-in support for Indian GST (CGST, SGST, IGST), HSN/SAC codes, reverse charge mechanism, and state code validation, as well as VAT and international tax zero-rating for exports.",
  },
  {
    q: "Can I customize the templates with my company logo and colors?",
    a: "Absolutely. You can upload high-resolution logos, specify your brand primary and accent colors, select from modern font pairings, add custom payment instructions, and attach your digital signature.",
  },
  {
    q: "How does the free tier work?",
    a: "Our Starter plan is 100% free forever with no credit card required. You get 5 free invoices per month, AI generations, PDF exports, and client management. You can upgrade anytime as your business expands.",
  },
  {
    q: "Can I send invoices directly to my client's email?",
    a: "Yes. You can send professional emails with customized subject lines and personalized message templates, complete with an attached PDF invoice and direct payment links.",
  },
  {
    q: "Is my financial and client data secure?",
    a: "We take security with utmost seriousness. All data is encrypted with 256-bit AES encryption in transit and at rest. We never sell your data and use industry-standard security protocols.",
  },
  /* ── New high-intent FAQ entries (targeting keyword gaps) ── */
  {
    q: "Is InvoicePilot a free GST invoice generator for India?",
    a: "Yes. InvoicePilot's free Starter plan lets you generate fully GST-compliant invoices — with automatic CGST, SGST, and IGST split, HSN/SAC codes, and state validation — at no cost, forever. No credit card required.",
  },
  {
    q: "Which types of freelancers and businesses use InvoicePilot?",
    a: "InvoicePilot is used by independent freelancers (designers, developers, writers, consultants), boutique creative agencies, SaaS startups, and GST-registered businesses across India and globally. Any professional who bills clients regularly saves hours every week.",
  },
  {
    q: "Can I generate invoices in multiple currencies?",
    a: "Yes. Business Scale plan users can generate invoices in multiple currencies with live FX-aware formatting, ideal for freelancers billing international clients in USD, EUR, GBP, or AED.",
  },
];

export default function LandingPage() {
  const [activeDemo, setActiveDemo] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [faqSpotlight, setFaqSpotlight] = useState(false);

  useEffect(() => {
    const handleNavEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ targetId: string }>;
      if (customEvent.detail?.targetId === "faq") {
        setOpenFaq(0);
        setFaqSpotlight(true);
        setTimeout(() => setFaqSpotlight(false), 2000);
      }
    };
    window.addEventListener("navToSection", handleNavEvent);
    return () => window.removeEventListener("navToSection", handleNavEvent);
  }, []);

  const scrollToSection = (
    e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>,
    id: string
  ) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.pushState(null, "", `#${id}`);
      if (id === "faq") {
        setOpenFaq(0);
        setFaqSpotlight(true);
        setTimeout(() => setFaqSpotlight(false), 2000);
      }
    }
  };

  const toggleFaq = (index: number) => {
    setOpenFaq((prev) => (prev === index ? null : index));
  };

  const selectedDemo = demoPrompts[activeDemo];

  return (
    <>
      {/* FAQ Page JSON-LD for Google Rich Results */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <div className="min-h-screen flex flex-col bg-slate-50/50 text-slate-900 selection:bg-emerald-500 selection:text-white">
        <Navbar />

        {/* ── HERO SECTION ──────────────────────────────────────────────── */}
        <section
          className="relative pt-8 pb-16 sm:pt-14 sm:pb-24 overflow-hidden"
          aria-label="Hero"
        >
          {/* Ambient background */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[650px] pointer-events-none overflow-hidden">
            <div className="absolute -top-32 left-1/3 w-[550px] h-[550px] bg-emerald-400/15 rounded-full blur-[130px]" />
            <div className="absolute top-20 right-1/4 w-[450px] h-[450px] bg-teal-300/12 rounded-full blur-[110px]" />
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: "radial-gradient(#000 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />
          </div>

          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            {/* Trust badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-slate-200/90 shadow-xs mb-6">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs sm:text-sm font-semibold text-slate-800">
                AI-Powered Invoice Generation — Free to Start
              </span>
            </div>

            {/* ── H1: Primary keyword + brand promise ── */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.12] mb-5">
              AI Invoice Generator —{" "}
              <span className="text-emerald-600">
                GST-Ready PDFs in Seconds
              </span>
            </h1>

            {/* Conversion-focused subtitle — addresses buyer fears */}
            <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto mb-3 leading-relaxed font-normal">
              Stop losing billable hours to spreadsheets and Word templates.
              Describe your invoice in one sentence — AI fills the form,
              calculates CGST/SGST/IGST automatically, and exports a
              pixel-perfect PDF.
            </p>
            <p className="text-sm text-slate-500 max-w-xl mx-auto mb-8">
              Trusted by{" "}
              <strong className="text-slate-700">1,200+ freelancers, agencies & businesses</strong>{" "}
              across India and globally. Free forever — no credit card needed.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mb-12">
              <Link href="/register" className="w-full sm:w-auto">
                <button
                  id="hero-cta-primary"
                  className="w-full sm:w-auto px-7 py-3.5 text-base font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md hover:shadow-lg active:scale-95 transition-all duration-200 cursor-pointer"
                >
                  Create Free Invoice →
                </button>
              </Link>
              <a
                href="#features"
                onClick={(e) => scrollToSection(e, "features")}
                className="w-full sm:w-auto"
              >
                <button
                  id="hero-cta-secondary"
                  className="w-full sm:w-auto px-6 py-3.5 text-base font-semibold text-slate-700 hover:text-slate-950 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl shadow-2xs hover:shadow-xs active:scale-95 transition-all duration-200 cursor-pointer"
                >
                  View Features
                </button>
              </a>
            </div>

            {/* ── macOS-style interactive demo ─────────────────────────── */}
            <div className="max-w-4xl mx-auto rounded-2xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-300/40 overflow-hidden text-left">
              {/* Window chrome */}
              <div className="bg-slate-50/90 border-b border-slate-200/80 px-4 sm:px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-red-400" />
                    <span className="w-3 h-3 rounded-full bg-amber-400" />
                    <span className="w-3 h-3 rounded-full bg-emerald-400" />
                  </div>
                  <span className="text-xs sm:text-sm text-slate-500 font-medium ml-2 hidden sm:inline">
                    Invoice Editor — InvoicePilot AI
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500 mr-1 hidden md:inline">
                    Try Demo:
                  </span>
                  {demoPrompts.map((d, index) => (
                    <button
                      key={d.label}
                      onClick={() => setActiveDemo(index)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer active:scale-95 ${
                        activeDemo === index
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-slate-200/80 text-slate-700 hover:bg-slate-300/80"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Window content */}
              <div className="p-4 sm:p-6 bg-slate-50/40">
                <div className="bg-slate-900 text-slate-100 p-4 rounded-xl mb-5 shadow-inner flex items-center gap-3 border border-slate-800">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <Zap className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                      Natural Language Input:
                    </p>
                    <p className="text-sm sm:text-base font-mono text-emerald-300 truncate font-semibold">
                      &quot;{selectedDemo.prompt}&quot;
                    </p>
                  </div>
                  <span className="hidden sm:inline-flex px-2.5 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-bold rounded-lg border border-emerald-500/30 shrink-0">
                    ⚡ Parsed in 0.2s
                  </span>
                </div>

                <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs">
                  <div className="flex justify-between items-center gap-2 mb-4 pb-4 border-b border-slate-100">
                    <div>
                      <span className="text-xs font-bold uppercase text-slate-400 block tracking-wider mb-0.5">
                        Billed To
                      </span>
                      <span className="text-base font-bold text-slate-900">
                        {selectedDemo.client}
                      </span>
                      <span className="text-xs text-slate-500 block">
                        INV-2026-{activeDemo + 101} • Net 14 Days
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold uppercase text-slate-400 block tracking-wider mb-0.5">
                        Total Amount
                      </span>
                      <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 tracking-tight">
                        {selectedDemo.amount}
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto mb-4">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase text-xs tracking-wider">
                          <th className="pb-2">Description</th>
                          <th className="pb-2 text-center">Qty</th>
                          <th className="pb-2 text-right">Rate</th>
                          <th className="pb-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedDemo.items.map((item, idx) => (
                          <tr
                            key={idx}
                            className="hover:bg-slate-50/60 transition-colors"
                          >
                            <td className="py-2.5 font-medium text-slate-800 text-sm">
                              {item.desc}
                            </td>
                            <td className="py-2.5 text-center text-slate-600 text-sm">
                              {item.qty}
                            </td>
                            <td className="py-2.5 text-right text-slate-600 text-sm">
                              {item.rate}
                            </td>
                            <td className="py-2.5 text-right font-bold text-slate-900 text-sm">
                              {item.total}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 text-xs text-slate-500 border-t border-slate-100">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Check className="w-4 h-4 text-emerald-600" />
                      Auto-generated GST &amp; HSN Breakdown
                    </span>
                    <Link href="/register">
                      <span className="text-emerald-600 font-bold hover:underline cursor-pointer inline-flex items-center gap-1 text-xs">
                        Create your invoice{" "}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FEATURES BENTO GRID ───────────────────────────────────────── */}
        <section
          id="features"
          className="scroll-mt-24 py-20 sm:py-28 bg-white border-y border-slate-100"
          aria-labelledby="features-heading"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-wider mb-3">
                Power Packed Features
              </div>
              <h2
                id="features-heading"
                className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4"
              >
                Everything Needed to Bill Like a Pro
              </h2>
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
                Engineered to replace tedious manual bookkeeping with seamless
                AI automation and strict financial accuracy.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {features.map((feature, i) => (
                <div
                  key={i}
                  className={`group relative p-7 sm:p-8 rounded-3xl border border-slate-200/80 bg-white hover:border-emerald-300/80 hover:shadow-xl hover:shadow-emerald-500/10 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between ${
                    feature.featured
                      ? "md:col-span-2 lg:col-span-2 bg-gradient-to-br from-emerald-50/50 via-white to-teal-50/30"
                      : ""
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <div
                        className={`w-12 h-12 rounded-2xl ${feature.iconBg} flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}
                      >
                        {feature.icon}
                      </div>
                      <span
                        className={`text-xs font-bold px-3 py-1 rounded-full border shadow-2xs ${feature.badgeColor}`}
                      >
                        {feature.badge}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-emerald-700 transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-slate-600 text-sm sm:text-base leading-relaxed font-normal">
                      {feature.description}
                    </p>
                  </div>

                  {feature.featured && (
                    <div className="mt-8 pt-6 border-t border-emerald-100/80 flex flex-wrap items-center gap-4 text-xs sm:text-sm font-semibold text-emerald-800">
                      <span className="flex items-center gap-1.5 bg-white/80 px-3 py-1.5 rounded-lg border border-emerald-200/60 shadow-2xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Multilingual Support
                      </span>
                      <span className="flex items-center gap-1.5 bg-white/80 px-3 py-1.5 rounded-lg border border-emerald-200/60 shadow-2xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Custom Prompt Presets
                      </span>
                      <span className="flex items-center gap-1.5 bg-white/80 px-3 py-1.5 rounded-lg border border-emerald-200/60 shadow-2xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Context Memory
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ──────────────────────────────────────────────── */}
        <section
          id="how-it-works"
          className="scroll-mt-24 py-20 sm:py-28 bg-slate-50 border-b border-slate-200/80 relative overflow-hidden"
          aria-labelledby="how-it-works-heading"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-wider mb-3 border border-emerald-200/80">
                Simple Workflow
              </div>
              <h2
                id="how-it-works-heading"
                className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4"
              >
                From Thought to Cash in 4 Steps
              </h2>
              <p className="text-base sm:text-lg text-slate-600">
                No complex forms or spreadsheet formulas. Effortless invoicing
                for modern teams.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {steps.map((s, i) => (
                <div
                  key={i}
                  className="relative bg-white border border-slate-200/90 p-6 sm:p-7 rounded-3xl hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-300 group"
                >
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-3xl font-extrabold text-emerald-600/30 group-hover:text-emerald-600 transition-colors font-mono">
                      {s.step}
                    </span>
                    <div
                      className={`w-11 h-11 rounded-2xl ${s.iconBg} flex items-center justify-center group-hover:scale-110 group-hover:-rotate-3 transition-all duration-300`}
                    >
                      {s.icon}
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">
                    {s.title}
                  </h3>
                  <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                    {s.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── WHO USES INVOICEPILOT (Stage 2–3 Buyer Intent) ───────────── */}
        <section
          id="who-uses"
          className="scroll-mt-24 py-20 sm:py-28 bg-white border-b border-slate-100"
          aria-labelledby="who-uses-heading"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider mb-3">
                Built for Every Biller
              </div>
              <h2
                id="who-uses-heading"
                className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4"
              >
                Who Uses InvoicePilot?
              </h2>
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
                Whether you&apos;re a solo freelancer, a growing agency, or a
                GST-registered business — InvoicePilot saves you hours every
                week.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {useCases.map((uc, i) => (
                <article
                  key={i}
                  className="group p-7 rounded-3xl border border-slate-200/80 bg-white hover:border-emerald-300/60 hover:shadow-xl hover:shadow-emerald-500/8 hover:-translate-y-1 transition-all duration-300"
                >
                  <div
                    className={`w-12 h-12 rounded-2xl ${uc.bg} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}
                  >
                    {uc.icon}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-2 group-hover:text-emerald-700 transition-colors">
                    {uc.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {uc.description}
                  </p>
                </article>
              ))}
            </div>

            {/* Stats strip — trust signals */}
            <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
              {[
                { value: "1,200+", label: "Active Users" },
                { value: "50,000+", label: "Invoices Generated" },
                { value: "5 hrs", label: "Saved Per Week" },
                { value: "99.9%", label: "Uptime SLA" },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="text-3xl font-extrabold text-emerald-600 mb-1">
                    {stat.value}
                  </div>
                  <div className="text-sm text-slate-500 font-medium">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── TESTIMONIALS (Review Sentiment — real customer language) ──── */}
        <section
          id="testimonials"
          className="scroll-mt-24 py-20 sm:py-28 bg-slate-50 border-b border-slate-200/80"
          aria-labelledby="testimonials-heading"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-wider mb-3">
                Real User Reviews
              </div>
              <h2
                id="testimonials-heading"
                className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4"
              >
                What Users Are Saying
              </h2>
              <p className="text-base sm:text-lg text-slate-600">
                Join 1,200+ freelancers, agencies, and businesses who replaced
                their invoice spreadsheets with InvoicePilot.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {testimonials.map((t, i) => (
                <figure
                  key={i}
                  className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm hover:shadow-lg hover:border-emerald-300/60 hover:-translate-y-1 transition-all duration-300"
                  itemScope
                  itemType="https://schema.org/Review"
                >
                  {/* Stars */}
                  <div className="flex items-center gap-0.5 mb-5">
                    {Array.from({ length: t.rating }).map((_, s) => (
                      <Star
                        key={s}
                        className="w-4 h-4 fill-amber-400 text-amber-400"
                      />
                    ))}
                  </div>
                  {/* Quote */}
                  <Quote
                    className="w-6 h-6 text-emerald-200 mb-3"
                    aria-hidden="true"
                  />
                  <blockquote
                    className="text-sm sm:text-base text-slate-700 leading-relaxed mb-6 font-medium"
                    itemProp="reviewBody"
                  >
                    &ldquo;{t.text}&rdquo;
                  </blockquote>
                  {/* Author */}
                  <figcaption className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full ${t.avatarBg} flex items-center justify-center text-sm font-bold shrink-0`}
                    >
                      {t.avatar}
                    </div>
                    <div>
                      <div
                        className="text-sm font-bold text-slate-900"
                        itemProp="author"
                      >
                        {t.name}
                      </div>
                      <div className="text-xs text-slate-500">{t.role}</div>
                    </div>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* ── PRICING SECTION ───────────────────────────────────────────── */}
        <section
          id="pricing"
          className="scroll-mt-24 py-20 sm:py-28 bg-white border-b border-slate-100"
          aria-labelledby="pricing-heading"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-wider mb-3 border border-emerald-200">
                Transparent Pricing
              </div>
              <h2
                id="pricing-heading"
                className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4"
              >
                Invest in Speed, Save Countless Hours
              </h2>
              <p className="text-base sm:text-lg text-slate-600 mb-8">
                Start completely free. Upgrade when your invoice volume
                accelerates.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
              {/* Free Starter */}
              <div className="bg-slate-50/60 rounded-3xl p-8 border border-slate-200/90 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-1">
                    Starter
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 mb-5">
                    For independent creators &amp; hobbyists
                  </p>
                  <div className="mb-6 pb-6 border-b border-slate-200/80">
                    <span className="text-4xl font-extrabold text-slate-900">
                      $0
                    </span>
                    <span className="text-slate-500 text-xs sm:text-sm font-medium">
                      {" "}
                      / forever
                    </span>
                  </div>
                  <ul className="space-y-3 mb-8 text-sm sm:text-base text-slate-600">
                    <li className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        <strong>5 Invoices</strong> per month
                      </span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        <strong>10 AI</strong> Prompt generations
                      </span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Vector PDF Downloads</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>GST &amp; Tax Calculations</span>
                    </li>
                  </ul>
                </div>
                <Link href="/register" className="block w-full">
                  <Button
                    variant="outline"
                    size="md"
                    className="w-full font-bold active:scale-95 transition-all"
                  >
                    Get Started Free
                  </Button>
                </Link>
              </div>

              {/* Pro Plan */}
              <div className="relative bg-gradient-to-b from-emerald-950 via-slate-900 to-slate-900 text-white rounded-3xl p-8 border-2 border-emerald-500 shadow-xl shadow-emerald-500/10 flex flex-col justify-between scale-[1.03]">
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 bg-gradient-to-r from-emerald-500 to-green-500 text-white text-xs font-extrabold uppercase tracking-wider rounded-full shadow-md">
                  ⚡ Most Popular
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">
                    Pro Freelancer
                  </h3>
                  <p className="text-xs sm:text-sm text-emerald-300/80 mb-5">
                    For active freelancers &amp; boutique studios
                  </p>
                  <div className="mb-6 pb-6 border-b border-slate-800">
                    <span className="text-4xl font-extrabold text-white">
                      $19
                    </span>
                    <span className="text-slate-400 text-xs sm:text-sm font-medium">
                      {" "}
                      / month
                    </span>
                  </div>
                  <ul className="space-y-3 mb-8 text-sm sm:text-base text-slate-300">
                    <li className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        <strong>100 Invoices</strong> per month
                      </span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        <strong>200 AI Generations</strong>
                      </span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Direct Client Email Delivery</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>All Designer Invoice Templates</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Custom Logo &amp; Signatures</span>
                    </li>
                  </ul>
                </div>
                <Link href="/register" className="block w-full">
                  <button className="w-full py-3.5 px-4 text-sm sm:text-base font-bold text-white bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 rounded-xl shadow-lg shadow-emerald-500/25 active:scale-95 transition-all duration-200 cursor-pointer">
                    Start Pro 14-Day Free
                  </button>
                </Link>
              </div>

              {/* Business Scale */}
              <div className="bg-slate-50/60 rounded-3xl p-8 border border-slate-200/90 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-1">
                    Business Scale
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 mb-5">
                    For agencies, startups, &amp; enterprises
                  </p>
                  <div className="mb-6 pb-6 border-b border-slate-200/80">
                    <span className="text-4xl font-extrabold text-slate-900">
                      $49
                    </span>
                    <span className="text-slate-500 text-xs sm:text-sm font-medium">
                      {" "}
                      / month
                    </span>
                  </div>
                  <ul className="space-y-3 mb-8 text-sm sm:text-base text-slate-600">
                    <li className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        <strong>Unlimited Invoices</strong>
                      </span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        <strong>Unlimited AI</strong> Generations
                      </span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Multi-Currency &amp; Global FX</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Priority 24/7 Support</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Team Multi-User Access</span>
                    </li>
                  </ul>
                </div>
                <Link href="/register" className="block w-full">
                  <Button
                    variant="outline"
                    size="md"
                    className="w-full font-bold active:scale-95 transition-all"
                  >
                    Scale with Premium
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ SECTION (FAQPage schema rendered above) ───────────────── */}
        <section
          id="faq"
          className="scroll-mt-24 py-20 sm:py-28 bg-slate-50/50"
          aria-labelledby="faq-heading"
        >
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <div
                className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 transition-all duration-300 ${
                  faqSpotlight
                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 scale-105"
                    : "bg-emerald-50 text-emerald-700"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Got Questions?
              </div>
              <h2
                id="faq-heading"
                className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4"
              >
                Frequently Asked Questions
              </h2>
              <p className="text-base sm:text-lg text-slate-600">
                Clear answers to help you get started with InvoicePilot — the
                AI invoice generator built for modern businesses.
              </p>
            </div>

            <div className="space-y-4">
              {faqs.map((faq, index) => {
                const isOpen = openFaq === index;
                return (
                  <div
                    key={index}
                    className={`rounded-2xl border transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden bg-white ${
                      isOpen
                        ? "border-emerald-500/70 shadow-lg shadow-emerald-500/5 ring-1 ring-emerald-500/20"
                        : "border-slate-200/90 hover:border-slate-300 hover:shadow-xs"
                    }`}
                  >
                    <button
                      onClick={() => toggleFaq(index)}
                      className="w-full px-6 py-5 text-left flex items-center justify-between gap-4 cursor-pointer focus:outline-none select-none group"
                      aria-expanded={isOpen}
                    >
                      <span
                        className={`text-base sm:text-lg font-bold transition-colors duration-200 ${
                          isOpen
                            ? "text-emerald-900"
                            : "text-slate-900 group-hover:text-emerald-700"
                        }`}
                      >
                        {faq.q}
                      </span>
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                          isOpen
                            ? "bg-emerald-600 text-white rotate-180 shadow-md shadow-emerald-600/20"
                            : "bg-slate-100 text-slate-500 group-hover:bg-slate-200 rotate-0"
                        }`}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </button>

                    <div
                      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                        isOpen
                          ? "grid-rows-[1fr] opacity-100"
                          : "grid-rows-[0fr] opacity-0"
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="px-6 pb-5 pt-2 text-sm sm:text-base text-slate-600 leading-relaxed border-t border-slate-100/90">
                          {faq.a}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── BOTTOM CTA ────────────────────────────────────────────────── */}
        <section
          className="py-12 sm:py-20 bg-slate-50/50"
          aria-label="Call to action"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-emerald-950 via-slate-900 to-emerald-900 border border-emerald-500/25 shadow-2xl shadow-emerald-950/20 text-white text-center p-10 sm:p-16">
              <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] opacity-15 [background-size:20px_20px]" />
              <div className="relative max-w-3xl mx-auto">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-6 border border-emerald-500/30">
                  <Sparkles className="w-3.5 h-3.5" /> Start in 30 seconds
                </div>
                <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-5 leading-tight">
                  Ready to Supercharge Your Invoicing Workflow?
                </h2>
                <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto mb-9 leading-relaxed font-normal">
                  Join 1,200+ freelancers, agencies, and businesses saving 5+
                  hours every single week with InvoicePilot — the AI invoice
                  generator built for speed and GST compliance.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Link href="/register" className="w-full sm:w-auto">
                    <button
                      id="cta-bottom-primary"
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 text-base font-bold text-slate-950 bg-white hover:bg-emerald-50 rounded-2xl shadow-xl shadow-white/10 hover:scale-105 active:scale-100 transition-all cursor-pointer"
                    >
                      Create Free Invoice Now
                      <ArrowRight className="w-5 h-5 text-emerald-600" />
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </>
  );
}
