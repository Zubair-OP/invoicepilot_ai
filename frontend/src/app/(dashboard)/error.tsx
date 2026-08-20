"use client";

import { useEffect } from "react";
import ErrorState from "@/components/ui/ErrorState";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log in dev only; never surface stack traces to users.
    if (process.env.NODE_ENV === "development") {
      console.error("Dashboard error:", error);
    }
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <ErrorState
        title="We couldn't load this page"
        description="Something went wrong on our end. Your data is safe — please try again."
        onRetry={reset}
      />
    </div>
  );
}