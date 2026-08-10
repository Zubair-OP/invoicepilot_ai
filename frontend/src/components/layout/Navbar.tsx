"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, X, FileText, ArrowRight, Sparkles } from "lucide-react";
import { UserButton, useAuth } from "@clerk/nextjs";
import Button from "@/components/ui/Button";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { isSignedIn } = useAuth();

  useEffect(() => {
    const handleScrollState = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScrollState, { passive: true });
    return () => window.removeEventListener("scroll", handleScrollState);
  }, []);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    setMobileOpen(false);
    if (pathname === "/") {
      e.preventDefault();
      const element = document.getElementById(targetId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
        window.history.pushState(null, "", `#${targetId}`);
        // Dispatch custom event for conscious highlight/show
        window.dispatchEvent(new CustomEvent("navToSection", { detail: { targetId } }));
      }
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-transparent transition-all duration-300 pointer-events-none">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-3 sm:pt-4">
        {/* Floating Frosted Glass Pill Bar */}
        <div
          className={`pointer-events-auto rounded-2xl sm:rounded-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between border ${
            scrolled
              ? "bg-white/80 backdrop-blur-2xl border-slate-200/80 shadow-lg shadow-slate-900/5"
              : "bg-white/60 backdrop-blur-xl border-white/60 shadow-sm shadow-slate-900/5"
          }`}
        >
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-tr from-emerald-600 to-green-500 rounded-xl sm:rounded-full flex items-center justify-center shadow-md shadow-emerald-600/20 group-hover:scale-105 transition-transform duration-200">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <span className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
              Invoice<span className="text-emerald-600">Pilot</span>
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full">
              <Sparkles className="w-2.5 h-2.5" /> AI
            </span>
          </Link>

          {/* Desktop Navigation Center Silver Frosted Pill */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-200/60 backdrop-blur-md p-1 rounded-full border border-slate-300/50 shadow-inner">
            <a
              href="/#features"
              onClick={(e) => handleNavClick(e, "features")}
              className="px-4 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-950 hover:bg-white rounded-full transition-all duration-200 active:scale-95 shadow-2xs hover:shadow-xs"
            >
              Features
            </a>
            <a
              href="/#how-it-works"
              onClick={(e) => handleNavClick(e, "how-it-works")}
              className="px-4 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-950 hover:bg-white rounded-full transition-all duration-200 active:scale-95 shadow-2xs hover:shadow-xs"
            >
              How It Works
            </a>
            <a
              href="/#pricing"
              onClick={(e) => handleNavClick(e, "pricing")}
              className="px-4 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-950 hover:bg-white rounded-full transition-all duration-200 active:scale-95 shadow-2xs hover:shadow-xs"
            >
              Pricing
            </a>
            <a
              href="/#faq"
              onClick={(e) => handleNavClick(e, "faq")}
              className="px-4 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-950 hover:bg-white rounded-full transition-all duration-200 active:scale-95 shadow-2xs hover:shadow-xs"
            >
              FAQ
            </a>
          </nav>

          {/* Action Buttons */}
          <div className="hidden md:flex items-center gap-2 sm:gap-3">
            {!isSignedIn ? (
              <>
                <Link href="/login">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-700 font-semibold hover:text-emerald-700 hover:bg-emerald-50/60 rounded-full text-xs sm:text-sm px-3.5"
                  >
                    Log in
                  </Button>
                </Link>
                <Link href="/register">
                  <button className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 rounded-full shadow-md shadow-emerald-600/25 hover:shadow-lg hover:shadow-emerald-600/35 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-200 cursor-pointer">
                    Get Started Free
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/dashboard">
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 font-semibold shadow-xs rounded-full">
                    Dashboard
                  </Button>
                </Link>
                <UserButton afterSignOutUrl="/" />
              </>
            )}
          </div>

          {/* Mobile Hamburger Button with Smooth Icon Rotation */}
          <button
            className="md:hidden p-1.5 rounded-full text-slate-700 hover:bg-slate-100/80 active:scale-90 transition-all duration-200 cursor-pointer"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            <div className={`transition-transform duration-200 ${mobileOpen ? "rotate-90 scale-105" : "rotate-0"}`}>
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </div>
          </button>
        </div>

        {/* Fast Liquid Animated Mobile Dropdown Card */}
        <div
          className={`pointer-events-auto md:hidden grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] mt-2 ${
            mobileOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"
          }`}
        >
          <div className="overflow-hidden bg-white/90 backdrop-blur-2xl border border-slate-200/80 shadow-2xl rounded-2xl">
            <div className="px-5 py-4 space-y-2">
              <a
                href="/#features"
                className="flex items-center justify-between px-3.5 py-2 text-sm font-semibold text-slate-700 hover:text-emerald-600 hover:bg-emerald-50/70 rounded-xl transition-all duration-150 active:scale-[0.98]"
                onClick={(e) => handleNavClick(e, "features")}
              >
                Features
                <ArrowRight className="w-3.5 h-3.5 opacity-40" />
              </a>
              <a
                href="/#how-it-works"
                className="flex items-center justify-between px-3.5 py-2 text-sm font-semibold text-slate-700 hover:text-emerald-600 hover:bg-emerald-50/70 rounded-xl transition-all duration-150 active:scale-[0.98]"
                onClick={(e) => handleNavClick(e, "how-it-works")}
              >
                How It Works
                <ArrowRight className="w-3.5 h-3.5 opacity-40" />
              </a>
              <a
                href="/#pricing"
                className="flex items-center justify-between px-3.5 py-2 text-sm font-semibold text-slate-700 hover:text-emerald-600 hover:bg-emerald-50/70 rounded-xl transition-all duration-150 active:scale-[0.98]"
                onClick={(e) => handleNavClick(e, "pricing")}
              >
                Pricing
                <ArrowRight className="w-3.5 h-3.5 opacity-40" />
              </a>
              <a
                href="/#faq"
                className="flex items-center justify-between px-3.5 py-2 text-sm font-semibold text-slate-700 hover:text-emerald-600 hover:bg-emerald-50/70 rounded-xl transition-all duration-150 active:scale-[0.98]"
                onClick={(e) => handleNavClick(e, "faq")}
              >
                FAQ
                <ArrowRight className="w-3.5 h-3.5 opacity-40" />
              </a>

              <div className="pt-3 border-t border-slate-100 space-y-2">
                {!isSignedIn ? (
                  <>
                    <Link href="/login" onClick={() => setMobileOpen(false)} className="block w-full">
                      <Button variant="outline" size="md" className="w-full font-semibold rounded-xl">
                        Log in
                      </Button>
                    </Link>
                    <Link href="/register" onClick={() => setMobileOpen(false)} className="block w-full">
                      <button className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-green-600 rounded-xl shadow-md shadow-emerald-600/20 active:scale-95 transition-all">
                        Get Started Free
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </Link>
                  </>
                ) : (
                  <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="block w-full">
                    <Button size="md" className="w-full bg-emerald-600 hover:bg-emerald-700 font-bold rounded-xl">
                      Go to Dashboard
                    </Button>
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
