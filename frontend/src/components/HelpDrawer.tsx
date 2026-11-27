"use client";

import React, { useEffect } from "react";
import {
  BookOpen,
  Compass,
  RotateCcw,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import { HELP_GLOSSARY } from "@/lib/ux";

interface HelpDrawerProps {
  open: boolean;
  onClose: () => void;
  onRestartTour: () => void;
  onOpenWizard: () => void;
  onOpenWelcome: () => void;
}

export function HelpDrawer({
  open,
  onClose,
  onRestartTour,
  onOpenWizard,
  onOpenWelcome,
}: HelpDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Centro de ayuda contextual de KipuVault"
      className="fixed inset-0 z-50 flex justify-end bg-black/70"
      onClick={onClose}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-lg flex-col border-l border-kipu-border bg-kipu-card shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-kipu-border px-5 py-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-kipu-gold" />
            <div>
              <h2 className="text-sm font-bold text-white">
                Centro de Ayuda KipuVault
              </h2>
              <p className="text-xs text-zinc-400">
                Conceptos claros y acciones rápidas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar centro de ayuda"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2 border-b border-kipu-border bg-kipu-bg/60 px-5 py-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              onRestartTour();
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-kipu-gold/50 bg-kipu-gold/15 px-3 py-2 text-xs font-semibold text-kipu-gold hover:bg-kipu-gold/25"
          >
            <Compass className="h-3.5 w-3.5" />
            Reiniciar tutorial
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenWizard();
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-kipu-border bg-kipu-card px-3 py-2 text-xs font-medium text-zinc-200 hover:border-kipu-gold/50"
          >
            <Wrench className="h-3.5 w-3.5 text-kipu-gold" />
            Asistente de bóveda
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenWelcome();
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-kipu-border bg-kipu-card px-3 py-2 text-xs font-medium text-zinc-200 hover:border-kipu-gold/50"
          >
            <RotateCcw className="h-3.5 w-3.5 text-zinc-300" />
            Ver bienvenida
          </button>
        </div>

        <div className="flex-1 space-y-2.5 overflow-y-auto px-5 py-4">
          {HELP_GLOSSARY.map((item) => (
            <details
              key={item.id}
              className="group rounded-xl border border-kipu-border bg-kipu-bg p-3 transition hover:border-zinc-600"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-semibold text-zinc-100">
                <span>{item.question}</span>
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-kipu-gold opacity-70 group-open:opacity-100" />
              </summary>
              <p className="mt-2 text-xs leading-relaxed text-zinc-200">
                {item.answer}
              </p>
              <p className="mt-1.5 rounded-md border border-kipu-border bg-kipu-card px-2.5 py-1.5 text-[11px] text-zinc-300">
                {item.example}
              </p>
            </details>
          ))}
        </div>
      </aside>
    </div>
  );
}
