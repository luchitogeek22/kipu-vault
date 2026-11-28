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
  Wallet,
} from "lucide-react";
import type { AuditLogEntry } from "@/lib/api";
import { formatBaseUnitsAsUsdc } from "@/lib/format";
import type { DecodedVaultState } from "@/lib/kipuVault";
import type { ExperienceLevel, SecurityTimelinePoint } from "@/lib/ux";
import { SkeletonBlock } from "./InfoTooltip";
import { SecurityGauges } from "./SecurityGauges";
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
  const allowlistCount = vault ? vault.recipientCount : 1;
  const latestPoint = timelinePoints[timelinePoints.length - 1];
  const currentRiskScore = effectiveFrozen
    ? 100
    : latestPoint
      ? latestPoint.riskScore
      : 11;
  const lastReason = effectiveFrozen
    ? "Emergency Freeze activo: agente detenido"
    : latestPoint
      ? `${latestPoint.label} · ${latestPoint.reason}`
      : "Bóveda lista dentro de límites seguros";

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
      "Demo interactiva lista: prueba un escenario arriba o en el Copilot para ver actualizarse el Radar, Risk Score y la evolución en vivo.";
  } else if (!vault) {
    securityState = "warning";
    securityHeadline =
      "Wallet conectada. Crea tu bóveda real en Vault Protection Center o prueba el Sandbox.";
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
      "Bóveda activa on-chain. Firma SIWS arriba para cargar tu historial real en Devnet.";
  }

  return (
    <section
      id="sec-overview"
      data-tour="vault-summary"
      aria-label="Security Overview"
      className="space-y-3"
    >
      {/* Status Banner */}
      <div
        className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-2 text-xs ${
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

      {/* TrustScan-style Top Global Metrics Strip (5 crisp compact cards) */}
      {experienceLevel !== "advanced" && (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            <div className="kipu-card-glow rounded-xl border border-kipu-border p-3">
              <p className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
                <Wallet className="h-3.5 w-3.5 text-kipu-gold" />
                Vault Balance
              </p>
              <p className="mt-1 font-display text-xl font-bold text-white">
                {currentBalanceUsdc.toFixed(2)}{" "}
                <span className="text-xs font-normal text-zinc-400">USDC</span>
              </p>
            </div>

            <div className="kipu-card-glow rounded-xl border border-kipu-border p-3">
              <p className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
                {effectiveFrozen ? (
                  <Snowflake className="h-3.5 w-3.5 text-sky-300" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5 text-kipu-emerald" />
                )}
                Protection
              </p>
              <p
                className={`mt-1 font-display text-xl font-bold ${
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
            </div>

            <div className="kipu-card-glow rounded-xl border border-kipu-border p-3">
              <p className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
                <Gauge className="h-3.5 w-3.5 text-zinc-300" />
                24h Available
              </p>
              <p className="mt-1 font-display text-xl font-bold text-white">
                {remainingDailyUsdc.toFixed(0)}{" "}
                <span className="text-xs font-normal text-zinc-400">
                  / {dailyLimitUsdc.toFixed(0)} USDC
                </span>
              </p>
            </div>

            <div className="kipu-card-glow rounded-xl border border-kipu-border p-3">
              <p className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
                <Ban className="h-3.5 w-3.5 text-kipu-crimson" />
                Blocked Attempts
              </p>
              <p className="mt-1 font-display text-xl font-bold text-red-200">
                {blockedCount}
              </p>
            </div>

            <div className="kipu-card-glow col-span-2 rounded-xl border border-kipu-border p-3 sm:col-span-1">
              <p className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
                <Users className="h-3.5 w-3.5 text-kipu-emerald" />
                Allowlist & Activity
              </p>
              <div className="mt-1 flex items-baseline justify-between gap-2">
                <p className="font-display text-xl font-bold text-white">
                  {allowlistCount}/8
                </p>
                <span className="inline-flex items-center gap-1 truncate font-mono text-[11px] text-zinc-300">
                  <Activity className="h-3 w-3 text-kipu-gold" />
                  {latestPoint ? latestPoint.timestamp : "Listo"}
                </span>
              </div>
            </div>
          </div>

          {/* 3-Column TrustScan Security Gauges: Threat Radar | Risk Score Arc | Vault Overview + Guardrails */}
          {loadingVault && !vault ? (
            <div className="grid gap-3 lg:grid-cols-3">
              <SkeletonBlock className="h-64 w-full" />
              <SkeletonBlock className="h-64 w-full" />
              <SkeletonBlock className="h-64 w-full" />
            </div>
          ) : (
            <SecurityGauges
              points={timelinePoints}
              currentRiskScore={currentRiskScore}
              lastReason={lastReason}
              isFrozen={effectiveFrozen}
              isRealVault={isRealVault}
              balanceUsdc={currentBalanceUsdc}
              dailyRemainingUsdc={remainingDailyUsdc}
              dailyLimitUsdc={dailyLimitUsdc}
              maxPerTxUsdc={maxPerTxUsdc}
              allowlistCount={allowlistCount}
            />
          )}

          {/* Balance Evolution & Limit Consumption SVG Chart */}
          <VaultAnalyticsChart
            currentBalanceUsdc={currentBalanceUsdc}
            dailyLimitUsdc={dailyLimitUsdc}
            spentTodayUsdc={spentTodayUsdc}
            maxPerTxUsdc={maxPerTxUsdc}
            isFrozen={effectiveFrozen}
            isRealVault={isRealVault}
            timelinePoints={timelinePoints}
          />
        </>
      )}
    </section>
  );
}
