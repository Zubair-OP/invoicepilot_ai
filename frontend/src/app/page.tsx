"use client";

import Link from "next/link";
import { ArrowRight, FileText, Zap, Shield, Clock, Users, BarChart3, Send, Download, Sparkles } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Button from "@/components/ui/Button";

const features = [
  {
    icon: <Sparkles className="w-6 h-6" />,
    title: "AI-Powered Creation",
    description: "Describe your invoice in plain English and AI fills every field instantly.",
  },
  {
    icon: <FileText className="w-6 h-6" />,
    title: "Professional Templates",
    description: "Choose from multiple invoice templates including classic, modern, and minimal designs.",
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: "GST Compliant",
    description: "Automatic CGST/SGST/IGST calculations with HSN/SAC codes for compliant invoices.",
  },
  {
    icon: <Download className="w-6 h-6" />,
    title: "PDF Export",
    description: "Download pixel-perfect PDFs matching your live preview, ready to share.",
  },
  {
    icon: <Send className="w-6 h-6" />,
    title: "Send Invoices",
    description: "Send invoices directly to clients via email with PDF attachments.",
  },
  {
    icon: <BarChart3 className="w-6 h-6" />,
    title: "Dashboard Analytics",
    description: "Track revenue, overdue payments, and client activity in real-time.",
  },
];

const steps = [
  { step: "1", title: "Create", description: "Build invoices with AI or manually" },
  { step: "2", title: "Customize", description: "Choose templates and adjust details" },
  { step: "3", title: "Send", description: "Email directly to your clients" },
  { step: "4", title: "Track", description: "Monitor payments and follow up" },
];

const plans = [
  {
    name: "Free",
    price: "$0",
    description: "Perfect for getting started",
    features: ["5 invoices/month", "10 customers", "10 AI generations", "1 template"],
    cta: "Get Started",
    popular: false,
  },
  {
    name: "Pro",
    price: "$19",
    period: "/mo",
    description: "For growing businesses",
    features: ["100 invoices/month", "Unlimited customers", "200 AI generations", "All templates"],
    cta: "Start Pro",
    popular: true,
  },
  {
    name: "Premium",
    price: "$49",
    period: "/mo",
    description: "For established businesses",
    features: ["Unlimited invoices", "Unlimited customers", "Unlimited AI", "All templates"],
    cta: "Start Premium",
    popular: false,
  },
];

const faqs = [
  {
    q: "What is Invoice Pilot?",
    a: "Invoice Pilot is a professional invoice management platform that helps freelancers and businesses create, customize, send, and track invoices with AI assistance.",
  },
  {
    q: "How does AI invoice creation work?",
    a: "Simply describe your invoice in plain English - for example 'Invoice for Acme Corp for 5 laptops at $45,000 each, 18% GST, due on 30th August' - and AI will extract all the details into form fields automatically.",
  },
  {
    q: "Is my data stored securely?",
    a: "Yes, all data is encrypted and stored securely. We use industry-standard security practices to protect your business information.",
  },
  {
    q: "Can I cancel my plan anytime?",
    a: "Yes, you can cancel your subscription at any time. Your plan will remain active until the end of the billing period.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept all major credit cards through Stripe, our secure payment processor.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Hero */}
      <section className="relative py-20 sm:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-green-50 via-white to-green-50/30" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 text-green-700 text-sm font-medium mb-8">
            <Zap className="w-4 h-4" />
            AI-Powered Invoice Generation
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold text-gray-900 tracking-tight mb-6">
            Create <span className="text-green-600">Professional Invoices</span>
            <br />
            in Under a Minute
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto mb-10">
            Describe your invoice in one sentence. AI fills the form, you review, and download a GST-compliant PDF. Invoice Pilot handles everything from creation to tracking.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto">
                Create Free Invoice
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link href="/#features">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                View Features
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Everything You Need
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Professional invoicing tools, simplified.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <div key={i} className="p-6 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all">
                <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-green-600 mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 sm:py-28 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-lg text-gray-600">
              Four simple steps to professional invoicing
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, i) => (
              <div key={i} className="text-center">
                <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center text-white text-lg font-bold mx-auto mb-4">
                  {step.step}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-gray-600 text-sm">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-gray-600">
              All plans include every feature. Pick based on your volume.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan, i) => (
              <div
                key={i}
                className={`relative p-8 rounded-2xl border-2 ${
                  plan.popular
                    ? "border-green-500 shadow-lg shadow-green-500/10"
                    : "border-gray-200"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-green-600 text-white text-xs font-semibold rounded-full">
                    Most Popular
                  </div>
                )}
                <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                  {plan.period && <span className="text-gray-500">{plan.period}</span>}
                </div>
                <p className="text-sm text-gray-600 mb-6">{plan.description}</p>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-gray-700">
                      <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register">
                  <Button
                    variant={plan.popular ? "primary" : "outline"}
                    className="w-full"
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 sm:py-28 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Frequently Asked Questions
            </h2>
          </div>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <details key={i} className="group bg-white rounded-xl border border-gray-200 overflow-hidden">
                <summary className="px-6 py-4 cursor-pointer font-medium text-gray-900 hover:bg-gray-50 transition-colors flex items-center justify-between">
                  {faq.q}
                  <svg className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform shrink-0 ml-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-6 pb-4 text-gray-600 text-sm leading-relaxed">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-28 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Ready to Simplify Your Invoicing?
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Start creating professional invoices in minutes. No credit card required.
          </p>
          <Link href="/register">
            <Button size="lg">
              Get Started Free
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
