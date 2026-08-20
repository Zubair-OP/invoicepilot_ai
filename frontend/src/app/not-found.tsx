"use client";

import Link from "next/link";
import { FileQuestion, ArrowLeft, Home, Zap } from "lucide-react";
import Button from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full text-center relative z-10 space-y-6">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-9 h-9 bg-gradient-to-tr from-emerald-600 to-green-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-extrabold text-white tracking-tight">
            Invoice<span className="text-emerald-400">Pilot</span>
          </span>
        </div>

        {/* 404 Icon & Code */}
        <div className="w-20 h-20 bg-slate-800 border border-slate-700/80 rounded-3xl flex items-center justify-center mx-auto shadow-2xl">
          <FileQuestion className="w-10 h-10 text-emerald-400" />
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-extrabold text-white tracking-tight">
            Page Not Found
          </h1>
          <p className="text-slate-400 text-sm max-w-sm mx-auto">
            The page you are looking for doesn&apos;t exist or has been moved. Let&apos;s get you back on track.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button variant="primary" size="md" className="w-full sm:w-auto flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25">
              <Home className="w-4 h-4" /> Go to Dashboard
            </Button>
          </Link>
          <Link href="/" className="w-full sm:w-auto">
            <Button variant="outline" size="md" className="w-full sm:w-auto flex items-center justify-center gap-2 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">
              <ArrowLeft className="w-4 h-4" /> Home Page
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
