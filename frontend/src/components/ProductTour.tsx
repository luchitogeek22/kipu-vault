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
      const box = el.getBoundingClientRect();
      const needsScroll =
        box.top < 72 || box.bottom > window.innerHeight - 250;
      if (needsScroll) {
        el.scrollIntoView({ behavior: "auto", block: "center" });
      }
    }

    updateTarget();
    const rafId = window.requestAnimationFrame(updateTarget);
    const timer1 = setTimeout(updateTarget, 120);
    window.addEventListener("resize", updateTarget);
    window.addEventListener("scroll", updateTarget, true);
    return () => {
      window.cancelAnimationFrame(rafId);
      clearTimeout(timer1);
      window.removeEventListener("resize", updateTarget);
      window.removeEventListener("scroll", updateTarget, true);
    };
  }, [open, step.target]);

  if (!open) return null;

  const viewportW =
    typeof window !== "undefined" ? window.innerWidth : 1280;
  const viewportH =
    typeof window !== "undefined" ? window.innerHeight : 800;
  const isDesktop = viewportW >= 640;

  let cardStyle: React.CSSProperties | undefined;
  if (rect && isDesktop) {
    const cardWidth = Math.min(400, viewportW - 32);
    const estCardHeight = 225;
    const spaceBelow = viewportH - (rect.top + rect.height) - 16;
    const spaceAbove = rect.top - 16;
    const top =
      spaceBelow >= estCardHeight || spaceBelow >= spaceAbove
        ? Math.min(rect.top + rect.height + 12, viewportH - estCardHeight - 12)
        : Math.max(12, rect.top - estCardHeight - 12);
    const left = Math.min(
      Math.max(16, rect.left),
      viewportW - cardWidth - 16
    );
    cardStyle = { top, left, width: cardWidth };
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Recorrido interactivo: ${step.title}`}
      className="fixed inset-0 z-50 pointer-events-auto"
    >
      <div
        className={`fixed inset-0 transition-opacity ${
          rect ? "bg-transparent" : "bg-black/25"
        }`}
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
          className="pointer-events-none fixed z-50 rounded-xl border-2 border-kipu-gold shadow-[0_0_0_9999px_rgba(9,9,11,0.28)] transition-all duration-200"
        />
      )}

      <div
        style={cardStyle}
        className={`fixed z-[60] rounded-2xl border border-kipu-gold/70 bg-kipu-card p-4 shadow-2xl transition-all duration-200 sm:p-5 ${
          !cardStyle
            ? "bottom-3 left-3 right-3 mx-auto max-w-md sm:bottom-6 sm:left-auto sm:right-6"
            : ""
        }`}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-kipu-gold/20 px-2.5 py-0.5 text-[11px] font-semibold text-amber-200">
            <Compass className="h-3.5 w-3.5 text-kipu-gold" />
            Recorrido guiado · {stepIndex + 1} de {PRODUCT_TOUR_STEPS.length}
          </span>
          <button
            type="button"
            onClick={() => onClose(false)}
            aria-label="Cerrar recorrido"
            className="rounded p-1 text-zinc-200 hover:bg-zinc-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h3 className="text-sm font-bold text-white">{step.title}</h3>
        <p className="mt-1.5 text-xs leading-relaxed text-zinc-100">
          {step.description}
        </p>

        <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-zinc-200">
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
            className="rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-100 transition hover:border-kipu-gold hover:text-kipu-gold"
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
