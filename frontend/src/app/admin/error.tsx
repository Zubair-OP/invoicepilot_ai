"use client";

import { useEffect } from "react";
import ErrorState from "@/components/ui/ErrorState";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error("Admin error:", error);
    }
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <ErrorState
        title="We couldn't load the admin panel"
        description="Something went wrong while loading this view. Please try again."
        onRetry={reset}
      />
    </div>
  );
}