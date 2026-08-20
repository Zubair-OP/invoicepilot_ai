"use client";

import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  loadingText?: string;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", children, loading, loadingText, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        aria-busy={loading || undefined}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
          {
            "bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-500": variant === "primary",
            "bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:ring-gray-500": variant === "secondary",
            "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus-visible:ring-green-500": variant === "outline",
            "text-gray-700 hover:bg-gray-100 focus-visible:ring-gray-500": variant === "ghost",
            "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500": variant === "danger",
          },
          {
            "px-3 py-1.5 text-sm": size === "sm",
            "px-4 py-2 text-sm": size === "md",
            "px-6 py-3 text-base": size === "lg",
          },
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
        {loading && loadingText ? loadingText : children}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
