"use client";

import React, { useId, useState } from "react";
import { HelpCircle } from "lucide-react";

interface InfoTooltipProps {
  text: string;
  label?: string;
  className?: string;
}

export function InfoTooltip({
  text,
  label = "Más información",
  className = "",
}: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  return (
    <span
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? tooltipId : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-zinc-400 transition hover:text-kipu-gold focus:outline-none focus:ring-2 focus:ring-kipu-gold/60"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>

      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-2 w-60 -translate-x-1/2 rounded-lg border border-kipu-border bg-zinc-900 px-3 py-2 text-left text-xs font-normal leading-relaxed text-zinc-200 shadow-xl"
        >
          {text}
        </span>
      )}
    </span>
  );
}

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded bg-zinc-800/80 ${className}`}
    />
  );
}
