"use client";

import React from "react";
import {
  Activity,
  AlertTriangle,
  Ban,
  Gauge,
  ShieldAlert,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import type { AuditLogEntry } from "@/lib/api";
import { formatBaseUnitsAsUsdc } from "@/lib/format";
import type { DecodedVaultState } from "@/lib/kipuVault";
import type { ExperienceLevel } from "@/lib/ux";
import { InfoTooltip, SkeletonBlock } from "./InfoTooltip";

interface DashboardOverviewProps {
  vault: DecodedVaultState | null;
  loadingVault: boolean;
  connectedWallet: string | null;
  isAuthenticated: boolean;
  lowSolWarning: boolean;
  auditEntries: AuditLogEntry[];
  experienceLevel: ExperienceLevel;
}

function formatShortTime(iso: string): string {
  try {
    const dt = new Date(iso);
    return dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "Reciente";
  }
}

export function DashboardOverview({
  vault,
  loadingVault,
  connectedWallet,
  isAuthenticated,
  lowSolWarning,
  auditEntries,
  experienceLevel,
}: DashboardOverviewProps) {
  const blockedCount = auditEntries.filter(
    (e) =>
      e.status === "BLOCKED_ONCHAIN" ||
      e.status === "BLOCKED_PREFLIGHT" ||
      e.status === "REJECTED_BY_AI"
  ).length;

  const remainingDaily =
    vault && vault.dailyLimit > vault.spentToday
      ? vault.dailyLimit - vault.spentToday
      : 0n;

  const latest = auditEntries[0];

  let securityState: "ok" | "warning" | "danger" = "ok";
  let securityHeadline =
    "Tu bóveda está protegida y operando dentro de las políticas configuradas.";

  if (!connectedWallet) {
    securityState = "ok";
    securityHeadline =
      "Demo interactiva lista: prueba los 4 escenarios en Kipu AI Copilot ahora mismo. Conecta tu wallet para operar tu bóveda real en Solana Devnet.";
  } else if (!vault) {
    securityState = "warning";
    securityHeadline =
      "Wallet conectada. Puedes usar el Sandbox en Copilot o crear tu bóveda real en Políticas On-Chain.";
  } else if (vault.isFrozen) {
    securityState = "danger";
    securityHeadline =
      "Protección de emergencia activa (Freeze): el agente no puede ejecutar pagos hasta que descongeles.";
  } else if (lowSolWarning) {
    securityState = "warning";
    securityHeadline =
      "Advertencia: el agente tiene poco SOL en Devnet para pagar comisiones de red.";
  } else if (vault.recipientCount === 0) {
    securityState = "warning";
    securityHeadline =
      "Tu Allowlist está vacía: ningún agente podrá transferir fondos hasta que autorices una dirección.";
  } else if (!isAuthenticated) {
    securityState = "ok";
    securityHeadline =
      "Bóveda lista on-chain. Prueba el Sandbox en Copilot o firma SIWS arriba cuando quieras ejecutar transacciones reales.";
  }

  return (
    <section
      data-tour="vault-summary"
      aria-label="Resumen de seguridad de la bóveda"
      className="space-y-2.5"
    >
      <div
        className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-xs ${
          securityState === "ok"
            ? "border-kipu-emerald/45 bg-kipu-emerald/10 text-emerald-100"
            : securityState === "danger"
              ? "border-kipu-crimson/60 bg-kipu-crimson/10 text-red-100"
              : "border-kipu-gold/45 bg-kipu-gold/10 text-amber-100"
        }`}
      >
        <div className="flex items-center gap-2">
          {securityState === "ok" ? (
            <ShieldCheck className="h-4 w-4 shrink-0 text-kipu-emerald" />
          ) : securityState === "danger" ? (
            <ShieldAlert className="h-4 w-4 shrink-0 text-kipu-crimson" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 text-kipu-gold" />
          )}
          <span className="font-medium">{securityHeadline}</span>
        </div>

        <span className="rounded border border-white/10 bg-black/25 px-2 py-0.5 font-mono text-[11px] text-zinc-200">
          Red: Solana Devnet (Mock USDC)
        </span>
      </div>

      {experienceLevel !== "advanced" && (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-xl border border-kipu-border bg-kipu-card p-3 transition hover:border-zinc-600">
            <div className="flex items-center justify-between text-xs text-zinc-300">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <ShieldCheck className="h-3.5 w-3.5 text-kipu-emerald" />
                Estado de protección
              </span>
              <InfoTooltip text="Indica si las reglas on-chain permiten operar al agente o si la bóveda está congelada." />
            </div>
            {loadingVault ? (
              <SkeletonBlock className="mt-2 h-5 w-20" />
            ) : (
              <p
                className={`mt-1.5 text-sm font-bold ${
                  !vault
                    ? "text-zinc-300"
                    : vault.isFrozen
                      ? "text-kipu-crimson"
                      : "text-kipu-emerald"
                }`}
              >
                {!vault ? "Sin bóveda" : vault.isFrozen ? "Congelada" : "Protegida"}
              </p>
            )}
            <p className="mt-0.5 text-[11px] text-zinc-400">
              {vault?.isFrozen ? "Agente bloqueado" : "Guardrails activos"}
            </p>
          </div>

          <div className="rounded-xl border border-kipu-border bg-kipu-card p-3 transition hover:border-zinc-600">
            <div className="flex items-center justify-between text-xs text-zinc-300">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Wallet className="h-3.5 w-3.5 text-kipu-gold" />
                Saldo de la bóveda
              </span>
              <InfoTooltip text="Fondos depositados bajo custodia de tu bóveda. Solo tú puedes retirarlos sin límites." />
            </div>
            {loadingVault ? (
              <SkeletonBlock className="mt-2 h-5 w-24" />
            ) : (
              <p className="mt-1.5 font-mono text-sm font-bold text-zinc-100">
                {vault
                  ? `${formatBaseUnitsAsUsdc(vault.vaultTokenBalance, 2)} USDC`
                  : "0.00 USDC"}
              </p>
            )}
            <p className="mt-0.5 text-[11px] text-zinc-400">
              Mock USDC en Devnet
            </p>
          </div>

          <div className="rounded-xl border border-kipu-border bg-kipu-card p-3 transition hover:border-zinc-600">
            <div className="flex items-center justify-between text-xs text-zinc-300">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Gauge className="h-3.5 w-3.5 text-kipu-gold" />
                Límite disponible
              </span>
              <InfoTooltip text="Cuánto más puede gastar el agente dentro de la ventana actual de 24 horas." />
            </div>
            {loadingVault ? (
              <SkeletonBlock className="mt-2 h-5 w-24" />
            ) : (
              <p className="mt-1.5 font-mono text-sm font-bold text-zinc-100">
                {vault
                  ? `${formatBaseUnitsAsUsdc(remainingDaily, 2)} / ${formatBaseUnitsAsUsdc(vault.dailyLimit, 0)}`
                  : "—"}
              </p>
            )}
            <p className="mt-0.5 text-[11px] text-zinc-400">
              {vault
                ? `Tope por pago: ${formatBaseUnitsAsUsdc(vault.maxPerTx, 0)} USDC`
                : "Sin límite fijado"}
            </p>
          </div>

          <div className="rounded-xl border border-kipu-border bg-kipu-card p-3 transition hover:border-zinc-600">
            <div className="flex items-center justify-between text-xs text-zinc-300">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Ban className="h-3.5 w-3.5 text-kipu-crimson" />
                Bloqueadas
              </span>
              <InfoTooltip text="Intentos peligrosos o fuera de política detenidos automáticamente antes de mover fondos." />
            </div>
            <p className="mt-1.5 font-mono text-sm font-bold text-zinc-100">
              {blockedCount}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-400">
              {isAuthenticated
                ? "Amenazas frenadas"
                : "Inicia sesión para ver"}
            </p>
          </div>

          <div className="rounded-xl border border-kipu-border bg-kipu-card p-3 transition hover:border-zinc-600">
            <div className="flex items-center justify-between text-xs text-zinc-300">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Users className="h-3.5 w-3.5 text-kipu-emerald" />
                Allowlist
              </span>
              <InfoTooltip text="Cantidad de cuentas destino aprobadas por ti. El agente no puede enviar a otras." />
            </div>
            {loadingVault ? (
              <SkeletonBlock className="mt-2 h-5 w-16" />
            ) : (
              <p className="mt-1.5 font-mono text-sm font-bold text-zinc-100">
                {vault ? `${vault.recipientCount} / 8` : "0 / 8"}
              </p>
            )}
            <p className="mt-0.5 text-[11px] text-zinc-400">
              Wallets autorizadas
            </p>
          </div>

          <div className="rounded-xl border border-kipu-border bg-kipu-card p-3 transition hover:border-zinc-600">
            <div className="flex items-center justify-between text-xs text-zinc-300">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Activity className="h-3.5 w-3.5 text-kipu-gold" />
                Última actividad
              </span>
              <InfoTooltip text="Resultado y hora de la operación más reciente evaluada en tu bóveda." />
            </div>
            <p className="mt-1.5 truncate font-mono text-sm font-bold text-zinc-100">
              {latest ? latest.status : "Sin actividad"}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-400">
              {latest
                ? `${formatShortTime(latest.created_at)} · ${
                    latest.amount_base_units
                      ? `${formatBaseUnitsAsUsdc(latest.amount_base_units, 2)} USDC`
                      : "0 USDC"
                  }`
                : "Sin registros aún"}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
