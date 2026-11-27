"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  ExternalLink,
  FileSearch,
  Lock,
  PlayCircle,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Snowflake,
  X,
  Zap,
} from "lucide-react";
import { FRONTEND_CONFIG } from "@/lib/config";
import { explorerAddressUrl, truncateMiddle } from "@/lib/format";

interface WelcomeScreenProps {
  onStartSetup: () => void;
  onViewDemo: () => void;
  onSkipAdvanced: () => void;
}

type RecipientKind = "allowlist" | "attacker";
type SimTab = "allowed" | "blocked" | "freeze";
type FlowPhase = "idle" | "proposing" | "validating" | "resolved";

const MAX_PER_TX = 10;
const DAILY_LIMIT = 50;

export function WelcomeScreen({
  onStartSetup,
  onViewDemo,
  onSkipAdvanced,
}: WelcomeScreenProps) {
  const [amount, setAmount] = useState<number>(150);
  const [recipientKind, setRecipientKind] =
    useState<RecipientKind>("attacker");
  const [frozen, setFrozen] = useState<boolean>(false);
  const [phase, setPhase] = useState<FlowPhase>("idle");
  const timersRef = useRef<number[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  };

  useEffect(() => clearTimers, []);

  const triggerBriefFlow = () => {
    clearTimers();
    setPhase("proposing");
    const t1 = window.setTimeout(() => setPhase("validating"), 170);
    const t2 = window.setTimeout(() => setPhase("resolved"), 360);
    timersRef.current = [t1, t2];
  };

  const passLimit = !frozen && amount <= MAX_PER_TX;
  const passDaily = !frozen && amount <= DAILY_LIMIT;
  const passAllowlist = !frozen && recipientKind === "allowlist";
  const isAllowed = passLimit && passDaily && passAllowlist;

  const activeTab: SimTab = frozen
    ? "freeze"
    : isAllowed
      ? "allowed"
      : "blocked";

  const applyTab = (tab: SimTab) => {
    if (tab === "allowed") {
      setFrozen(false);
      setAmount(5);
      setRecipientKind("allowlist");
      triggerBriefFlow();
    } else if (tab === "blocked") {
      setFrozen(false);
      setAmount(150);
      setRecipientKind("attacker");
      triggerBriefFlow();
    } else {
      clearTimers();
      setPhase("idle");
      setFrozen(true);
    }
  };

  const launchCompromisedAttack = () => {
    setFrozen(false);
    setAmount(150);
    setRecipientKind("attacker");
    triggerBriefFlow();
  };

  const handleAmountChange = (val: number) => {
    const clamped = Number.isFinite(val)
      ? Math.max(1, Math.min(200, Math.round(val)))
      : 1;
    setAmount(clamped);
    if (!frozen) triggerBriefFlow();
  };

  const handleRecipientChange = (kind: RecipientKind) => {
    setRecipientKind(kind);
    if (!frozen) triggerBriefFlow();
  };

  const destinationAddress =
    recipientKind === "allowlist"
      ? truncateMiddle(FRONTEND_CONFIG.demoRecipient, 5, 4)
      : truncateMiddle(FRONTEND_CONFIG.demoAttacker, 5, 4);

  let outcomeTitle = "TRANSFERENCIA PERMITIDA";
  let outcomeReason =
    "Dentro del tope por operación, límite diario y Allowlist verificada.";
  if (frozen) {
    outcomeTitle = "AGENTE DETENIDO · FREEZE ACTIVO";
    outcomeReason =
      "Emergency Freeze bloquea toda salida al instante sin perder tus fondos.";
  } else if (!passLimit && !passAllowlist) {
    outcomeTitle = "TRANSFERENCIA BLOQUEADA";
    outcomeReason = `${amount.toFixed(2)} USDC supera el tope (${MAX_PER_TX} USDC) y el destino está fuera de Allowlist. 0 USDC perdidos.`;
  } else if (!passLimit) {
    outcomeTitle = "TRANSFERENCIA BLOQUEADA · EXCEDE TOPE";
    outcomeReason = `${amount.toFixed(2)} Mock USDC supera el máximo de ${MAX_PER_TX.toFixed(2)} por transacción.`;
  } else if (!passAllowlist) {
    outcomeTitle = "TRANSFERENCIA BLOQUEADA · ALLOWLIST";
    outcomeReason =
      "Tu agente no puede enviar fondos a direcciones no autorizadas.";
  }

  return (
    <div className="min-h-screen bg-kipu-bg text-zinc-100">
      {/* Top minimal landing bar */}
      <header className="border-b border-kipu-border/80 bg-kipu-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-kipu-gold/45 bg-kipu-gold/10 text-kipu-gold">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-white">
              kipuvault<span className="text-kipu-gold">.</span>
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            <a
              href="#proteccion"
              className="hidden text-xs font-medium text-zinc-300 transition hover:text-white sm:inline"
            >
              Cómo funciona
            </a>
            <span className="hidden items-center gap-1.5 text-xs font-medium text-zinc-200 md:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-kipu-gold" />
              Demo local · Solana
            </span>
            <button
              type="button"
              onClick={onSkipAdvanced}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-kipu-card px-3 py-1.5 text-xs font-medium text-zinc-100 transition hover:border-kipu-gold hover:text-kipu-gold"
            >
              Abrir panel
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-12 px-4 py-8 sm:px-6 lg:py-12">
        {/* Hero + Interactive Mini-Demo */}
        <div className="grid items-start gap-8 lg:grid-cols-12 lg:gap-10">
          {/* Left Hero */}
          <div className="space-y-5 lg:col-span-6 lg:pt-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-kipu-gold/40 bg-kipu-gold/10 px-3 py-1 text-xs font-semibold text-amber-200">
              <span className="h-1.5 w-1.5 rounded-full bg-kipu-gold" />
              Para Solana / DEV3PACK
            </div>

            <h1 className="font-display text-4xl font-bold leading-[1.06] tracking-[-0.03em] text-white sm:text-5xl lg:text-[52px]">
              Tu agente es IA.
              <br />
              El control sigue
              <br />
              siendo <span className="text-kipu-gold">tuyo.</span>
            </h1>

            <p className="max-w-lg text-sm leading-relaxed text-zinc-200 sm:text-base">
              Tú fijas cuánto puede gastar, a quién y cuándo congelarlo. Si tu
              agente sufre prompt injection, el contrato bloquea el exceso antes
              de mover fondos.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={onViewDemo}
                className="inline-flex items-center gap-2 rounded-lg bg-kipu-gold px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-kipu-gold"
              >
                <PlayCircle className="h-4 w-4" />
                Ver demostración en vivo
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={onStartSetup}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-kipu-card px-5 py-2.5 text-sm font-medium text-zinc-100 transition hover:border-kipu-gold/70 hover:text-kipu-gold focus:outline-none focus:ring-2 focus:ring-kipu-gold/50"
              >
                <ShieldCheck className="h-4 w-4 text-kipu-gold" />
                Configurar bóveda
              </button>
            </div>

            <p className="flex items-center gap-1.5 text-xs text-zinc-300">
              <Lock className="h-3.5 w-3.5 text-zinc-400" />
              La tarjeta interactiva simula localmente sin wallet ni dinero real.
            </p>

            {/* Real On-Chain Evidence Box */}
            <div className="rounded-xl border border-kipu-emerald/35 bg-kipu-emerald/[0.06] p-4">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                  <ShieldCheck className="h-4 w-4" />
                  Evidencia on-chain real
                </span>
                <span className="rounded border border-kipu-emerald/40 bg-kipu-emerald/15 px-2 py-0.5 font-mono text-[11px] font-medium text-emerald-200">
                  Solana Devnet
                </span>
              </div>
              <p className="text-xs leading-relaxed text-zinc-200">
                Consulta el programa Anchor desplegado directamente en Solana
                Explorer (enlace independiente de la simulación local).
              </p>
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-kipu-border bg-kipu-bg px-3 py-2">
                <div>
                  <span className="block text-[10px] uppercase tracking-wider text-zinc-400">
                    Program ID
                  </span>
                  <span className="font-mono text-xs text-emerald-300">
                    {truncateMiddle(FRONTEND_CONFIG.programId, 12, 10)}
                  </span>
                </div>
                <a
                  href={explorerAddressUrl(FRONTEND_CONFIG.programId)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-kipu-card px-3 py-1.5 text-xs font-medium text-zinc-100 transition hover:border-kipu-emerald hover:text-emerald-300"
                >
                  Ver programa
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>

          {/* Right Interactive Card: Intenta romper la bóveda */}
          <div className="lg:col-span-6">
            <div
              aria-label="Simulación interactiva intenta romper la bóveda"
              className="rounded-2xl border border-kipu-border bg-kipu-card p-5 shadow-2xl"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-sm font-semibold text-white">
                    Intenta romper la bóveda
                  </h2>
                  <p className="text-[11px] text-zinc-300">
                    Ajusta monto, destino o activa un ataque y observa el
                    contrato.
                  </p>
                </div>
                <span className="rounded border border-zinc-700 bg-kipu-bg px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-zinc-300">
                  DEMO
                </span>
              </div>

              {/* Visible Scenario Tabs */}
              <div className="mb-3 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => applyTab("allowed")}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold transition ${
                    activeTab === "allowed"
                      ? "border-kipu-emerald bg-kipu-emerald/20 text-emerald-200"
                      : "border-kipu-border bg-kipu-bg text-zinc-300 hover:border-zinc-600"
                  }`}
                >
                  <Check className="h-3.5 w-3.5" />
                  Permitida
                </button>
                <button
                  type="button"
                  onClick={() => applyTab("blocked")}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold transition ${
                    activeTab === "blocked"
                      ? "border-kipu-crimson bg-kipu-crimson/20 text-red-100"
                      : "border-kipu-border bg-kipu-bg text-zinc-300 hover:border-zinc-600"
                  }`}
                >
                  <X className="h-3.5 w-3.5" />
                  Bloqueada
                </button>
                <button
                  type="button"
                  onClick={() => applyTab("freeze")}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold transition ${
                    activeTab === "freeze"
                      ? "border-amber-500 bg-amber-500/20 text-amber-200"
                      : "border-kipu-border bg-kipu-bg text-zinc-300 hover:border-zinc-600"
                  }`}
                >
                  <Snowflake className="h-3.5 w-3.5" />
                  Freeze
                </button>
              </div>

              {/* Primary Judge Action Button: Simular agente comprometido */}
              <button
                type="button"
                onClick={launchCompromisedAttack}
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border border-kipu-crimson/70 bg-kipu-crimson/20 px-4 py-2 text-xs font-semibold text-red-100 transition hover:bg-kipu-crimson/30 focus:outline-none focus:ring-2 focus:ring-kipu-crimson"
              >
                <Zap className="h-3.5 w-3.5 text-kipu-crimson" />
                Simular agente comprometido (150 USDC → atacante)
              </button>

              {/* Interactive Controls: Amount & Destination */}
              <div className="mb-3 space-y-2.5 rounded-xl border border-kipu-border bg-kipu-bg p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-zinc-300">
                    Monto que intenta el agente:
                  </span>
                  <div className="flex items-center gap-1.5">
                    {[5, 15, 150].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          if (frozen) setFrozen(false);
                          handleAmountChange(preset);
                        }}
                        className={`rounded border px-2 py-0.5 font-mono text-[11px] font-medium transition ${
                          amount === preset && !frozen
                            ? "border-kipu-gold bg-kipu-gold/20 text-amber-200"
                            : "border-zinc-700 bg-kipu-card text-zinc-200 hover:border-zinc-500"
                        }`}
                      >
                        {preset} USDC
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={1}
                    max={200}
                    value={amount}
                    aria-label="Monto en Mock USDC"
                    onChange={(e) => {
                      if (frozen) setFrozen(false);
                      handleAmountChange(Number(e.target.value));
                    }}
                    className="h-1.5 flex-1 cursor-pointer accent-kipu-gold"
                  />
                  <span className="w-24 text-right font-mono text-xs font-semibold text-white">
                    {amount.toFixed(0)} Mock USDC
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (frozen) setFrozen(false);
                      handleRecipientChange("allowlist");
                    }}
                    className={`rounded-lg border px-2.5 py-1.5 text-left text-[11px] transition ${
                      recipientKind === "allowlist" && !frozen
                        ? "border-kipu-emerald/60 bg-kipu-emerald/15 text-emerald-100"
                        : "border-kipu-border bg-kipu-card text-zinc-300 hover:border-zinc-600"
                    }`}
                  >
                    <span className="block font-semibold">
                      Destino autorizado
                    </span>
                    <span className="font-mono text-[10px] opacity-85">
                      Allowlist ({truncateMiddle(FRONTEND_CONFIG.demoRecipient, 4, 4)})
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (frozen) setFrozen(false);
                      handleRecipientChange("attacker");
                    }}
                    className={`rounded-lg border px-2.5 py-1.5 text-left text-[11px] transition ${
                      recipientKind === "attacker" && !frozen
                        ? "border-kipu-crimson/70 bg-kipu-crimson/15 text-red-100"
                        : "border-kipu-border bg-kipu-card text-zinc-300 hover:border-zinc-600"
                    }`}
                  >
                    <span className="block font-semibold">
                      Wallet desconocida
                    </span>
                    <span className="font-mono text-[10px] opacity-85">
                      Fuera de Allowlist
                    </span>
                  </button>
                </div>
              </div>

              {/* 3-Step Intentional Flow: Agent -> Rules -> Outcome */}
              <div className="space-y-2.5">
                <div
                  className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 transition-all duration-200 ${
                    phase === "proposing"
                      ? "border-kipu-gold bg-kipu-gold/10"
                      : "border-kipu-border bg-kipu-bg"
                  } ${frozen ? "opacity-60" : ""}`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-kipu-border bg-kipu-card text-zinc-200">
                      <Bot className="h-4 w-4 text-kipu-gold" />
                    </div>
                    <div>
                      <p className="text-[11px] text-zinc-300">
                        01 · Solicitud del agente de IA
                      </p>
                      <p className="font-display text-lg font-bold tracking-tight text-white">
                        {amount.toFixed(2)}{" "}
                        <span className="font-mono text-xs font-medium text-zinc-300">
                          Mock USDC → {destinationAddress}
                        </span>
                      </p>
                    </div>
                  </div>
                  <ArrowRight
                    className={`h-4 w-4 shrink-0 ${
                      frozen
                        ? "text-zinc-500"
                        : isAllowed
                          ? "kipu-travel-dot text-kipu-emerald"
                          : "kipu-travel-dot text-kipu-crimson"
                    }`}
                  />
                </div>

                <div
                  className={`rounded-xl border px-3.5 py-2.5 transition-all duration-200 ${
                    phase === "validating"
                      ? "border-kipu-gold bg-kipu-gold/15"
                      : "border-kipu-gold/40 bg-kipu-gold/[0.06]"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-amber-200">
                    <span className="inline-flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-kipu-gold" />
                      02 · Reglas evaluadas (simulación local)
                    </span>
                    <span className="font-mono text-[10px] text-zinc-300">
                      {frozen ? "PAUSADO" : "ON-CHAIN LOGIC"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-[11px] font-medium">
                    <span
                      className={`rounded border px-1.5 py-1 text-center transition-colors ${
                        passLimit
                          ? "border-kipu-emerald/50 bg-kipu-emerald/15 text-emerald-200"
                          : "border-kipu-crimson bg-kipu-crimson/20 text-red-200"
                      }`}
                    >
                      {passLimit ? "✓" : "✕"} Tope ≤ {MAX_PER_TX}
                    </span>
                    <span
                      className={`rounded border px-1.5 py-1 text-center transition-colors ${
                        passDaily
                          ? "border-kipu-emerald/50 bg-kipu-emerald/15 text-emerald-200"
                          : "border-kipu-crimson bg-kipu-crimson/20 text-red-200"
                      }`}
                    >
                      {passDaily ? "✓" : "✕"} Diario ≤ {DAILY_LIMIT}
                    </span>
                    <span
                      className={`rounded border px-1.5 py-1 text-center transition-colors ${
                        passAllowlist
                          ? "border-kipu-emerald/50 bg-kipu-emerald/15 text-emerald-200"
                          : "border-kipu-crimson bg-kipu-crimson/20 text-red-200"
                      }`}
                    >
                      {passAllowlist ? "✓" : "✕"} Allowlist
                    </span>
                  </div>
                </div>

                {/* Result Box */}
                <div
                  className={`rounded-xl border px-3.5 py-3 transition-all duration-200 ${
                    frozen
                      ? "border-amber-500/70 bg-amber-500/15 text-amber-100"
                      : isAllowed
                        ? "border-kipu-emerald/60 bg-kipu-emerald/15 text-emerald-100"
                        : "border-kipu-crimson bg-kipu-crimson/20 text-red-100"
                  } ${phase === "resolved" ? "ring-1 ring-white/25" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      {frozen ? (
                        <Snowflake className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
                      ) : isAllowed ? (
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-kipu-emerald" />
                      ) : (
                        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-kipu-crimson" />
                      )}
                      <div>
                        <p className="font-display text-xs font-bold tracking-wide text-white">
                          03 · {outcomeTitle}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-snug text-zinc-100">
                          {outcomeReason}
                        </p>
                      </div>
                    </div>

                    {frozen && (
                      <button
                        type="button"
                        onClick={() => {
                          setFrozen(false);
                          triggerBriefFlow();
                        }}
                        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-kipu-emerald/60 bg-kipu-emerald/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-kipu-emerald/30"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Recuperar control
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <p className="mt-3 text-center text-xs text-zinc-300">
                El agente propone.{" "}
                <span className="font-semibold text-kipu-gold">
                  Tus reglas deciden.
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* 4 Layers Section */}
        <section id="proteccion" className="space-y-4 border-t border-kipu-border pt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
              Cuatro capas. Un solo objetivo: protegerte.
            </h2>
            <span className="text-xs text-zinc-300">
              Reglas en el contrato · verificación en Solana Devnet
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-kipu-border bg-kipu-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-kipu-gold/30 bg-kipu-gold/10 text-kipu-gold">
                  <SlidersHorizontal className="h-4 w-4" />
                </div>
                <span className="font-mono text-xs text-zinc-400">01</span>
              </div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-kipu-gold">
                LÍMITES
              </p>
              <h3 className="mt-1 font-display text-base font-bold text-white">
                Tú pones el límite.
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-200">
                Define cuánto puede gastar tu agente por operación y cada 24
                horas.
              </p>
            </div>

            <div className="rounded-xl border border-kipu-border bg-kipu-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-kipu-emerald/30 bg-kipu-emerald/10 text-kipu-emerald">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <span className="font-mono text-xs text-zinc-400">02</span>
              </div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-kipu-emerald">
                ALLOWLIST
              </p>
              <h3 className="mt-1 font-display text-base font-bold text-white">
                Solo a quien tú permitas.
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-200">
                Autoriza destinos de confianza. Todo lo demás queda bloqueado.
              </p>
            </div>

            <div className="rounded-xl border border-kipu-crimson/40 bg-kipu-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-kipu-crimson/35 bg-kipu-crimson/10 text-kipu-crimson">
                  <Snowflake className="h-4 w-4" />
                </div>
                <span className="font-mono text-xs text-zinc-400">03</span>
              </div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-red-300">
                EMERGENCY FREEZE
              </p>
              <h3 className="mt-1 font-display text-base font-bold text-white">
                Un clic. Todo se detiene.
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-200">
                Congela las operaciones del agente ante cualquier señal de
                riesgo.
              </p>
            </div>

            <div className="rounded-xl border border-kipu-border bg-kipu-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 text-kipu-gold">
                  <FileSearch className="h-4 w-4" />
                </div>
                <span className="font-mono text-xs text-zinc-400">04</span>
              </div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-200">
                AUDITORÍA
              </p>
              <h3 className="mt-1 font-display text-base font-bold text-white">
                Nada bajo la alfombra.
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-200">
                Cada decisión queda registrada con trazabilidad verificable en
                Solana.
              </p>
            </div>
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-kipu-border/80 pt-5 text-xs text-zinc-300">
          <span>Menos confianza ciega. Más control verificable.</span>
          <span className="font-mono text-[11px] text-zinc-300">
            BUILT ON SOLANA / DEV3PACK HACKATHON
          </span>
        </footer>
      </main>
    </div>
  );
}
