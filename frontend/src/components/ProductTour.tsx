"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Compass, X } from "lucide-react";
import { PRODUCT_TOUR_STEPS } from "@/lib/ux";

interface ProductTourProps {
  open: boolean;
  neverShowAuto: boolean;
  onToggleNeverShowAuto: (val: boolean) => void;
  onClose: (completed: boolean) => void;
}

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function ProductTour({
  open,
  neverShowAuto,
  onToggleNeverShowAuto,
  onClose,
}: ProductTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<HighlightRect | null>(null);

  const step = PRODUCT_TOUR_STEPS[stepIndex] ?? PRODUCT_TOUR_STEPS[0];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === PRODUCT_TOUR_STEPS.length - 1;

  useEffect(() => {
    if (!open) {
      setStepIndex(0);
      return;
    }

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose(false);
      } else if (e.key === "ArrowRight") {
        setStepIndex((prev) =>
          prev < PRODUCT_TOUR_STEPS.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === "ArrowLeft") {
        setStepIndex((prev) => (prev > 0 ? prev - 1 : prev));
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;

    const updateTarget = () => {
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (!el) {
        setRect(null);
        return;
      }
      const box = el.getBoundingClientRect();
      setRect({
        top: box.top,
        left: box.left,
        width: box.width,
        height: box.height,
      });
    };

    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    const timer = setTimeout(updateTarget, 180);
    window.addEventListener("resize", updateTarget);
    window.addEventListener("scroll", updateTarget, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateTarget);
      window.removeEventListener("scroll", updateTarget, true);
    };
  }, [open, step.target]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Recorrido interactivo: ${step.title}`}
      className="fixed inset-0 z-50 pointer-events-auto"
    >
      <div
        className="fixed inset-0 bg-black/65 transition-opacity"
        onClick={() => onClose(false)}
      />

      {rect && (
        <div
          aria-hidden="true"
          style={{
            top: Math.max(4, rect.top - 4),
            left: Math.max(4, rect.left - 4),
            width: rect.width + 8,
            height: rect.height + 8,
          }}
          className="pointer-events-none fixed z-50 rounded-xl border-2 border-kipu-gold shadow-[0_0_0_9999px_rgba(9,9,11,0.55)] transition-all duration-200"
        />
      )}

      <div className="fixed bottom-4 left-4 right-4 z-[60] mx-auto max-w-md rounded-2xl border border-kipu-gold/60 bg-kipu-card p-5 shadow-2xl sm:left-auto sm:right-6 sm:bottom-6">
        <div className="mb-2 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-kipu-gold/15 px-2.5 py-0.5 text-[11px] font-semibold text-kipu-gold">
            <Compass className="h-3.5 w-3.5" />
            Recorrido guiado · {stepIndex + 1} de {PRODUCT_TOUR_STEPS.length}
          </span>
          <button
            type="button"
            onClick={() => onClose(false)}
            aria-label="Cerrar recorrido"
            className="rounded p-1 text-zinc-400 hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h3 className="text-sm font-bold text-white">{step.title}</h3>
        <p className="mt-1.5 text-xs leading-relaxed text-zinc-200">
          {step.description}
        </p>

        <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={neverShowAuto}
            onChange={(e) => onToggleNeverShowAuto(e.target.checked)}
            className="accent-kipu-gold"
          />
          <span>No volver a mostrar automáticamente</span>
        </label>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-kipu-border pt-3">
          <button
            type="button"
            onClick={() => onClose(false)}
            className="text-xs text-zinc-400 hover:text-zinc-100"
          >
            Saltar tutorial
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isFirst}
              onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-kipu-border bg-kipu-bg px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Anterior
            </button>

            {isLast ? (
              <button
                type="button"
                onClick={() => onClose(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-kipu-emerald px-3.5 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-emerald-400"
              >
                <Check className="h-3.5 w-3.5" />
                Finalizar recorrido
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  setStepIndex((i) =>
                    Math.min(PRODUCT_TOUR_STEPS.length - 1, i + 1)
                  )
                }
                className="inline-flex items-center gap-1 rounded-lg bg-kipu-gold px-3.5 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-amber-400"
              >
                Siguiente
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
