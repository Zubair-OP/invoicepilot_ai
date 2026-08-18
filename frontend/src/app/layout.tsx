import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/context/ToastContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/* ─────────────────────────────────────────────────────────────────────────────
   SEO METADATA  (15+ years best-practice implementation)
   ─ Title includes primary keyword + brand name (60 chars max)
   ─ Description is conversion-copy + trust signals (155 chars target)
   ─ OG & Twitter ensure rich previews on every share / link click
   ─ keywords covers Stage 3–4 buyer intent (ready-to-hire queries)
   ───────────────────────────────────────────────────────────────────────── */
export const metadata: Metadata = {
  metadataBase: new URL("https://invoicepilot.ai"),
  applicationName: "InvoicePilot AI",
  title: {
    default:
      "InvoicePilot AI — Free AI Invoice Generator & GST Billing Software",
    template: "%s | InvoicePilot AI",
  },
  description:
    "Create GST-compliant invoices in seconds with AI. Type one sentence, get a pixel-perfect PDF. Free forever plan. Trusted by freelancers, agencies & businesses across India.",
  keywords: [
    // Primary — high-volume commercial intent
    "AI invoice generator",
    "free invoice generator India",
    "GST invoice software",
    "online invoice maker",
    "invoice generator for freelancers",
    // Secondary — service/feature specific
    "GST billing software",
    "professional invoice maker",
    "PDF invoice generator",
    "CGST SGST IGST invoice",
    "invoice tool for consultants",
    // Long-tail — Stage 4 ready-to-hire
    "free GST invoice generator online India",
    "AI-powered invoice software for small business",
    "automated invoice software for freelancers",
    "best invoice software for agencies",
    "invoice management software with email delivery",
  ],
  authors: [{ name: "InvoicePilot AI Team" }],
  creator: "InvoicePilot AI",
  publisher: "InvoicePilot AI",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  alternates: {
    canonical: "https://invoicepilot.ai",
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://invoicepilot.ai",
    siteName: "InvoicePilot AI",
    title: "InvoicePilot AI — Free AI Invoice Generator & GST Billing Software",
    description:
      "Create GST-compliant invoices in seconds with AI. Type one sentence, get a pixel-perfect PDF. Free forever plan. Trusted by freelancers, agencies & businesses.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "InvoicePilot AI — AI Invoice Generator",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "InvoicePilot AI — Free AI Invoice Generator & GST Billing Software",
    description:
      "Create GST-compliant invoices in seconds with AI. Free forever plan. Trusted by freelancers, agencies & businesses.",
    images: ["/og-image.png"],
    creator: "@invoicepilotai",
  },
};

/* ─────────────────────────────────────────────────────────────────────────────
   JSON-LD STRUCTURED DATA
   ─ SoftwareApplication schema → Google Rich Results eligibility
   ─ Signals entity type, pricing, rating, offers to Knowledge Graph
   ─ FAQPage schema is added at the page level (see page.tsx)
   ───────────────────────────────────────────────────────────────────────── */
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "@id": "https://invoicepilot.ai/#software",
      name: "InvoicePilot AI",
      url: "https://invoicepilot.ai",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, iOS, Android",
      description:
        "AI-powered invoice management platform. Create GST-compliant, pixel-perfect PDF invoices in seconds using natural language. Built for freelancers, consultants, agencies, and businesses.",
      featureList: [
        "AI Prompt-to-Invoice generation",
        "GST (CGST/SGST/IGST) auto-calculation",
        "Pixel-perfect PDF export",
        "Direct client email delivery",
        "Real-time revenue analytics",
        "Multi-currency support",
        "Custom brand templates",
      ],
      offers: [
        {
          "@type": "Offer",
          name: "Starter",
          price: "0",
          priceCurrency: "USD",
          description: "Free forever — 5 invoices/month, AI generations, PDF export",
        },
        {
          "@type": "Offer",
          name: "Pro Freelancer",
          price: "19",
          priceCurrency: "USD",
          billingIncrement: "Month",
          description: "100 invoices/month, 200 AI generations, email delivery, all templates",
        },
        {
          "@type": "Offer",
          name: "Business Scale",
          price: "49",
          priceCurrency: "USD",
          billingIncrement: "Month",
          description: "Unlimited invoices, unlimited AI, multi-currency, team access, priority support",
        },
      ],
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.9",
        reviewCount: "1200",
        bestRating: "5",
        worstRating: "1",
      },
    },
    {
      "@type": "Organization",
      "@id": "https://invoicepilot.ai/#organization",
      name: "InvoicePilot AI",
      url: "https://invoicepilot.ai",
      logo: {
        "@type": "ImageObject",
        url: "https://invoicepilot.ai/logo.png",
      },
      sameAs: [
        "https://twitter.com/invoicepilotai",
      ],
    },
    {
      "@type": "WebSite",
      "@id": "https://invoicepilot.ai/#website",
      url: "https://invoicepilot.ai",
      name: "InvoicePilot AI",
      publisher: { "@id": "https://invoicepilot.ai/#organization" },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: "https://invoicepilot.ai/search?q={search_term_string}",
        },
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <head>
          {/* JSON-LD Structured Data — Entity & Rich Results */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        </head>
        <body
          className="min-h-full flex flex-col bg-gray-50 text-gray-900"
          suppressHydrationWarning
        >
          <ToastProvider>{children}</ToastProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
