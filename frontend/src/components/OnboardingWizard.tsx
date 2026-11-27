"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Lock,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  Vault,
  Wallet,
  X,
} from "lucide-react";
import { FRONTEND_CONFIG } from "@/lib/config";
import {
  formatBaseUnitsAsUsdc,
  isValidSolanaPubkey,
  truncateMiddle,
} from "@/lib/format";
import type { DecodedVaultState } from "@/lib/kipuVault";

const WalletMultiButton = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

interface OnboardingWizardProps {
  connectedWallet: string | null;
  vault: DecodedVaultState | null;
  isAuthenticated: boolean;
  signingIn: boolean;
  onSignIn: () => Promise<void>;
  mintInput: string;
  onChangeMintInput: (val: string) => void;
  defaultAgentPubkey: string;
  onInitializeVault: (params: {
    mint: string;
    agent: string;
    maxPerTxUsdc: string;
    dailyLimitUsdc: string;
  }) => Promise<void>;
  onUpdatePolicy: (params: {
    newAgent: string;
    newMaxPerTxUsdc: string;
    newDailyLimitUsdc: string;
  }) => Promise<void>;
  onAddRecipient: (recipient: string) => Promise<void>;
  onDeposit: (amountUsdc: string) => Promise<void>;
  onToggleFreeze: () => Promise<void>;
  busyAction: string | null;
  freezing: boolean;
  errorMessage: string | null;
  onDismissWizard: () => void;
  onCompleteAndStartTour: () => void;
}

const STEP_META = [
  {
    id: 1,
    short: "1. Conectar wallet",
    title: "PASO 1 — Conectar wallet",
    explanation:
      "Conecta tu wallet de Solana para identificar al propietario de la bóveda.",
    icon: Wallet,
  },
  {
    id: 2,
    short: "2. Crear bóveda",
    title: "PASO 2 — Crear bóveda",
    explanation:
      "Establece un espacio de protección para controlar las operaciones de tu agente.",
    icon: Vault,
  },
  {
    id: 3,
    short: "3. Seguridad",
    title: "PASO 3 — Configurar seguridad",
    explanation:
      "Define límites diarios, límites por transacción y reglas de autorización.",
    icon: SlidersHorizontal,
  },
  {
    id: 4,
    short: "4. Allowlist",
    title: "PASO 4 — Crear Allowlist",
    explanation: "Registra las wallets que pueden recibir transferencias.",
    icon: Users,
  },
  {
    id: 5,
    short: "5. Activar",
    title: "PASO 5 — Activar protección",
    explanation:
      "Activa las políticas de seguridad y comprueba que la bóveda está lista.",
    icon: ShieldCheck,
  },
] as const;

export function OnboardingWizard({
  connectedWallet,
  vault,
  isAuthenticated,
  signingIn,
  onSignIn,
  mintInput,
  onChangeMintInput,
  defaultAgentPubkey,
  onInitializeVault,
  onUpdatePolicy,
  onAddRecipient,
  onDeposit,
  onToggleFreeze,
  busyAction,
  freezing,
  errorMessage,
  onDismissWizard,
  onCompleteAndStartTour,
}: OnboardingWizardProps) {
  const [agentInput, setAgentInput] = useState(defaultAgentPubkey);
  const [maxPerTxInput, setMaxPerTxInput] = useState("10");
  const [dailyLimitInput, setDailyLimitInput] = useState("50");
  const [recipientInput, setRecipientInput] = useState(
    FRONTEND_CONFIG.demoRecipient
  );
  const [depositInput, setDepositInput] = useState("25");

  useEffect(() => {
    if (!agentInput.trim() && defaultAgentPubkey) {
      setAgentInput(defaultAgentPubkey);
    }
  }, [agentInput, defaultAgentPubkey]);

  const step1Done = Boolean(connectedWallet);
  const step2Done = Boolean(vault);
  const step3Done = Boolean(vault && isAuthenticated);
  const step4Done = Boolean(vault && vault.recipientCount > 0);
  const step5Done = Boolean(
    vault && !vault.isFrozen && vault.vaultTokenBalance > 0n && isAuthenticated
  );

  const completionMap: Record<number, boolean> = {
    1: step1Done,
    2: step2Done,
    3: step3Done,
    4: step4Done,
    5: step5Done,
  };

  const firstPending = STEP_META.find((s) => !completionMap[s.id])?.id ?? 5;
  const [activeStep, setActiveStep] = useState<number>(firstPending);

  useEffect(() => {
    setActiveStep(firstPending);
  }, [firstPending]);

  const currentMeta =
    STEP_META.find((s) => s.id === activeStep) ?? STEP_META[0];
  const CurrentIcon = currentMeta.icon;
  const completedCount = Object.values(completionMap).filter(Boolean).length;
  const progressPct = Math.round((completedCount / STEP_META.length) * 100);

  return (
    <section
      aria-label="Asistente de configuración guiada"
      className="rounded-xl border border-kipu-gold/40 bg-kipu-card p-4 shadow-lg transition-all"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-kipu-border pb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded bg-kipu-gold/15 px-2 py-0.5 text-[11px] font-semibold text-kipu-gold">
              Asistente guiado · {completedCount}/5 listos
            </span>
            <span className="rounded border border-kipu-border bg-kipu-bg px-2 py-0.5 text-[11px] text-zinc-300">
              Solana Devnet · Mock USDC
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            Sigue estos 5 pasos para dejar tu bóveda protegida y lista para
            operar.
          </p>
        </div>

        <button
          type="button"
          onClick={onDismissWizard}
          className="inline-flex items-center gap-1 rounded-md border border-kipu-border bg-kipu-bg px-2.5 py-1 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
          Minimizar asistente
        </button>
      </div>

      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full bg-kipu-emerald transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="mb-3 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
        {STEP_META.map((step) => {
          const done = completionMap[step.id];
          const isCurrent = step.id === activeStep;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => setActiveStep(step.id)}
              className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-left text-xs transition ${
                isCurrent
                  ? "border-kipu-gold bg-kipu-gold/15 font-semibold text-kipu-gold"
                  : done
                    ? "border-kipu-emerald/40 bg-kipu-emerald/10 text-kipu-emerald"
                    : "border-kipu-border bg-kipu-bg text-zinc-300 hover:border-zinc-600"
              }`}
            >
              <span className="truncate">{step.short}</span>
              <span>{done ? "✓" : isCurrent ? "•" : ""}</span>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-kipu-border bg-kipu-bg p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-kipu-gold/40 bg-kipu-gold/10 text-kipu-gold">
              <CurrentIcon className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">
                {currentMeta.title}
              </h3>
              <p className="mt-0.5 text-xs text-zinc-300">
                {currentMeta.explanation}
              </p>
            </div>
          </div>

          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
              completionMap[activeStep]
                ? "border-kipu-emerald/50 bg-kipu-emerald/15 text-kipu-emerald"
                : "border-kipu-gold/40 bg-kipu-gold/10 text-kipu-gold"
            }`}
          >
            {completionMap[activeStep] ? "Completado" : "Pendiente"}
          </span>
        </div>

        {errorMessage && (
          <div className="mb-3 rounded-lg border border-kipu-crimson/50 bg-kipu-crimson/10 px-3 py-2 text-xs text-red-200">
            {errorMessage}
          </div>
        )}

        {activeStep === 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            {connectedWallet ? (
              <div className="flex items-center gap-2 text-xs text-kipu-emerald">
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  Wallet conectada:{" "}
                  <code className="font-mono text-zinc-100">
                    {truncateMiddle(connectedWallet, 8, 6)}
                  </code>
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <WalletMultiButton />
                <span className="text-xs text-zinc-400">
                  Usa Phantom o Solflare en red Solana Devnet.
                </span>
              </div>
            )}
            <button
              type="button"
              disabled={!step1Done}
              onClick={() => setActiveStep(2)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-kipu-gold px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              Continuar <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {activeStep === 2 && (
          <div className="space-y-3">
            {vault ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-kipu-emerald">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>
                    Bóveda activa en Solana:{" "}
                    <code className="font-mono text-zinc-100">
                      {truncateMiddle(vault.address, 8, 6)}
                    </code>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveStep(3)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-kipu-gold px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400"
                >
                  Continuar <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-zinc-300">
                    Token (Mock USDC Devnet)
                  </label>
                  <input
                    type="text"
                    value={mintInput}
                    onChange={(e) => onChangeMintInput(e.target.value)}
                    className="w-full rounded border border-kipu-border bg-kipu-card px-2.5 py-1.5 font-mono text-xs text-zinc-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-300">
                    Agente operativo autorizado
                  </label>
                  <input
                    type="text"
                    value={agentInput}
                    onChange={(e) => setAgentInput(e.target.value)}
                    className="w-full rounded border border-kipu-border bg-kipu-card px-2.5 py-1.5 font-mono text-xs text-zinc-100"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 sm:col-span-2">
                  <button
                    type="button"
                    disabled={
                      !connectedWallet ||
                      !isValidSolanaPubkey(mintInput) ||
                      !isValidSolanaPubkey(agentInput) ||
                      busyAction !== null
                    }
                    onClick={() =>
                      void onInitializeVault({
                        mint: mintInput,
                        agent: agentInput,
                        maxPerTxUsdc: maxPerTxInput,
                        dailyLimitUsdc: dailyLimitInput,
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg bg-kipu-gold px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
                  >
                    {busyAction === "initialize"
                      ? "Creando bóveda..."
                      : "Crear mi bóveda on-chain"}
                  </button>
                  <span className="text-xs text-zinc-400">
                    Requiere aprobar 1 transacción en Phantom.
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {activeStep === 3 && (
          <div className="space-y-3">
            {vault && (
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded border border-kipu-border bg-kipu-card px-3 py-2 text-xs">
                  <span className="block text-zinc-400">Tope por operación</span>
                  <span className="font-mono font-semibold text-kipu-gold">
                    {formatBaseUnitsAsUsdc(vault.maxPerTx, 2)} Mock USDC
                  </span>
                </div>
                <div className="rounded border border-kipu-border bg-kipu-card px-3 py-2 text-xs">
                  <span className="block text-zinc-400">Límite diario (24h)</span>
                  <span className="font-mono font-semibold text-zinc-100">
                    {formatBaseUnitsAsUsdc(vault.dailyLimit, 2)} Mock USDC
                  </span>
                </div>
                <div className="rounded border border-kipu-border bg-kipu-card px-3 py-2 text-xs">
                  <span className="block text-zinc-400">Sesión de propietario</span>
                  <span
                    className={`font-semibold ${
                      isAuthenticated ? "text-kipu-emerald" : "text-kipu-gold"
                    }`}
                  >
                    {isAuthenticated ? "Verificada (SIWS)" : "Falta firmar"}
                  </span>
                </div>
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-3">
              <input
                type="text"
                value={maxPerTxInput}
                onChange={(e) => setMaxPerTxInput(e.target.value)}
                placeholder="Nuevo tope / tx"
                aria-label="Nuevo tope por transacción"
                className="rounded border border-kipu-border bg-kipu-card px-2.5 py-1.5 font-mono text-xs text-zinc-100"
              />
              <input
                type="text"
                value={dailyLimitInput}
                onChange={(e) => setDailyLimitInput(e.target.value)}
                placeholder="Nuevo límite diario"
                aria-label="Nuevo límite diario"
                className="rounded border border-kipu-border bg-kipu-card px-2.5 py-1.5 font-mono text-xs text-zinc-100"
              />
              <button
                type="button"
                disabled={!vault || busyAction !== null}
                onClick={() =>
                  void onUpdatePolicy({
                    newAgent: "",
                    newMaxPerTxUsdc: maxPerTxInput,
                    newDailyLimitUsdc: dailyLimitInput,
                  })
                }
                className="rounded-lg border border-kipu-border bg-kipu-card px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-kipu-gold/60 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busyAction === "update_policy"
                  ? "Actualizando..."
                  : "Actualizar límites (opcional)"}
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              {!isAuthenticated ? (
                <button
                  type="button"
                  disabled={!vault || signingIn}
                  onClick={() => void onSignIn()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-kipu-gold px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  {signingIn
                    ? "Firmando..."
                    : "Firmar autorización de sesión (SIWS)"}
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-kipu-emerald">
                  <CheckCircle2 className="h-4 w-4" />
                  Sesión SIWS autorizada correctamente.
                </span>
              )}

              <button
                type="button"
                disabled={!step3Done}
                onClick={() => setActiveStep(4)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-kipu-gold px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
              >
                Continuar <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {activeStep === 4 && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value)}
                placeholder="Dirección Solana permitida (base58)"
                aria-label="Dirección Solana permitida"
                className="min-w-0 flex-1 rounded border border-kipu-border bg-kipu-card px-2.5 py-1.5 font-mono text-xs text-zinc-100"
              />
              <button
                type="button"
                disabled={
                  !vault ||
                  !isValidSolanaPubkey(recipientInput) ||
                  vault.allowedRecipients.includes(recipientInput.trim()) ||
                  busyAction !== null
                }
                onClick={() => void onAddRecipient(recipientInput)}
                className="rounded-lg border border-kipu-gold/50 bg-kipu-gold/15 px-3 py-1.5 text-xs font-semibold text-kipu-gold hover:bg-kipu-gold/25 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-500"
              >
                {busyAction === "add_recipient"
                  ? "Agregando..."
                  : "Autorizar destinatario"}
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-zinc-300">
                Wallets autorizadas actualmente:{" "}
                <strong className="text-zinc-100">
                  {vault?.recipientCount ?? 0} / 8
                </strong>
              </span>
              <button
                type="button"
                disabled={!step4Done}
                onClick={() => setActiveStep(5)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-kipu-gold px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
              >
                Continuar <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {activeStep === 5 && (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded border border-kipu-border bg-kipu-card p-2.5 text-xs">
                <span className="block text-zinc-400">Saldo en bóveda</span>
                <span className="font-mono text-sm font-semibold text-zinc-100">
                  {vault
                    ? formatBaseUnitsAsUsdc(vault.vaultTokenBalance, 2)
                    : "0.00"}{" "}
                  Mock USDC
                </span>
                {vault && vault.vaultTokenBalance === 0n && (
                  <div className="mt-2 flex gap-1.5">
                    <input
                      type="text"
                      value={depositInput}
                      onChange={(e) => setDepositInput(e.target.value)}
                      className="w-20 rounded border border-kipu-border bg-kipu-bg px-2 py-1 font-mono text-xs text-zinc-100"
                    />
                    <button
                      type="button"
                      disabled={busyAction !== null}
                      onClick={() => void onDeposit(depositInput)}
                      className="rounded bg-kipu-emerald px-2.5 py-1 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-40"
                    >
                      {busyAction === "deposit" ? "..." : "Depositar"}
                    </button>
                  </div>
                )}
              </div>

              <div className="rounded border border-kipu-border bg-kipu-card p-2.5 text-xs">
                <span className="block text-zinc-400">Estado de protección</span>
                <span
                  className={`font-semibold ${
                    vault?.isFrozen ? "text-kipu-crimson" : "text-kipu-emerald"
                  }`}
                >
                  {vault?.isFrozen
                    ? "Congelada (el agente está bloqueado)"
                    : "Activa y operando dentro de reglas"}
                </span>
                {vault?.isFrozen && (
                  <button
                    type="button"
                    disabled={freezing}
                    onClick={() => void onToggleFreeze()}
                    className="mt-2 inline-flex items-center gap-1 rounded bg-kipu-emerald px-2.5 py-1 text-xs font-semibold text-zinc-950 hover:bg-emerald-400"
                  >
                    <Lock className="h-3 w-3" />
                    {freezing ? "Descongelando..." : "Activar bóveda"}
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-zinc-300">
                {step5Done
                  ? "¡Todo listo! Tu bóveda está protegida con reglas reales en Solana Devnet."
                  : "Completa saldo > 0 y estado Activa para finalizar."}
              </span>
              <button
                type="button"
                disabled={!step5Done}
                onClick={onCompleteAndStartTour}
                className="inline-flex items-center gap-1.5 rounded-lg bg-kipu-emerald px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Finalizar y ver recorrido guiado
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
