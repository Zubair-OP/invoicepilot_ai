"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import Button from "@/components/ui/Button";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto text-red-400">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
          <p className="text-slate-400 text-sm">
            An unexpected error occurred. Please try again or return to your dashboard.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            variant="primary"
            size="md"
            onClick={() => reset()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25"
          >
            <RotateCcw className="w-4 h-4" /> Try Again
          </Button>
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button
              variant="outline"
              size="md"
              className="w-full sm:w-auto flex items-center justify-center gap-2 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <Home className="w-4 h-4" /> Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
