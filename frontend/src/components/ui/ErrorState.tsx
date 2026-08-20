"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export default function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this right now. Please try again.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className || ""}`}
    >
      <div className="w-16 h-16 bg-rose-50 border border-rose-100 rounded-full flex items-center justify-center mb-4">
        <AlertTriangle className="w-8 h-8 text-rose-500" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 mb-5 max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
        >
          <RotateCcw className="w-4 h-4" aria-hidden="true" />
          Try Again
        </button>
      )}
    </div>
  );
}