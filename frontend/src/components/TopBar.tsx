"use client";

import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  HelpCircle,
  KeyRound,
  ShieldCheck,
  SlidersHorizontal,
  Snowflake,
  Wrench,
} from "lucide-react";
import { formatBaseUnitsAsUsdc } from "@/lib/format";
import type { DecodedVaultState } from "@/lib/kipuVault";
import { EXPERIENCE_LEVEL_META, type ExperienceLevel } from "@/lib/ux";

const WalletMultiButton = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

interface TopBarProps {
  connectedWallet: string | null;
  isAuthenticated: boolean;
  signingIn: boolean;
  onSignIn: () => Promise<void>;
  vault: DecodedVaultState | null;
  freezing: boolean;
  onToggleFreeze: () => Promise<void>;
  agentSolBalance: string | null;
  lowSolWarning: boolean;
  experienceLevel: ExperienceLevel;
  onChangeExperienceLevel: (level: ExperienceLevel) => void;
  onOpenHelp: () => void;
  showWizardButton: boolean;
  onOpenWizard: () => void;
}

export function TopBar({
  connectedWallet,
  isAuthenticated,
  signingIn,
  onSignIn,
  vault,
  freezing,
  onToggleFreeze,
  agentSolBalance,
  lowSolWarning,
  experienceLevel,
  onChangeExperienceLevel,
  onOpenHelp,
  showWizardButton,
  onOpenWizard,
}: TopBarProps) {
  const [mounted, setMounted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        settingsRef.current &&
        !settingsRef.current.contains(e.target as Node)
      ) {
        setSettingsOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSettingsOpen(false);
    };
    window.addEventListener("mousedown", handleOutside);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("keydown", handleKey);
    };
  }, [settingsOpen]);

  const isOwner = Boolean(
    connectedWallet && vault && connectedWallet === vault.owner
  );

  return (
    <header className="border-b border-kipu-border bg-kipu-card/95 shadow-lg shadow-black/20 backdrop-blur">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-kipu-gold/40 bg-kipu-gold/10 text-kipu-gold">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-lg font-bold tracking-tight text-white">
                kipuvault<span className="text-kipu-gold">.</span>
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-kipu-bg px-2 py-0.5 font-mono text-[11px] font-medium text-zinc-200">
                <span className="h-1.5 w-1.5 rounded-full bg-kipu-emerald" />
                Solana Devnet
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                  !vault
                    ? "border-zinc-700 bg-kipu-bg text-zinc-300"
                    : vault.isFrozen
                      ? "border-sky-400/60 bg-sky-500/15 text-sky-200"
                      : "border-kipu-emerald/50 bg-kipu-emerald/15 text-kipu-emerald"
                }`}
              >
                {vault?.isFrozen ? (
                  <>
                    <Snowflake className="h-3 w-3 text-sky-300" />
                    Freeze Activo
                  </>
                ) : vault ? (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-kipu-emerald" />
                    Protegida
                  </>
                ) : (
                  "Sandbox Demo"
                )}
              </span>
            </div>
            <p className="text-[11px] text-zinc-300">
              Web3 AI Security Vault · Guardrails On-Chain
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            data-tour="agent-sol"
            title="Saldo SOL del agente operativo para cubrir comisiones de transacción en Solana Devnet"
            className={`rounded-lg border px-2.5 py-1.5 font-mono text-xs ${
              lowSolWarning
                ? "border-kipu-crimson/60 bg-kipu-crimson/10 text-kipu-crimson"
                : "border-kipu-border bg-kipu-bg text-zinc-200"
            }`}
          >
            Agente SOL:{" "}
            {agentSolBalance !== null
              ? Number(agentSolBalance).toFixed(3)
              : "—"}
            {lowSolWarning ? " (!)" : ""}
          </div>

          {vault && (
            <div className="hidden rounded-lg border border-kipu-border bg-kipu-bg px-2.5 py-1 sm:block">
              <span className="block text-[10px] uppercase tracking-wider text-zinc-400">
                Vault Balance
              </span>
              <span className="font-mono text-xs font-semibold text-zinc-100">
                {formatBaseUnitsAsUsdc(vault.vaultTokenBalance, 2)}{" "}
                <span className="text-zinc-300">Mock USDC</span>
              </span>
            </div>
          )}

          <button
            type="button"
            disabled={!connectedWallet || !vault || signingIn}
            onClick={() => void onSignIn()}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
              isAuthenticated
                ? "border-kipu-emerald/60 bg-kipu-emerald/15 text-kipu-emerald"
                : "border-kipu-gold bg-kipu-gold text-zinc-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-800/70 disabled:text-zinc-500"
            }`}
          >
            {isAuthenticated ? (
              <>
                <ShieldCheck className="h-4 w-4" />
                Sesión SIWS
              </>
            ) : (
              <>
                <KeyRound className="h-4 w-4" />
                {signingIn ? "Firmando..." : "Iniciar sesión"}
              </>
            )}
          </button>

          {vault && (
            <button
              type="button"
              disabled={!isOwner || freezing}
              onClick={() => void onToggleFreeze()}
              title="Emergency Freeze: detiene únicamente al agente on-chain; tus fondos siguen bajo tu control"
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold transition ${
                vault.isFrozen
                  ? "border-kipu-emerald/60 bg-kipu-emerald/15 text-kipu-emerald hover:bg-kipu-emerald/25"
                  : "border-sky-400/60 bg-sky-500/15 text-sky-200 hover:bg-sky-500/25"
              } disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-800/70 disabled:text-zinc-500`}
            >
              <Snowflake className="h-3.5 w-3.5 text-sky-300" />
              {freezing
                ? "Procesando..."
                : vault.isFrozen
                  ? "Descongelar"
                  : "Congelar"}
            </button>
          )}

          {showWizardButton && (
            <button
              type="button"
              onClick={onOpenWizard}
              className="inline-flex items-center gap-1.5 rounded-lg border border-kipu-border bg-kipu-bg px-2.5 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white"
            >
              <Wrench className="h-3.5 w-3.5 text-zinc-300" />
              <span className="hidden sm:inline">Asistente</span>
            </button>
          )}

          {/* Experience level configuration menu */}
          <div ref={settingsRef} className="relative">
            <button
              type="button"
              aria-expanded={settingsOpen}
              aria-haspopup="menu"
              onClick={() => setSettingsOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-kipu-border bg-kipu-bg px-2.5 py-2 text-xs font-medium text-zinc-200 transition hover:border-kipu-gold/60"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-kipu-gold" />
              <span className="hidden md:inline">
                {EXPERIENCE_LEVEL_META[experienceLevel].label}
              </span>
            </button>

            {settingsOpen && (
              <div
                role="menu"
                aria-label="Nivel de experiencia"
                className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-kipu-border bg-kipu-card p-2 shadow-2xl"
              >
                <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  Nivel de interfaz
                </p>
                {(
                  ["beginner", "intermediate", "advanced"] as ExperienceLevel[]
                ).map((lvl) => {
                  const meta = EXPERIENCE_LEVEL_META[lvl];
                  const active = lvl === experienceLevel;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      role="menuitemradio"
                      aria-checked={active}
                      onClick={() => {
                        onChangeExperienceLevel(lvl);
                        setSettingsOpen(false);
                      }}
                      className={`mt-1 w-full rounded-lg border px-2.5 py-2 text-left transition ${
                        active
                          ? "border-kipu-gold/60 bg-kipu-gold/15 text-zinc-100"
                          : "border-transparent text-zinc-300 hover:bg-kipu-bg"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span>{meta.label}</span>
                        {active && <span className="text-kipu-gold">✓</span>}
                      </div>
                      <p className="mt-0.5 text-[11px] text-zinc-400">
                        {meta.shortDesc}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Permanent Contextual Help button */}
          <button
            type="button"
            onClick={onOpenHelp}
            className="inline-flex items-center gap-1.5 rounded-lg border border-kipu-gold/40 bg-kipu-gold/10 px-3 py-2 text-xs font-semibold text-kipu-gold transition hover:bg-kipu-gold/20"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            Ayuda
          </button>

          {mounted ? (
            <WalletMultiButton />
          ) : (
            <div className="h-10 w-36 rounded-lg border border-kipu-border bg-kipu-bg" />
          )}
        </div>
      </div>
    </header>
  );
}
