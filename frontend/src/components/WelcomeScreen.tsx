"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  FileSearch,
  Lock,
  PlayCircle,
  ShieldCheck,
  SlidersHorizontal,
  XCircle,
} from "lucide-react";

interface WelcomeScreenProps {
  onStartSetup: () => void;
  onViewDemo: () => void;
  onSkipAdvanced: () => void;
}

export function WelcomeScreen({
  onStartSetup,
  onViewDemo,
  onSkipAdvanced,
}: WelcomeScreenProps) {
  const [simFrame, setSimFrame] = useState<0 | 1>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSimFrame((prev) => (prev === 0 ? 1 : 0));
    }, 3400);
    return () => clearInterval(timer);
  }, []);

  const isAllowedFrame = simFrame === 0;

  return (
    <div className="flex min-h-screen flex-col justify-center bg-kipu-bg px-4 py-8 text-zinc-100 sm:px-6">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-kipu-gold/40 bg-kipu-gold/10 px-3 py-1 text-xs font-medium text-kipu-gold">
            <span className="h-2 w-2 rounded-full bg-kipu-gold" />
            KipuVault · Seguridad On-Chain en Solana Devnet
          </div>
          <button
            type="button"
            onClick={onSkipAdvanced}
            className="rounded px-2 py-1 text-xs text-zinc-400 underline-offset-4 transition hover:text-zinc-200 hover:underline focus:outline-none focus:ring-2 focus:ring-kipu-gold/50"
          >
            Soy usuario avanzado · Ir directo al panel
          </button>
        </div>

        <div className="grid gap-6 rounded-2xl border border-kipu-border bg-kipu-card p-6 shadow-2xl lg:grid-cols-12 lg:p-8">
          <div className="flex flex-col justify-center space-y-4 lg:col-span-7">
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Tu bóveda. Tus reglas. Tu seguridad.
            </h1>
            <p className="text-sm leading-relaxed text-zinc-300 sm:text-base">
              KipuVault protege tus activos en Solana estableciendo límites y
              reglas que los agentes de IA no pueden sobrepasar.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onStartSetup}
                className="inline-flex items-center gap-2 rounded-lg bg-kipu-gold px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-kipu-gold"
              >
                <ShieldCheck className="h-4 w-4" />
                Configurar mi bóveda
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={onViewDemo}
                className="inline-flex items-center gap-2 rounded-lg border border-kipu-border bg-kipu-bg px-5 py-2.5 text-sm font-medium text-zinc-100 transition hover:border-kipu-gold/60 hover:text-kipu-gold focus:outline-none focus:ring-2 focus:ring-kipu-gold/50"
              >
                <PlayCircle className="h-4 w-4 text-kipu-gold" />
                Ver demostración
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Nota: la demostración interactiva usa{" "}
              <span className="font-mono text-zinc-300">Mock USDC</span> en
              Solana Devnet (sin dinero real).
            </p>
          </div>

          <div
            aria-label="Animación ilustrativa de validación de KipuVault"
            className="flex flex-col justify-between rounded-xl border border-kipu-border bg-kipu-bg p-4 lg:col-span-5"
          >
            <div className="mb-3 flex items-center justify-between text-xs text-zinc-400">
              <span>Flujo en vivo antes de transferir</span>
              <span className="font-mono text-[11px] text-kipu-gold">
                Guardrail On-Chain
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-kipu-border bg-kipu-card px-3 py-2.5 transition-all duration-300">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-kipu-gold/15 text-kipu-gold">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-zinc-100">
                      Agente de IA propone pago
                    </p>
                    <p className="font-mono text-[11px] text-zinc-300">
                      {isAllowedFrame
                        ? "5 Mock USDC → Allowlist"
                        : "150 Mock USDC → Fuera de tope"}
                    </p>
                  </div>
                </div>
                <ArrowRight className="kipu-travel-dot h-4 w-4 text-kipu-gold" />
              </div>

              <div className="rounded-lg border border-kipu-gold/40 bg-kipu-gold/5 px-3 py-2.5">
                <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-kipu-gold">
                  <Lock className="h-3.5 w-3.5" />
                  KipuVault verifica reglas en Solana
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                  <span
                    className={`rounded border px-1.5 py-0.5 text-center ${
                      isAllowedFrame
                        ? "border-kipu-emerald/40 bg-kipu-emerald/10 text-kipu-emerald"
                        : "border-kipu-crimson/50 bg-kipu-crimson/10 text-red-300"
                    }`}
                  >
                    Tope ≤ 10
                  </span>
                  <span className="rounded border border-kipu-emerald/40 bg-kipu-emerald/10 px-1.5 py-0.5 text-center text-kipu-emerald">
                    Diario ≤ 50
                  </span>
                  <span className="rounded border border-kipu-emerald/40 bg-kipu-emerald/10 px-1.5 py-0.5 text-center text-kipu-emerald">
                    Allowlist
                  </span>
                </div>
              </div>

              <div
                className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-all duration-300 ${
                  isAllowedFrame
                    ? "border-kipu-emerald/50 bg-kipu-emerald/10 text-emerald-100"
                    : "border-kipu-crimson/60 bg-kipu-crimson/10 text-red-100"
                }`}
              >
                {isAllowedFrame ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-kipu-emerald" />
                ) : (
                  <XCircle className="h-5 w-5 shrink-0 text-kipu-crimson" />
                )}
                <div>
                  <p className="text-xs font-semibold">
                    {isAllowedFrame
                      ? "Operación aprobada y auditada"
                      : "Bloqueado antes de mover fondos"}
                  </p>
                  <p className="text-[11px] opacity-90">
                    {isAllowedFrame
                      ? "Cumple las políticas; firma verificable on-chain."
                      : "Supera el tope por transacción. Tu bóveda sigue intacta."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-kipu-border bg-kipu-card p-4">
            <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-kipu-gold/15 text-kipu-gold">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-kipu-gold">
              1. CONTROL
            </h2>
            <p className="mt-1 text-sm font-medium text-zinc-100">
              Define cuánto puede transferir tu agente.
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              Establece topes por operación y límites diarios de 24 horas en el
              contrato.
            </p>
          </div>

          <div className="rounded-xl border border-kipu-border bg-kipu-card p-4">
            <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-kipu-emerald/15 text-kipu-emerald">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-kipu-emerald">
              2. PROTECCIÓN
            </h2>
            <p className="mt-1 text-sm font-medium text-zinc-100">
              Autoriza únicamente destinatarios permitidos.
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              Ningún pago sale hacia cuentas fuera de tu Allowlist ni mientras
              congeles la bóveda.
            </p>
          </div>

          <div className="rounded-xl border border-kipu-border bg-kipu-card p-4">
            <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-zinc-200">
              <FileSearch className="h-4 w-4 text-kipu-gold" />
            </div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
              3. AUDITORÍA
            </h2>
            <p className="mt-1 text-sm font-medium text-zinc-100">
              Verifica las decisiones y operaciones realizadas.
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              Cada intento genera un registro inmutable con huella SHA-256
              verificable en Solana.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
