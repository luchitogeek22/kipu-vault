"use client";

import React from "react";
import {
  Activity,
  Ban,
  BarChart3,
  ChevronDown,
  Gauge,
  ShieldAlert,
  ShieldCheck,
  Snowflake,
  TrendingDown,
  TrendingUp,
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
  const executedCount = auditEntries.filter(
    (e) => e.status === "EXECUTED"
  ).length;
  const blockedCount = auditEntries.filter(
    (e) =>
      e.status === "BLOCKED_ONCHAIN" ||
      e.status === "BLOCKED_PREFLIGHT" ||
      e.status === "REJECTED_BY_AI"
  ).length;
  const totalRealEvents = auditEntries.length;
  const blockedRatioPct =
    totalRealEvents > 0 ? Math.round((blockedCount / totalRealEvents) * 100) : 0;

  const remainingDaily =
    vault && vault.dailyLimit > vault.spentToday
      ? vault.dailyLimit - vault.spentToday
      : 0n;
  const dailyUsedPct =
    vault && vault.dailyLimit > 0n
      ? Math.min(100, Number((vault.spentToday * 100n) / vault.dailyLimit))
      : 0;

  const latest = auditEntries[0];

  let securityState: "ok" | "freeze" | "warning" | "danger" = "ok";
  let securityHeadline =
    "Tu bóveda está protegida y operando dentro de las políticas on-chain.";

  if (!connectedWallet) {
    securityState = "ok";
    securityHeadline =
      "Demo interactiva lista abajo: prueba pago permitido, ataque y Freeze al instante. Conecta Phantom cuando quieras operar en Devnet.";
  } else if (!vault) {
    securityState = "warning";
    securityHeadline =
      "Wallet conectada. Crea tu bóveda real en Vault Protection Center (derecha) o prueba el Sandbox en Copilot.";
  } else if (vault.isFrozen) {
    securityState = "freeze";
    securityHeadline =
      "Emergency Freeze activo: el agente quedó detenido on-chain hasta que descongeles.";
  } else if (lowSolWarning) {
    securityState = "danger";
    securityHeadline =
      "Advertencia: el agente tiene poco SOL en Devnet para pagar comisiones de red.";
  } else if (vault.recipientCount === 0) {
    securityState = "warning";
    securityHeadline =
      "Allowlist vacía: autoriza al menos una wallet destino en Vault Protection Center antes de operar.";
  } else if (!isAuthenticated) {
    securityState = "ok";
    securityHeadline =
      "Bóveda activa on-chain. Prueba el Sandbox abajo o firma SIWS arriba para ejecutar transacciones reales en Devnet.";
  }

  return (
    <section
      data-tour="vault-summary"
      aria-label="Security Overview"
      className="space-y-2.5"
    >
      <div
        className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2 text-xs shadow-sm ${
          securityState === "ok"
            ? "border-kipu-emerald/45 bg-kipu-emerald/10 text-emerald-100"
            : securityState === "freeze"
              ? "border-sky-400/60 bg-sky-500/15 text-sky-100"
              : securityState === "danger"
                ? "border-kipu-crimson/60 bg-kipu-crimson/10 text-red-100"
                : "border-zinc-700 bg-kipu-card text-zinc-200"
        }`}
      >
        <div className="flex items-center gap-2">
          {securityState === "ok" ? (
            <ShieldCheck className="h-4 w-4 shrink-0 text-kipu-emerald" />
          ) : securityState === "freeze" ? (
            <Snowflake className="h-4 w-4 shrink-0 text-sky-300" />
          ) : securityState === "danger" ? (
            <ShieldAlert className="h-4 w-4 shrink-0 text-kipu-crimson" />
          ) : (
            <ShieldCheck className="h-4 w-4 shrink-0 text-zinc-300" />
          )}
          <span className="font-medium">{securityHeadline}</span>
        </div>

        <span className="rounded border border-white/10 bg-black/30 px-2 py-0.5 font-mono text-[11px] text-zinc-200">
          {vault ? "On-Chain Devnet" : "Sandbox Local · Devnet Ready"}
        </span>
      </div>

      {experienceLevel !== "advanced" && (
        <div className="space-y-2">
          {/* Fila superior: 3 métricas clave de Security Overview */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {/* Protection Status */}
            <div className="rounded-xl border border-kipu-border bg-kipu-card p-3.5 shadow-sm transition hover:border-zinc-600">
              <div className="flex items-center justify-between text-xs text-zinc-300">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  {vault?.isFrozen ? (
                    <Snowflake className="h-3.5 w-3.5 text-sky-300" />
                  ) : (
                    <ShieldCheck className="h-3.5 w-3.5 text-kipu-emerald" />
                  )}
                  Protection Status
                </span>
                <InfoTooltip text="Indica si las reglas on-chain permiten operar al agente o si Emergency Freeze está activo." />
              </div>
              {loadingVault ? (
                <SkeletonBlock className="mt-2 h-5 w-24" />
              ) : (
                <div className="mt-1.5 flex items-baseline justify-between gap-2">
                  <p
                    className={`font-display text-base font-bold ${
                      !vault
                        ? "text-zinc-100"
                        : vault.isFrozen
                          ? "text-sky-300"
                          : "text-kipu-emerald"
                    }`}
                  >
                    {!vault
                      ? "Modo Sandbox"
                      : vault.isFrozen
                        ? "Freeze Activo"
                        : "Protegida"}
                  </p>
                  {totalRealEvents > 0 && (
                    <span className="inline-flex items-center gap-1 rounded bg-kipu-emerald/15 px-1.5 py-0.5 font-mono text-[10px] text-emerald-200">
                      <TrendingUp className="h-3 w-3" />
                      {executedCount} ok
                    </span>
                  )}
                </div>
              )}
              <p className="mt-0.5 text-[11px] text-zinc-300">
                {vault?.isFrozen
                  ? "Agente detenido on-chain"
                  : vault
                    ? "Guardrails on-chain activos"
                    : "Sin bóveda conectada (simulación)"}
              </p>
            </div>

            {/* Vault Balance */}
            <div className="rounded-xl border border-kipu-border bg-kipu-card p-3.5 shadow-sm transition hover:border-zinc-600">
              <div className="flex items-center justify-between text-xs text-zinc-300">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Wallet className="h-3.5 w-3.5 text-zinc-300" />
                  Vault Balance
                </span>
                <InfoTooltip text="Saldo bajo custodia del smart contract. Solo el propietario puede retirar sin topes." />
              </div>
              {loadingVault ? (
                <SkeletonBlock className="mt-2 h-5 w-24" />
              ) : (
                <div className="mt-1.5 flex items-baseline justify-between gap-2">
                  <p className="font-display text-base font-bold text-white">
                    {vault
                      ? `${formatBaseUnitsAsUsdc(vault.vaultTokenBalance, 2)} USDC`
                      : "0.00 USDC"}
                  </p>
                  {vault && totalRealEvents > 0 && (
                    <span className="font-mono text-[10px] text-zinc-300">
                      {vault.totalExecutions.toString()} tx
                    </span>
                  )}
                </div>
              )}
              <p className="mt-0.5 text-[11px] text-zinc-300">
                Mock USDC en Solana Devnet
              </p>
            </div>

            {/* Available Spending Limit */}
            <div className="rounded-xl border border-kipu-border bg-kipu-card p-3.5 shadow-sm transition hover:border-zinc-600">
              <div className="flex items-center justify-between text-xs text-zinc-300">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Gauge className="h-3.5 w-3.5 text-zinc-300" />
                  Available Spending Limit
                </span>
                <InfoTooltip text="Cupo restante del agente en la ventana fija de 24 horas." />
              </div>
              {loadingVault ? (
                <SkeletonBlock className="mt-2 h-5 w-24" />
              ) : (
                <>
                  <div className="mt-1.5 flex items-baseline justify-between gap-2">
                    <p className="font-display text-base font-bold text-white">
                      {vault
                        ? `${formatBaseUnitsAsUsdc(remainingDaily, 2)} USDC`
                        : "50.00 USDC"}
                    </p>
                    {vault ? (
                      <span className="font-mono text-[10px] text-zinc-300">
                        {dailyUsedPct}% usado
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] text-zinc-400">
                        Demo
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className={`h-full transition-all ${
                        dailyUsedPct >= 90 ? "bg-kipu-crimson" : "bg-kipu-emerald"
                      }`}
                      style={{ width: `${vault ? 100 - dailyUsedPct : 100}%` }}
                    />
                  </div>
                </>
              )}
              <p className="mt-1 text-[11px] text-zinc-300">
                {vault
                  ? `Tope/tx: ${formatBaseUnitsAsUsdc(vault.maxPerTx, 0)} USDC · Límite 24h: ${formatBaseUnitsAsUsdc(vault.dailyLimit, 0)}`
                  : "Tope/tx demo: 10 USDC · Límite 24h: 50"}
              </p>
            </div>
          </div>

          {/* Detalle desplegable: Blocked Transactions, Authorized Wallets, Last Security Activity + Gráfico */}
          <details className="group rounded-xl border border-kipu-border bg-kipu-card/70 px-3.5 py-2">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs text-zinc-300 hover:text-white">
              <span className="inline-flex flex-wrap items-center gap-3 font-medium">
                <span className="inline-flex items-center gap-1.5 text-zinc-200">
                  <BarChart3 className="h-3.5 w-3.5 text-kipu-gold" />
                  Más métricas de seguridad:
                </span>
                <span className="font-mono text-[11px] text-red-300">
                  Bloqueadas: {blockedCount}
                </span>
                <span className="font-mono text-[11px] text-emerald-300">
                  Wallets autorizadas: {vault ? `${vault.recipientCount}/8` : "0/8"}
                </span>
                <span className="font-mono text-[11px] text-zinc-300">
                  Última actividad: {latest ? latest.status : "Sin registros"}
                </span>
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform group-open:rotate-180" />
            </summary>

            <div className="mt-2.5 grid grid-cols-1 gap-2.5 border-t border-kipu-border pt-2.5 sm:grid-cols-3">
              <div className="rounded-lg border border-kipu-border bg-kipu-bg p-3">
                <div className="flex items-center justify-between text-xs text-zinc-300">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <Ban className="h-3.5 w-3.5 text-kipu-crimson" />
                    Blocked Transactions
                  </span>
                  <InfoTooltip text="Intentos bloqueados por políticas on-chain o rechazados por análisis previo de IA." />
                </div>
                <div className="mt-1.5 flex items-baseline justify-between">
                  <p className="font-mono text-sm font-bold text-red-200">
                    {blockedCount}
                  </p>
                  {totalRealEvents > 0 && (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] text-red-300">
                      <TrendingDown className="h-3 w-3" />
                      {blockedRatioPct}% del historial
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-zinc-400">
                  {isAuthenticated
                    ? `${totalRealEvents} eventos auditados en total`
                    : "Inicia sesión SIWS para ver el historial real"}
                </p>
              </div>

              <div className="rounded-lg border border-kipu-border bg-kipu-bg p-3">
                <div className="flex items-center justify-between text-xs text-zinc-300">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <Users className="h-3.5 w-3.5 text-kipu-emerald" />
                    Authorized Wallets
                  </span>
                  <InfoTooltip text="Direcciones destino autorizadas en la Allowlist on-chain (máximo 8)." />
                </div>
                <p className="mt-1.5 font-mono text-sm font-bold text-emerald-200">
                  {vault ? `${vault.recipientCount} / 8` : "0 / 8"}
                </p>
                <div className="mt-1.5 grid grid-cols-8 gap-1">
                  {Array.from({ length: 8 }).map((_, idx) => {
                    const active = vault ? idx < vault.recipientCount : false;
                    return (
                      <span
                        key={idx}
                        className={`h-1.5 rounded-full ${
                          active ? "bg-kipu-emerald" : "bg-zinc-800"
                        }`}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="rounded-lg border border-kipu-border bg-kipu-bg p-3">
                <div className="flex items-center justify-between text-xs text-zinc-300">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <Activity className="h-3.5 w-3.5 text-zinc-300" />
                    Last Security Activity
                  </span>
                  <InfoTooltip text="Evento real más reciente registrado en tu Audit Ledger de Solana." />
                </div>
                <p className="mt-1.5 truncate font-mono text-sm font-bold text-zinc-100">
                  {latest ? latest.status : "Sin actividad real"}
                </p>
                <p className="mt-0.5 text-[11px] text-zinc-400">
                  {latest
                    ? `${formatShortTime(latest.created_at)} · ${
                        latest.amount_base_units
                          ? `${formatBaseUnitsAsUsdc(latest.amount_base_units, 2)} USDC`
                          : "0 USDC"
                      }`
                    : "Aún sin registros on-chain"}
                </p>
              </div>
            </div>
          </details>
        </div>
      )}
    </section>
  );
}
