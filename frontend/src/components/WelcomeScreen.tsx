"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  FileSearch,
  Lock,
  PlayCircle,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Snowflake,
  XCircle,
} from "lucide-react";

interface WelcomeScreenProps {
  onStartSetup: () => void;
  onViewDemo: () => void;
  onSkipAdvanced: () => void;
}

type SimScenario = {
  kind: "approved" | "blocked_amount" | "blocked_recipient";
  badge: string;
  attempt: string;
  limitCheckPass: boolean;
  dailyCheckPass: boolean;
  allowlistCheckPass: boolean;
  resultTitle: string;
  resultDetail: string;
};

const SIM_SCENARIOS: SimScenario[] = [
  {
    kind: "approved",
    badge: "APROBADO",
    attempt: "5 Mock USDC → Wallet en Allowlist",
    limitCheckPass: true,
    dailyCheckPass: true,
    allowlistCheckPass: true,
    resultTitle: "APROBADO · Pago ejecutado y auditado",
    resultDetail: "Dentro del tope por tx, límite diario y Allowlist on-chain.",
  },
  {
    kind: "blocked_amount",
    badge: "BLOQUEADO",
    attempt: "150 Mock USDC → Prompt injection",
    limitCheckPass: false,
    dailyCheckPass: false,
    allowlistCheckPass: true,
    resultTitle: "BLOQUEADO · Supera el tope máximo (10 USDC)",
    resultDetail: "El contrato revierte la operación. 0 Mock USDC perdidos.",
  },
  {
    kind: "blocked_recipient",
    badge: "BLOQUEADO",
    attempt: "5 Mock USDC → Wallet atacante no autorizada",
    limitCheckPass: true,
    dailyCheckPass: true,
    allowlistCheckPass: false,
    resultTitle: "BLOQUEADO · Destinatario fuera de Allowlist",
    resultDetail: "KipuVault impide enviar fondos a direcciones desconocidas.",
  },
];

export function WelcomeScreen({
  onStartSetup,
  onViewDemo,
  onSkipAdvanced,
}: WelcomeScreenProps) {
  const [simIndex, setSimIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSimIndex((prev) => (prev + 1) % SIM_SCENARIOS.length);
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  const scenario = SIM_SCENARIOS[simIndex] ?? SIM_SCENARIOS[0];
  const isApproved = scenario.kind === "approved";

  return (
    <div className="flex min-h-screen flex-col justify-center bg-kipu-bg px-4 py-8 text-zinc-100 sm:px-6">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-kipu-gold/50 bg-kipu-gold/15 px-3.5 py-1 text-xs font-semibold text-amber-200">
            <span className="h-2 w-2 rounded-full bg-kipu-gold" />
            KipuVault · Seguridad On-Chain en Solana Devnet
          </div>
          <button
            type="button"
            onClick={onSkipAdvanced}
            className="rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-kipu-gold/60 hover:text-kipu-gold focus:outline-none focus:ring-2 focus:ring-kipu-gold/50"
          >
            Soy usuario avanzado · Ir directo al panel
          </button>
        </div>

        <div className="grid gap-6 rounded-2xl border border-kipu-border bg-kipu-card p-6 shadow-2xl lg:grid-cols-12 lg:p-8">
          <div className="flex flex-col justify-center space-y-4 lg:col-span-7">
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
              Si tu agente de IA es hackeado,{" "}
              <span className="text-kipu-gold">
                KipuVault limita cuánto puede perder
              </span>
            </h1>
            <p className="text-sm leading-relaxed text-zinc-200 sm:text-base">
              Tú fijas límites diarios, topes por transacción, wallets
              permitidas y un{" "}
              <strong className="font-semibold text-white">
                Emergency Freeze
              </strong>{" "}
              en Solana. Si el agente sufre un ataque, el contrato bloquea el
              abuso antes de mover un solo token.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onViewDemo}
                className="inline-flex items-center gap-2 rounded-lg bg-kipu-gold px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-kipu-gold"
              >
                <PlayCircle className="h-4 w-4" />
                Ver demostración
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={onStartSetup}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-600 bg-kipu-bg px-5 py-2.5 text-sm font-medium text-zinc-100 transition hover:border-kipu-gold/70 hover:text-kipu-gold focus:outline-none focus:ring-2 focus:ring-kipu-gold/50"
              >
                <ShieldCheck className="h-4 w-4 text-kipu-gold" />
                Configurar mi bóveda
              </button>
            </div>

            <p className="text-xs leading-relaxed text-zinc-200">
              Nota: la demostración interactiva opera en{" "}
              <span className="font-semibold text-amber-200">Solana Devnet</span>{" "}
              con <span className="font-mono font-semibold text-white">Mock USDC</span>{" "}
              (sin dinero real).
            </p>
          </div>

          <div
            aria-label="Animación ilustrativa de validación aprobado y bloqueado en KipuVault"
            className="flex flex-col justify-between rounded-xl border border-kipu-border bg-kipu-bg p-4 lg:col-span-5"
          >
            <div className="mb-3 flex items-center justify-between gap-2 text-xs text-zinc-200">
              <span className="font-medium">Simulación · Guardrail On-Chain</span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold tracking-wide transition-colors duration-300 ${
                  isApproved
                    ? "border border-kipu-emerald/60 bg-kipu-emerald/20 text-emerald-200"
                    : "border border-kipu-crimson bg-kipu-crimson/25 text-red-100"
                }`}
              >
                {isApproved ? (
                  <CheckCircle2 className="h-3 w-3 text-kipu-emerald" />
                ) : (
                  <ShieldAlert className="h-3 w-3 text-kipu-crimson" />
                )}
                {scenario.badge}
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-kipu-border bg-kipu-card px-3 py-2.5 transition-all duration-300">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                      isApproved
                        ? "bg-kipu-gold/15 text-kipu-gold"
                        : "bg-kipu-crimson/20 text-kipu-crimson"
                    }`}
                  >
                    <Bot className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">
                      {isApproved
                        ? "Agente propone operación normal"
                        : "Agente comprometido intenta ataque"}
                    </p>
                    <p className="font-mono text-[11px] text-zinc-200">
                      {scenario.attempt}
                    </p>
                  </div>
                </div>
                <ArrowRight
                  className={`kipu-travel-dot h-4 w-4 shrink-0 ${
                    isApproved ? "text-kipu-gold" : "text-kipu-crimson"
                  }`}
                />
              </div>

              <div className="rounded-lg border border-kipu-gold/40 bg-kipu-gold/5 px-3 py-2.5">
                <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-amber-200">
                  <Lock className="h-3.5 w-3.5 text-kipu-gold" />
                  KipuVault valida las reglas en Solana
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-[11px] font-medium">
                  <span
                    className={`rounded border px-1.5 py-0.5 text-center ${
                      scenario.limitCheckPass
                        ? "border-kipu-emerald/50 bg-kipu-emerald/15 text-emerald-200"
                        : "border-kipu-crimson bg-kipu-crimson/20 text-red-200"
                    }`}
                  >
                    {scenario.limitCheckPass ? "✓" : "✕"} Tope ≤ 10
                  </span>
                  <span
                    className={`rounded border px-1.5 py-0.5 text-center ${
                      scenario.dailyCheckPass
                        ? "border-kipu-emerald/50 bg-kipu-emerald/15 text-emerald-200"
                        : "border-kipu-crimson bg-kipu-crimson/20 text-red-200"
                    }`}
                  >
                    {scenario.dailyCheckPass ? "✓" : "✕"} Diario ≤ 50
                  </span>
                  <span
                    className={`rounded border px-1.5 py-0.5 text-center ${
                      scenario.allowlistCheckPass
                        ? "border-kipu-emerald/50 bg-kipu-emerald/15 text-emerald-200"
                        : "border-kipu-crimson bg-kipu-crimson/20 text-red-200"
                    }`}
                  >
                    {scenario.allowlistCheckPass ? "✓" : "✕"} Allowlist
                  </span>
                </div>
              </div>

              <div
                className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-all duration-300 ${
                  isApproved
                    ? "border-kipu-emerald/60 bg-kipu-emerald/15 text-emerald-100"
                    : "border-kipu-crimson bg-kipu-crimson/20 text-red-100"
                }`}
              >
                {isApproved ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-kipu-emerald" />
                ) : (
                  <XCircle className="h-5 w-5 shrink-0 text-kipu-crimson" />
                )}
                <div>
                  <p className="text-xs font-bold text-white">
                    {scenario.resultTitle}
                  </p>
                  <p className="text-[11px] text-zinc-100">
                    {scenario.resultDetail}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-center gap-1.5">
              {SIM_SCENARIOS.map((item, idx) => (
                <button
                  key={item.kind}
                  type="button"
                  onClick={() => setSimIndex(idx)}
                  aria-label={`Ver escenario ${item.badge}`}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === simIndex
                      ? item.kind === "approved"
                        ? "w-6 bg-kipu-emerald"
                        : "w-6 bg-kipu-crimson"
                      : "w-2 bg-zinc-600 hover:bg-zinc-400"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-kipu-border bg-kipu-card p-4">
            <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-kipu-gold/15 text-kipu-gold">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-kipu-gold">
              1. CONTROL DE LÍMITES
            </h2>
            <p className="mt-1 text-sm font-semibold text-white">
              Define cuánto puede transferir tu agente.
            </p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-200">
              Fija topes por transacción y límite diario de 24 horas directo en
              el contrato.
            </p>
          </div>

          <div className="rounded-xl border border-kipu-border bg-kipu-card p-4">
            <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-kipu-emerald/15 text-kipu-emerald">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-kipu-emerald">
              2. ALLOWLIST ESTRICTA
            </h2>
            <p className="mt-1 text-sm font-semibold text-white">
              Autoriza únicamente destinatarios permitidos.
            </p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-200">
              Ningún pago sale hacia wallets fuera de tu lista aprobada on-chain.
            </p>
          </div>

          <div className="rounded-xl border border-kipu-crimson/40 bg-kipu-card p-4">
            <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-kipu-crimson/15 text-kipu-crimson">
              <Snowflake className="h-4 w-4" />
            </div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-red-300">
              3. FREEZE DE EMERGENCIA
            </h2>
            <p className="mt-1 text-sm font-semibold text-white">
              Congela al agente en un clic.
            </p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-200">
              Detén toda ejecución al instante si sospechas de un prompt
              comprometido.
            </p>
          </div>

          <div className="rounded-xl border border-kipu-border bg-kipu-card p-4">
            <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-zinc-100">
              <FileSearch className="h-4 w-4 text-kipu-gold" />
            </div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-100">
              4. AUDITORÍA INMUTABLE
            </h2>
            <p className="mt-1 text-sm font-semibold text-white">
              Verifica decisiones y bloqueos.
            </p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-200">
              Cada intento queda registrado con firma y huella SHA-256
              verificable en Solana.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
