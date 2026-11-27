"use client";

import React from "react";
import {
  Activity,
  Ban,
  Gauge,
  ShieldAlert,
  ShieldCheck,
  Snowflake,
  Users,
} from "lucide-react";
import type { AuditLogEntry } from "@/lib/api";
import { formatBaseUnitsAsUsdc } from "@/lib/format";
import type { DecodedVaultState } from "@/lib/kipuVault";
import type { ExperienceLevel, SecurityTimelinePoint } from "@/lib/ux";
import { InfoTooltip, SkeletonBlock } from "./InfoTooltip";
import { VaultAnalyticsChart } from "./VaultAnalyticsChart";

interface DashboardOverviewProps {
  vault: DecodedVaultState | null;
  loadingVault: boolean;
  connectedWallet: string | null;
  isAuthenticated: boolean;
  lowSolWarning: boolean;
  auditEntries: AuditLogEntry[];
  sandboxEvents: SecurityTimelinePoint[];
  sandboxBalanceUsdc: number;
  sandboxFrozen: boolean;
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
  sandboxEvents,
  sandboxBalanceUsdc,
  sandboxFrozen,
  experienceLevel,
}: DashboardOverviewProps) {
  const isRealVault = Boolean(vault);
  const usingRealData = Boolean(vault && isAuthenticated);

  const realPoints: SecurityTimelinePoint[] = [...auditEntries]
    .reverse()
    .map((entry) => ({
      id: entry.id,
      label:
        entry.status === "EXECUTED"
          ? "Pago ejecutado on-chain"
          : entry.error_name === "VaultFrozen"
            ? "Detenido por Freeze"
            : entry.status === "REJECTED_BY_AI"
              ? "Rechazado por IA"
              : `Bloqueado (${entry.error_name ?? "Política"})`,
      amountUsdc: entry.amount_base_units
        ? Number(formatBaseUnitsAsUsdc(entry.amount_base_units, 2))
        : 0,
      status:
        entry.error_name === "VaultFrozen"
          ? "FREEZE"
          : entry.status === "EXECUTED"
            ? "EXECUTED"
            : entry.status === "REJECTED_BY_AI"
              ? "ALERT"
              : "BLOCKED",
      reason: entry.error_name ?? entry.status,
      timestamp: formatShortTime(entry.created_at),
      riskScore: entry.status === "EXECUTED" ? 10 : 92,
      isSandbox: false,
    }));

  const timelinePoints = usingRealData ? realPoints : sandboxEvents;

  const currentBalanceUsdc = vault
    ? Number(formatBaseUnitsAsUsdc(vault.vaultTokenBalance, 2))
    : sandboxBalanceUsdc;
  const dailyLimitUsdc = vault
    ? Number(formatBaseUnitsAsUsdc(vault.dailyLimit, 2))
    : 50;
  const spentTodayUsdc = vault
    ? Number(formatBaseUnitsAsUsdc(vault.spentToday, 2))
    : sandboxEvents
        .filter((e) => e.status === "EXECUTED")
        .reduce((sum, e) => sum + e.amountUsdc, 0);
  const maxPerTxUsdc = vault
    ? Number(formatBaseUnitsAsUsdc(vault.maxPerTx, 2))
    : 10;
  const remainingDailyUsdc = Math.max(0, dailyLimitUsdc - spentTodayUsdc);
  const dailyUsedPct =
    dailyLimitUsdc > 0
      ? Math.min(100, Math.round((spentTodayUsdc / dailyLimitUsdc) * 100))
      : 0;

  const blockedCount = usingRealData
    ? auditEntries.filter(
        (e) =>
          e.status === "BLOCKED_ONCHAIN" ||
          e.status === "BLOCKED_PREFLIGHT" ||
          e.status === "REJECTED_BY_AI"
      ).length
    : sandboxEvents.filter(
        (e) => e.status === "BLOCKED" || e.status === "ALERT"
      ).length;

  const effectiveFrozen = vault ? vault.isFrozen : sandboxFrozen;
  const latestPoint = timelinePoints[timelinePoints.length - 1];

  let securityState: "ok" | "freeze" | "warning" | "danger" = "ok";
  let securityHeadline =
    "Bóveda protegida y operando dentro de las políticas on-chain.";

  if (effectiveFrozen) {
    securityState = "freeze";
    securityHeadline = vault
      ? "Emergency Freeze activo: el agente quedó detenido on-chain hasta que descongeles."
      : "Emergency Freeze activo en Modo Sandbox: el agente no puede ejecutar transferencias.";
  } else if (!connectedWallet) {
    securityState = "ok";
    securityHeadline =
      "Demo interactiva lista: prueba pago seguro, ataque o Freeze abajo y observa la gráfica y el pipeline en tiempo real.";
  } else if (!vault) {
    securityState = "warning";
    securityHeadline =
      "Wallet conectada. Crea tu bóveda real en Vault Protection Center o prueba el Sandbox abajo.";
  } else if (lowSolWarning) {
    securityState = "danger";
    securityHeadline =
      "Advertencia: el agente tiene poco SOL en Devnet para pagar comisiones de red.";
  } else if (vault.recipientCount === 0) {
    securityState = "warning";
    securityHeadline =
      "Allowlist vacía: agrega al menos una dirección destino en Vault Protection Center.";
  } else if (!isAuthenticated) {
    securityState = "ok";
    securityHeadline =
      "Bóveda activa on-chain. Firma SIWS arriba para cargar tu historial real y operar en Devnet.";
  }

  return (
    <section
      data-tour="vault-summary"
      aria-label="Security Overview"
      className="space-y-3"
    >
      <div
        className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-2 text-xs shadow-sm ${
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
          {isRealVault ? "Solana Devnet · Real" : "Modo Demo Sandbox"}
        </span>
      </div>

      {experienceLevel !== "advanced" && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          {/* Izquierda (col-8): Gráfico real de evolución de saldo, consumo y actividad */}
          <div className="lg:col-span-8">
            {loadingVault ? (
              <div className="rounded-xl border border-kipu-border bg-kipu-card p-4 space-y-3">
                <SkeletonBlock className="h-7 w-48" />
                <SkeletonBlock className="h-40 w-full" />
              </div>
            ) : (
              <VaultAnalyticsChart
                currentBalanceUsdc={currentBalanceUsdc}
                dailyLimitUsdc={dailyLimitUsdc}
                spentTodayUsdc={spentTodayUsdc}
                maxPerTxUsdc={maxPerTxUsdc}
                isFrozen={effectiveFrozen}
                isRealVault={isRealVault}
                timelinePoints={timelinePoints}
              />
            )}
          </div>

          {/* Derecha (col-4): Tarjetas clave de estado, límite disponible y resumen secundario */}
          <div className="grid gap-2.5 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1">
            <div className="grid grid-cols-2 gap-2.5">
              {/* Protection Status */}
              <div className="rounded-xl border border-kipu-border bg-kipu-card p-3">
                <div className="flex items-center justify-between text-xs text-zinc-300">
                  <span className="inline-flex items-center gap-1 font-medium">
                    {effectiveFrozen ? (
                      <Snowflake className="h-3.5 w-3.5 text-sky-300" />
                    ) : (
                      <ShieldCheck className="h-3.5 w-3.5 text-kipu-emerald" />
                    )}
                    Protección
                  </span>
                  <InfoTooltip text="Indica si las reglas permiten operar al agente o si Emergency Freeze está activo." />
                </div>
                <p
                  className={`mt-1.5 font-display text-lg font-bold ${
                    effectiveFrozen
                      ? "text-sky-300"
                      : isRealVault
                        ? "text-kipu-emerald"
                        : "text-emerald-200"
                  }`}
                >
                  {effectiveFrozen
                    ? "Freeze"
                    : isRealVault
                      ? "Protegida"
                      : "Sandbox"}
                </p>
                <p className="text-xs text-zinc-300">
                  {effectiveFrozen ? "Agente detenido" : "Guardrails activos"}
                </p>
              </div>

              {/* Blocked Transactions */}
              <div className="rounded-xl border border-kipu-border bg-kipu-card p-3">
                <div className="flex items-center justify-between text-xs text-zinc-300">
                  <span className="inline-flex items-center gap-1 font-medium">
                    <Ban className="h-3.5 w-3.5 text-kipu-crimson" />
                    Bloqueadas
                  </span>
                  <InfoTooltip text="Operaciones peligrosas o fuera de límite detenidas antes de mover fondos." />
                </div>
                <p className="mt-1.5 font-display text-lg font-bold text-red-200">
                  {blockedCount}
                </p>
                <p className="text-xs text-zinc-300">
                  {usingRealData ? "En Solana Devnet" : "En sesión actual"}
                </p>
              </div>
            </div>

            {/* Available Spending Limit */}
            <div className="rounded-xl border border-kipu-border bg-kipu-card p-3">
              <div className="flex items-center justify-between text-xs text-zinc-300">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Gauge className="h-3.5 w-3.5 text-zinc-300" />
                  Límite disponible (24h)
                </span>
                <span className="font-mono text-xs text-zinc-200">
                  {dailyUsedPct}% usado
                </span>
              </div>
              <p className="mt-1 font-display text-xl font-bold text-white">
                {remainingDailyUsdc.toFixed(2)}{" "}
                <span className="font-mono text-xs font-normal text-zinc-300">
                  / {dailyLimitUsdc.toFixed(0)} USDC (tope {maxPerTxUsdc.toFixed(0)}/tx)
                </span>
              </p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className={`h-full transition-all ${
                    dailyUsedPct >= 90 ? "bg-kipu-crimson" : "bg-kipu-emerald"
                  }`}
                  style={{ width: `${100 - dailyUsedPct}%` }}
                />
              </div>
            </div>

            {/* Authorized Wallets + Last Security Activity */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl border border-kipu-border bg-kipu-card p-3">
                <div className="flex items-center justify-between text-xs text-zinc-300">
                  <span className="inline-flex items-center gap-1 font-medium">
                    <Users className="h-3.5 w-3.5 text-kipu-emerald" />
                    Allowlist
                  </span>
                </div>
                <p className="mt-1 font-display text-base font-bold text-white">
                  {vault ? `${vault.recipientCount} / 8` : "1 / 8 (demo)"}
                </p>
                <div className="mt-1.5 grid grid-cols-8 gap-1">
                  {Array.from({ length: 8 }).map((_, idx) => {
                    const count = vault ? vault.recipientCount : 1;
                    return (
                      <span
                        key={idx}
                        className={`h-1.5 rounded-full ${
                          idx < count ? "bg-kipu-emerald" : "bg-zinc-800"
                        }`}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-kipu-border bg-kipu-card p-3">
                <div className="flex items-center justify-between text-xs text-zinc-300">
                  <span className="inline-flex items-center gap-1 font-medium">
                    <Activity className="h-3.5 w-3.5 text-zinc-300" />
                    Última
                  </span>
                </div>
                <p className="mt-1 truncate text-xs font-bold text-white">
                  {latestPoint ? latestPoint.label : "Sin actividad"}
                </p>
                <p className="mt-0.5 text-xs text-zinc-300">
                  {latestPoint
                    ? `${latestPoint.amountUsdc.toFixed(2)} USDC · ${latestPoint.timestamp}`
                    : "Esperando prueba"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
