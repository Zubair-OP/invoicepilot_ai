"use client";

import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { FileText, Zap, Shield, BarChart3, CheckCircle } from "lucide-react";

const features = [
  { icon: Zap, text: "AI-powered invoice generation in seconds" },
  { icon: Shield, text: "GST-compliant & legally sound documents" },
  { icon: BarChart3, text: "Real-time payment tracking & analytics" },
  { icon: CheckCircle, text: "Trusted by 10,000+ freelancers & businesses" },
];

export default function LoginPage() {
  return (
    <div className="auth-root">
      {/* ── Left brand panel ─────────────────────────────── */}
      <div className="auth-brand-panel">
        <div className="auth-brand-inner">
          <Link href="/" className="auth-logo">
            <div className="auth-logo-icon">
              <FileText size={22} color="#fff" />
            </div>
            <span className="auth-logo-text">
              Invoice<span className="auth-logo-accent">Pilot</span>
            </span>
          </Link>

          <div className="auth-brand-copy">
            <h1 className="auth-brand-headline">
              Professional invoicing,<br />powered by AI.
            </h1>
            <p className="auth-brand-sub">
              Create beautiful, GST-compliant invoices in seconds and get paid
              faster — all from one smart dashboard.
            </p>
          </div>

          <ul className="auth-features">
            {features.map(({ icon: Icon, text }) => (
              <li key={text} className="auth-feature-item">
                <span className="auth-feature-icon-wrap">
                  <Icon size={15} color="#4ade80" />
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ul>

          <div className="auth-blob auth-blob-1" />
          <div className="auth-blob auth-blob-2" />
        </div>
      </div>

      {/* ── Right form panel ─────────────────────────────── */}
      <div className="auth-form-panel">
        <Link href="/" className="auth-logo auth-logo-mobile">
          <div className="auth-logo-icon auth-logo-icon-dark">
            <FileText size={20} color="#fff" />
          </div>
          <span className="auth-logo-text auth-logo-text-dark">
            Invoice<span className="auth-logo-accent-dark">Pilot</span>
          </span>
        </Link>

        <div className="auth-form-container">
          <SignIn
            routing="hash"
            signUpUrl="/register"
            fallbackRedirectUrl="/dashboard"
            appearance={{
              variables: {
                colorPrimary: "#16a34a",
                colorBackground: "#ffffff",
                colorNeutral: "#111827",
                colorInput: "#111827",
                borderRadius: "8px",
                fontFamily: "inherit",
                fontSize: "13.5px",
                spacing: "10px",
              },
              elements: {
                rootBox: "auth-clerk-root",
                card: "auth-clerk-card",
                header: "auth-clerk-header",
                headerTitle: "auth-clerk-header-title",
                headerSubtitle: "auth-clerk-header-subtitle",
                socialButtons: "auth-clerk-social-btns",
                socialButtonsBlockButton: "auth-clerk-social-btn",
                socialButtonsBlockButtonText: "auth-clerk-social-btn-text",
                dividerRow: "auth-clerk-divider-row",
                dividerLine: "auth-clerk-divider-line",
                dividerText: "auth-clerk-divider-text",
                form: "auth-clerk-form",
                formFieldRow: "auth-clerk-field-row",
                formFieldLabel: "auth-clerk-label",
                formFieldInput: "auth-clerk-input",
                formButtonPrimary: "auth-clerk-submit-btn",
                footer: "auth-clerk-footer",
                footerAction: "auth-clerk-footer-action",
                footerActionLink: "auth-clerk-footer-link",
                footerActionText: "auth-clerk-footer-text",
                formFieldInputShowPasswordButton: "auth-clerk-pw-toggle",
              },
            }}
          />
        </div>
      </div>

      <style>{`
        .auth-root {
          height: 100vh;
          max-height: 100vh;
          overflow: hidden;
          display: flex;
          background: #f8fafc;
        }

        /* Brand panel */
        .auth-brand-panel {
          display: none;
          position: relative;
          overflow: hidden;
          background: linear-gradient(145deg, #064e3b 0%, #065f46 35%, #047857 65%, #16a34a 100%);
          flex: 1;
          height: 100%;
        }
        @media (min-width: 1024px) {
          .auth-brand-panel { 
            display: flex; 
            align-items: center; 
          }
        }

        .auth-brand-inner {
          position: relative;
          z-index: 2;
          padding: clamp(20px, 3.5vh, 40px) clamp(24px, 3.5vw, 48px);
          display: flex;
          flex-direction: column;
          gap: clamp(16px, 2.5vh, 28px);
          width: 100%;
        }

        .auth-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
        }
        .auth-logo-icon {
          width: 38px; height: 38px;
          background: rgba(255,255,255,0.15);
          border: 1.5px solid rgba(255,255,255,0.25);
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          backdrop-filter: blur(8px);
        }
        .auth-logo-icon-dark {
          background: #16a34a;
          border: none;
        }
        .auth-logo-text {
          font-size: 21px; font-weight: 800;
          color: #ffffff; letter-spacing: -0.5px;
        }
        .auth-logo-text-dark { color: #111827; }
        .auth-logo-accent { color: #86efac; }
        .auth-logo-accent-dark { color: #16a34a; }

        .auth-brand-copy { display: flex; flex-direction: column; gap: 8px; }
        .auth-brand-headline {
          font-size: clamp(22px, 2.3vw, 32px);
          font-weight: 800; line-height: 1.2;
          color: #ffffff; letter-spacing: -0.6px; margin: 0;
        }
        .auth-brand-sub {
          font-size: 14px; line-height: 1.55;
          color: rgba(255,255,255,0.78); margin: 0; max-width: 380px;
        }

        .auth-features { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
        .auth-feature-item {
          display: flex; align-items: center; gap: 10px;
          font-size: 13px; color: rgba(255,255,255,0.88); font-weight: 500;
        }
        .auth-feature-icon-wrap {
          width: 26px; height: 26px;
          background: rgba(255,255,255,0.12);
          border-radius: 6px;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }

        .auth-blob {
          position: absolute; border-radius: 50%;
          filter: blur(80px); opacity: 0.18; pointer-events: none;
        }
        .auth-blob-1 { width: 380px; height: 380px; background: #34d399; bottom: -100px; right: -60px; }
        .auth-blob-2 { width: 240px; height: 240px; background: #a7f3d0; top: -40px; left: -40px; }

        /* Form panel */
        .auth-form-panel {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: clamp(12px, 2vh, 24px) clamp(16px, 2vw, 32px);
          width: 100%; height: 100%;
          overflow-y: auto;
        }
        @media (min-width: 1024px) {
          .auth-form-panel {
            width: 460px; flex: 0 0 460px;
            padding: clamp(16px, 2.5vh, 28px) clamp(24px, 3vw, 40px);
          }
        }

        .auth-logo-mobile { display: flex; margin-bottom: 12px; }
        @media (min-width: 1024px) { .auth-logo-mobile { display: none; } }

        .auth-form-container { 
          width: 100%; 
          max-width: 380px;
          display: flex;
          justify-content: center;
        }

        /* Clerk overrides */
        .auth-clerk-root { width: 100% !important; }

        .auth-clerk-card {
          width: 100% !important;
          padding: clamp(16px, 2.5vh, 24px) clamp(18px, 2.5vw, 26px) !important;
          border-radius: 14px !important;
          border: 1px solid #e5e7eb !important;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.03), 0 12px 28px -6px rgba(0,0,0,0.06) !important;
          background: #ffffff !important;
          gap: 10px !important;
        }
        @media (max-width: 480px) {
          .auth-clerk-card { 
            padding: 16px 14px !important; 
            border-radius: 12px !important; 
          }
        }

        .auth-clerk-header {
          margin-bottom: 6px !important;
          padding-bottom: 0 !important;
        }

        .auth-clerk-header-title {
          font-size: 19px !important; font-weight: 800 !important;
          color: #111827 !important; letter-spacing: -0.3px !important; line-height: 1.2 !important;
          margin-bottom: 2px !important;
        }
        .auth-clerk-header-subtitle {
          font-size: 13px !important; color: #6b7280 !important;
          margin-top: 2px !important; line-height: 1.4 !important;
        }

        .auth-clerk-social-btns {
          margin-bottom: 6px !important;
        }

        .auth-clerk-social-btn {
          border: 1.5px solid #e5e7eb !important;
          border-radius: 8px !important;
          padding: 7px 14px !important;
          font-weight: 600 !important; font-size: 13px !important;
          background: #ffffff !important;
          transition: all 0.18s ease !important; 
          height: 38px !important;
        }
        .auth-clerk-social-btn:hover {
          border-color: #d1d5db !important; background: #f9fafb !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 3px 10px rgba(0,0,0,0.06) !important;
        }
        .auth-clerk-social-btn-text {
          font-size: 13px !important; font-weight: 600 !important; color: #374151 !important;
        }

        .auth-clerk-divider-row {
          margin: 6px 0 !important;
        }
        .auth-clerk-divider-line { background: #e5e7eb !important; }
        .auth-clerk-divider-text {
          font-size: 11.5px !important; color: #9ca3af !important; font-weight: 500 !important;
        }

        .auth-clerk-form {
          gap: 6px !important;
        }
        .auth-clerk-field-row {
          margin-bottom: 6px !important;
        }

        .auth-clerk-label {
          font-size: 12.5px !important; font-weight: 600 !important;
          color: #374151 !important; margin-bottom: 3px !important;
        }

        .auth-clerk-input {
          height: 38px !important;
          border-radius: 8px !important;
          border: 1.5px solid #e5e7eb !important;
          padding: 0 12px !important;
          font-size: 13.5px !important;
          color: #111827 !important; background: #f9fafb !important;
          transition: all 0.18s ease !important;
          outline: none !important; box-shadow: none !important;
        }
        .auth-clerk-input:focus {
          border-color: #16a34a !important; background: #ffffff !important;
          box-shadow: 0 0 0 3px rgba(22,163,74,0.1) !important;
        }

        .auth-clerk-submit-btn {
          height: 38px !important;
          border-radius: 8px !important;
          font-size: 13.5px !important; font-weight: 700 !important;
          background: linear-gradient(135deg, #16a34a 0%, #15803d 100%) !important;
          border: none !important; color: #ffffff !important;
          letter-spacing: 0.2px !important;
          margin-top: 4px !important;
          transition: all 0.2s ease !important;
          box-shadow: 0 3px 12px rgba(22,163,74,0.3) !important;
        }
        .auth-clerk-submit-btn:hover {
          transform: translateY(-1px) !important;
          box-shadow: 0 5px 16px rgba(22,163,74,0.4) !important;
          background: linear-gradient(135deg, #15803d 0%, #166534 100%) !important;
        }

        .auth-clerk-footer {
          margin-top: 4px !important; 
          padding-top: 8px !important;
          border: none !important;
        }
        .auth-clerk-footer-action {
          margin: 0 !important;
          padding: 0 !important;
        }
        .auth-clerk-footer-text { font-size: 12.5px !important; color: #6b7280 !important; }
        .auth-clerk-footer-link {
          font-size: 12.5px !important; font-weight: 700 !important;
          color: #16a34a !important; text-decoration: none !important;
        }
        .auth-clerk-footer-link:hover {
          color: #15803d !important; text-decoration: underline !important;
        }
        .auth-clerk-pw-toggle { color: #9ca3af !important; }

        @media (max-width: 1023px) {
          .auth-root {
            height: auto;
            min-height: 100vh;
            overflow: auto;
          }
          .auth-form-panel {
            height: auto;
            min-height: 100vh;
            padding: 20px 16px;
            justify-content: flex-start;
          }
        }
      `}</style>
    </div>
  );
}
