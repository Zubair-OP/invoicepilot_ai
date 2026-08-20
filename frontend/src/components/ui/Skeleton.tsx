"use client";

import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

/**
 * Base skeleton block with an animated shimmer. Matches surrounding border
 * radius and spacing via the className passed by callers.
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative overflow-hidden bg-slate-200/60",
        className
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-skeleton-shimmer" />
    </div>
  );
}