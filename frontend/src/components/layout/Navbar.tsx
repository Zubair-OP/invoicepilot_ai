"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Menu,
  X,
  ArrowRight,
  LayoutDashboard,
  Layers,
  HelpCircle,
  CreditCard,
  ChevronRight,
  Zap,
} from "lucide-react";
import { UserButton, useAuth } from "@clerk/nextjs";
import BrandLogo from "@/components/common/BrandLogo";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const pathname = usePathname();
  const { isSignedIn } = useAuth();

  useEffect(() => {
    const handleScrollState = () => {
      setScrolled(window.scrollY > 20);

      // Simple active section detection on landing page
      if (pathname === "/") {
        const sections = ["features", "how-it-works", "pricing", "faq"];
        const scrollPosition = window.scrollY + 120;

        for (const sectionId of sections) {
          const el = document.getElementById(sectionId);
          if (el) {
            const top = el.offsetTop;
            const height = el.offsetHeight;
            if (scrollPosition >= top && scrollPosition < top + height) {
              setActiveSection(sectionId);
              break;
            }
          }
        }
      }
    };

    window.addEventListener("scroll", handleScrollState, { passive: true });
    return () => window.removeEventListener("scroll", handleScrollState);
  }, [pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    targetId: string
  ) => {
    setMobileOpen(false);
    if (pathname === "/") {
      e.preventDefault();
      const element = document.getElementById(targetId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
        window.history.pushState(null, "", `#${targetId}`);
        setActiveSection(targetId);
        window.dispatchEvent(
          new CustomEvent("navToSection", { detail: { targetId } })
        );
      }
    }
  };

  const navLinks = [
    { label: "Features", href: "/#features", id: "features", icon: Layers },
    {
      label: "How It Works",
      href: "/#how-it-works",
      id: "how-it-works",
      icon: Zap,
    },
    {
      label: "Pricing",
      href: "/#pricing",
      id: "pricing",
      icon: CreditCard,
    },
    { label: "FAQ", href: "/#faq", id: "faq", icon: HelpCircle },
  ];

  return (
    <header className="sticky top-0 z-50 transition-all duration-300 pointer-events-none">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-3 sm:pt-4">
        {/* Main Floating Glass Capsule */}
        <div
          className={`pointer-events-auto rounded-2xl sm:rounded-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between border ${
            scrolled
              ? "bg-white/85 backdrop-blur-2xl border-slate-200/90 shadow-[0_12px_40px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/5"
              : "bg-white/70 backdrop-blur-xl border-white/80 shadow-[0_8px_30px_rgba(15,23,42,0.04)]"
          }`}
        >
          {/* Brand Identity & Logo */}
          <div className="flex items-center">
            <BrandLogo size="sm" showBadge={true} href="/" />
          </div>

          {/* Desktop Center Segment Navigation */}
          <nav
            className="hidden md:flex items-center gap-1 bg-slate-100/80 backdrop-blur-md px-1.5 py-1 rounded-full border border-slate-200/60 shadow-inner"
            aria-label="Main Navigation"
          >
            {navLinks.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <a
                  key={item.id}
                  href={item.href}
                  onClick={(e) => handleNavClick(e, item.id)}
                  className={`relative px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-full transition-all duration-200 cursor-pointer select-none ${
                    isActive
                      ? "text-emerald-700 bg-white shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-950 hover:bg-white/80"
                  }`}
                >
                  {item.label}
                  {item.id === "features" && (
                    <span className="ml-1.5 inline-flex items-center px-1.5 py-0.2 text-[9px] font-extrabold uppercase tracking-wide bg-emerald-100 text-emerald-800 rounded-full">
                      AI
                    </span>
                  )}
                </a>
              );
            })}
          </nav>

          {/* Desktop Right Actions */}
          <div className="hidden md:flex items-center gap-2.5">
            {!isSignedIn ? (
              <>
                <Link
                  href="/login"
                  className="px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 hover:text-emerald-700 hover:bg-emerald-50/80 rounded-full transition-all duration-150"
                >
                  Log in
                </Link>

                <Link
                  href="/register"
                  className="group relative inline-flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-full shadow-md shadow-emerald-600/25 hover:shadow-lg hover:shadow-emerald-600/35 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-200 cursor-pointer overflow-hidden"
                >
                  {/* Subtle Shimmer highlight */}
                  <span className="absolute inset-0 w-1/2 h-full bg-white/20 skew-x-12 -translate-x-full group-hover:translate-x-[300%] transition-transform duration-700 ease-out pointer-events-none" />

                  <span>Get Started Free</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-bold text-emerald-950 bg-emerald-100/90 hover:bg-emerald-200/90 border border-emerald-300/60 rounded-full shadow-xs hover:shadow-sm transition-all duration-150"
                >
                  <LayoutDashboard className="w-3.5 h-3.5 text-emerald-700" />
                  Dashboard
                </Link>
                <div className="pl-1 border-l border-slate-200">
                  <UserButton />
                </div>
              </div>
            )}
          </div>

          {/* Mobile Hamburger Toggle Button */}
          <div className="flex items-center gap-2 md:hidden">
            {isSignedIn && <UserButton />}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 rounded-xl text-slate-700 bg-slate-100/80 hover:bg-slate-200/80 active:scale-95 transition-all duration-150 cursor-pointer"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              <div
                className={`transition-transform duration-200 ${
                  mobileOpen ? "rotate-90 scale-105" : "rotate-0"
                }`}
              >
                {mobileOpen ? (
                  <X className="w-5 h-5 text-slate-900" />
                ) : (
                  <Menu className="w-5 h-5 text-slate-700" />
                )}
              </div>
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu Card */}
        <div
          className={`pointer-events-auto md:hidden grid transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] mt-2 ${
            mobileOpen
              ? "grid-rows-[1fr] opacity-100 translate-y-0"
              : "grid-rows-[0fr] opacity-0 -translate-y-2 pointer-events-none"
          }`}
        >
          <div className="overflow-hidden bg-white/95 backdrop-blur-2xl border border-slate-200/90 shadow-2xl rounded-2xl">
            <div className="p-4 space-y-1.5">
              {navLinks.map((item) => {
                const IconComponent = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <a
                    key={item.id}
                    href={item.href}
                    onClick={(e) => handleNavClick(e, item.id)}
                    className={`flex items-center justify-between px-3.5 py-2.5 text-sm font-semibold rounded-xl transition-all duration-150 active:scale-[0.98] ${
                      isActive
                        ? "bg-emerald-50 text-emerald-800 font-bold"
                        : "text-slate-700 hover:text-emerald-700 hover:bg-slate-100/80"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                          isActive
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <span>{item.label}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </a>
                );
              })}

              {/* Mobile CTA Area */}
              <div className="pt-3.5 mt-2 border-t border-slate-100 space-y-2">
                {!isSignedIn ? (
                  <>
                    <Link
                      href="/login"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center justify-center w-full px-4 py-2.5 text-sm font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                    >
                      Log in
                    </Link>

                    <Link
                      href="/register"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
                    >
                      <span>Get Started Free</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </>
                ) : (
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    Go to Dashboard
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
