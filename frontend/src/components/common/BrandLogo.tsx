"use client";

import React from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";

export interface BrandLogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  showBadge?: boolean;
  theme?: "light" | "dark" | "auto";
  href?: string;
  className?: string;
  onClick?: () => void;
}

/**
 * World-Class Brand Icon for InvoicePilot AI
 * A supersonic pilot jet/origami wing fused with modern invoice geometry and an AI sparkle glow.
 */
export function BrandIcon({
  size = "md",
  className = "",
}: {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizeMap = {
    xs: "w-6 h-6",
    sm: "w-8 h-8",
    md: "w-9 h-9",
    lg: "w-11 h-11",
    xl: "w-14 h-14",
  };

  return (
    <div
      className={`relative flex items-center justify-center shrink-0 rounded-xl overflow-hidden transition-all duration-300 shadow-md shadow-emerald-950/10 group-hover:scale-105 group-hover:shadow-lg group-hover:shadow-emerald-500/25 ${sizeMap[size]} ${className}`}
    >
      <svg
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full transform transition-transform duration-300"
      >
        <defs>
          {/* Main Background Gradient */}
          <linearGradient
            id="ip-bg-grad"
            x1="4"
            y1="4"
            x2="44"
            y2="44"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#059669" />
            <stop offset="50%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#0D9488" />
          </linearGradient>

          {/* Wing Accent Gradient */}
          <linearGradient
            id="ip-wing-grad"
            x1="12"
            y1="10"
            x2="38"
            y2="36"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#E6FFFA" />
          </linearGradient>

          {/* Glow Shadow Filter */}
          <filter id="ip-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow
              dx="0"
              dy="2"
              stdDeviation="2"
              floodColor="#064E3B"
              floodOpacity="0.35"
            />
          </filter>
        </defs>

        {/* Base Squircle Container */}
        <rect
          width="48"
          height="48"
          rx="13"
          fill="url(#ip-bg-grad)"
        />

        {/* Subtle Inner Border Shine */}
        <rect
          x="0.75"
          y="0.75"
          width="46.5"
          height="46.5"
          rx="12.25"
          stroke="white"
          strokeOpacity="0.25"
          strokeWidth="1.5"
        />

        {/* Background Invoice Lines (Subtle Vector Grid) */}
        <path
          d="M12 33H22M12 37H18"
          stroke="white"
          strokeOpacity="0.4"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* The Supersonic "Pilot Wing" (Main Vector Graphic) */}
        <g filter="url(#ip-glow)">
          {/* Main Top Flight Wing */}
          <path
            d="M37 11L11 23.5L22.5 27.5L37 11Z"
            fill="url(#ip-wing-grad)"
          />
          {/* Underside Wing Fold (Adds 3D Depth) */}
          <path
            d="M22.5 27.5L25.5 35L29 29.5L37 11L22.5 27.5Z"
            fill="#D1FAE5"
          />
          {/* Trailing Jet Edge Line */}
          <path
            d="M22.5 27.5L37 11"
            stroke="#059669"
            strokeWidth="0.8"
            strokeOpacity="0.4"
          />
        </g>

        {/* AI Sparkle Star (Top Right Energy Accent) */}
        <path
          d="M37 8C37 9.5 38.5 11 40 11C38.5 11 37 12.5 37 14C37 12.5 35.5 11 34 11C35.5 11 37 9.5 37 8Z"
          fill="#FEF08A"
        />
      </svg>
    </div>
  );
}

export default function BrandLogo({
  size = "md",
  showText = true,
  showBadge = true,
  theme = "light",
  href = "/",
  className = "",
  onClick,
}: BrandLogoProps) {
  const textSizeMap = {
    xs: "text-base tracking-tight",
    sm: "text-lg tracking-tight",
    md: "text-xl tracking-tight",
    lg: "text-2xl tracking-tight",
    xl: "text-3xl tracking-tight",
  };

  const badgeSizeMap = {
    xs: "text-[9px] px-1.5 py-0.2",
    sm: "text-[10px] px-1.5 py-0.5",
    md: "text-[10px] px-2 py-0.5",
    lg: "text-xs px-2.5 py-0.5",
    xl: "text-sm px-3 py-1",
  };

  const isDark = theme === "dark";

  const content = (
    <div
      className={`inline-flex items-center gap-2.5 group cursor-pointer select-none ${className}`}
      onClick={onClick}
    >
      <BrandIcon size={size} />

      {showText && (
        <div className="flex items-center gap-1.5">
          <span
            className={`font-black ${
              isDark ? "text-white" : "text-slate-900"
            } ${textSizeMap[size]}`}
          >
            Invoice
            <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
              Pilot
            </span>
          </span>

          {showBadge && (
            <span
              className={`inline-flex items-center gap-1 font-bold rounded-full border shadow-2xs ${
                isDark
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200/80"
              } ${badgeSizeMap[size]}`}
            >
              <Sparkles className="w-2.5 h-2.5 text-emerald-500 animate-pulse" />
              AI
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} aria-label="InvoicePilot AI Home">
        {content}
      </Link>
    );
  }

  return content;
}
