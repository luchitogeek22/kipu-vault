"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { KeyRound, ShieldAlert, ShieldCheck, Snowflake } from "lucide-react";
import { formatBaseUnitsAsUsdc } from "@/lib/format";
import type { DecodedVaultState } from "@/lib/kipuVault";

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
}: TopBarProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isOwner = Boolean(
    connectedWallet && vault && connectedWallet === vault.owner
  );

  return (
    <header className="border-b border-kipu-border bg-kipu-card/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-kipu-gold/40 bg-kipu-gold/10 text-kipu-gold">
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M4 6h16" strokeLinecap="round" />
              <path d="M8 6v11M12 6v13M16 6v9" strokeLinecap="round" />
              <circle cx="8" cy="11" r="1.4" fill="currentColor" />
              <circle cx="12" cy="14" r="1.4" fill="currentColor" />
              <circle cx="16" cy="10" r="1.4" fill="currentColor" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight text-zinc-100">
                KipuVault
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-kipu-gold/40 bg-kipu-gold/10 px-2 py-0.5 font-mono text-[11px] font-medium text-kipu-gold">
                <span className="h-1.5 w-1.5 rounded-full bg-kipu-gold" />
                Devnet
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Guardrails on-chain en Solana · Limita el radio de daño del agente
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {agentSolBalance !== null && (
            <div
              className={`rounded-lg border px-3 py-1.5 font-mono text-xs ${
                lowSolWarning
                  ? "border-kipu-crimson/60 bg-kipu-crimson/10 text-kipu-crimson"
                  : "border-kipu-border bg-kipu-bg text-zinc-300"
              }`}
            >
              Agente SOL: {Number(agentSolBalance).toFixed(3)}
              {lowSolWarning ? " (¡Recargar Devnet SOL!)" : ""}
            </div>
          )}

          <div className="rounded-lg border border-kipu-border bg-kipu-bg px-3 py-1.5">
            <span className="block text-[10px] uppercase tracking-wider text-zinc-500">
              Balance de la bóveda
            </span>
            <span className="font-mono text-sm font-semibold text-zinc-100">
              {vault ? formatBaseUnitsAsUsdc(vault.vaultTokenBalance, 2) : "0.00"}{" "}
              <span className="text-kipu-gold">Mock USDC</span>
            </span>
          </div>

          <button
            type="button"
            disabled={!connectedWallet || !vault || signingIn}
            onClick={() => void onSignIn()}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition ${
              isAuthenticated
                ? "border-kipu-emerald/50 bg-kipu-emerald/15 text-kipu-emerald"
                : "border-kipu-gold/50 bg-kipu-gold/15 text-kipu-gold hover:bg-kipu-gold/25 disabled:cursor-not-allowed disabled:opacity-40"
            }`}
          >
            {isAuthenticated ? (
              <>
                <ShieldCheck className="h-4 w-4" />
                Sesión SIWS activa
              </>
            ) : (
              <>
                <KeyRound className="h-4 w-4" />
                {signingIn ? "Firmando..." : "Iniciar sesión"}
              </>
            )}
          </button>

          <button
            type="button"
            disabled={!isOwner || freezing}
            onClick={() => void onToggleFreeze()}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
              vault?.isFrozen
                ? "border-kipu-crimson bg-kipu-crimson text-white hover:bg-red-600"
                : "border-kipu-crimson/50 bg-kipu-crimson/15 text-kipu-crimson hover:bg-kipu-crimson/25 disabled:cursor-not-allowed disabled:opacity-40"
            }`}
          >
            {vault?.isFrozen ? (
              <>
                <Snowflake className="h-4 w-4" />
                {freezing ? "Procesando..." : "Freeze ACTIVO (Descongelar)"}
              </>
            ) : (
              <>
                <ShieldAlert className="h-4 w-4" />
                {freezing ? "Procesando..." : "Emergency Freeze"}
              </>
            )}
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
