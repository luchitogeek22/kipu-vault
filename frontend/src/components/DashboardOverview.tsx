"use client";

import React from "react";
import {
  Activity,
  Ban,
  ChevronDown,
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

  let securityState: "ok" | "freeze" | "warning" | "danger" = "ok";
  let securityHeadline =
    "Tu bóveda está protegida y operando dentro de las políticas configuradas.";

  if (!connectedWallet) {
    securityState = "ok";
    securityHeadline =
      "Demo interactiva lista abajo: prueba los escenarios de pago, ataque y Freeze al instante.";
  } else if (!vault) {
    securityState = "warning";
    securityHeadline =
      "Wallet conectada. Crea tu bóveda real en el panel lateral o prueba el Sandbox en Copilot.";
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
      "Tu Allowlist está vacía: agrega al menos una dirección en Configuración antes de transferir.";
  } else if (!isAuthenticated) {
    securityState = "ok";
    securityHeadline =
      "Bóveda lista on-chain. Prueba el Sandbox abajo o inicia sesión SIWS arriba para ejecutar en Devnet.";
  }

  return (
    <section
      data-tour="vault-summary"
      aria-label="Resumen de seguridad de la bóveda"
      className="space-y-2.5"
    >
      <div
        className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2 text-xs ${
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

        <span className="rounded border border-white/10 bg-black/25 px-2 py-0.5 font-mono text-[11px] text-zinc-200">
          Red: Solana Devnet (Mock USDC)
        </span>
      </div>

      {experienceLevel !== "advanced" && (
        <div className="space-y-2">
          {/* Fila superior: solo 3 métricas principales */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <div className="rounded-xl border border-kipu-border bg-kipu-card p-3 transition hover:border-zinc-600">
              <div className="flex items-center justify-between text-xs text-zinc-300">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  {vault?.isFrozen ? (
                    <Snowflake className="h-3.5 w-3.5 text-sky-300" />
                  ) : (
                    <ShieldCheck className="h-3.5 w-3.5 text-kipu-emerald" />
                  )}
                  Protección
                </span>
                <InfoTooltip text="Indica si las reglas on-chain permiten operar al agente o si la bóveda está congelada con Freeze." />
              </div>
              {loadingVault ? (
                <SkeletonBlock className="mt-2 h-5 w-24" />
              ) : (
                <p
                  className={`mt-1.5 text-sm font-bold ${
                    !vault
                      ? "text-zinc-200"
                      : vault.isFrozen
                        ? "text-sky-300"
                        : "text-kipu-emerald"
                  }`}
                >
                  {!vault
                    ? "Modo Sandbox"
                    : vault.isFrozen
                      ? "Congelada (Freeze)"
                      : "Protegida"}
                </p>
              )}
              <p className="mt-0.5 text-[11px] text-zinc-300">
                {vault?.isFrozen ? "Agente detenido on-chain" : "Guardrails activos"}
              </p>
            </div>

            <div className="rounded-xl border border-kipu-border bg-kipu-card p-3 transition hover:border-zinc-600">
              <div className="flex items-center justify-between text-xs text-zinc-300">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Wallet className="h-3.5 w-3.5 text-zinc-300" />
                  Saldo
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
              <p className="mt-0.5 text-[11px] text-zinc-300">
                Mock USDC en Devnet
              </p>
            </div>

            <div className="rounded-xl border border-kipu-border bg-kipu-card p-3 transition hover:border-zinc-600">
              <div className="flex items-center justify-between text-xs text-zinc-300">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Gauge className="h-3.5 w-3.5 text-zinc-300" />
                  Límite disponible
                </span>
                <InfoTooltip text="Cuánto más puede gastar el agente dentro de la ventana actual de 24 horas." />
              </div>
              {loadingVault ? (
                <SkeletonBlock className="mt-2 h-5 w-24" />
              ) : (
                <p className="mt-1.5 font-mono text-sm font-bold text-zinc-100">
                  {vault
                    ? `${formatBaseUnitsAsUsdc(remainingDaily, 2)} / ${formatBaseUnitsAsUsdc(vault.dailyLimit, 0)} USDC`
                    : "50.00 USDC (demo)"}
                </p>
              )}
              <p className="mt-0.5 text-[11px] text-zinc-300">
                {vault
                  ? `Tope por pago: ${formatBaseUnitsAsUsdc(vault.maxPerTx, 0)} USDC`
                  : "Tope por pago demo: 10 USDC"}
              </p>
            </div>
          </div>

          {/* Detalle colapsable para las 3 métricas secundarias */}
          <details className="group rounded-xl border border-kipu-border bg-kipu-card/60 px-3.5 py-2">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs text-zinc-300 hover:text-white">
              <span className="inline-flex flex-wrap items-center gap-3 font-medium">
                <span>Más métricas:</span>
                <span className="font-mono text-[11px] text-red-300">
                  Bloqueadas: {blockedCount}
                </span>
                <span className="font-mono text-[11px] text-emerald-300">
                  Allowlist: {vault ? `${vault.recipientCount}/8` : "0/8"}
                </span>
                <span className="font-mono text-[11px] text-zinc-300">
                  Última: {latest ? latest.status : "Sin registros"}
                </span>
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform group-open:rotate-180" />
            </summary>

            <div className="mt-2.5 grid grid-cols-1 gap-2.5 border-t border-kipu-border pt-2.5 sm:grid-cols-3">
              <div className="rounded-lg border border-kipu-border bg-kipu-bg p-2.5">
                <div className="flex items-center justify-between text-xs text-zinc-300">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <Ban className="h-3.5 w-3.5 text-kipu-crimson" />
                    Bloqueadas
                  </span>
                  <InfoTooltip text="Intentos peligrosos o fuera de política detenidos automáticamente antes de mover fondos." />
                </div>
                <p className="mt-1 font-mono text-sm font-bold text-red-200">
                  {blockedCount}
                </p>
                <p className="text-[11px] text-zinc-400">
                  {isAuthenticated
                    ? "Amenazas frenadas en bóveda"
                    : "Requiere sesión para historial on-chain"}
                </p>
              </div>

              <div className="rounded-lg border border-kipu-border bg-kipu-bg p-2.5">
                <div className="flex items-center justify-between text-xs text-zinc-300">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <Users className="h-3.5 w-3.5 text-kipu-emerald" />
                    Allowlist
                  </span>
                  <InfoTooltip text="Cantidad de cuentas destino aprobadas por ti. El agente no puede enviar a otras." />
                </div>
                <p className="mt-1 font-mono text-sm font-bold text-emerald-200">
                  {vault ? `${vault.recipientCount} / 8` : "0 / 8"}
                </p>
                <p className="text-[11px] text-zinc-400">
                  Wallets autorizadas
                </p>
              </div>

              <div className="rounded-lg border border-kipu-border bg-kipu-bg p-2.5">
                <div className="flex items-center justify-between text-xs text-zinc-300">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <Activity className="h-3.5 w-3.5 text-zinc-300" />
                    Última actividad
                  </span>
                  <InfoTooltip text="Resultado y hora de la operación más reciente evaluada en tu bóveda." />
                </div>
                <p className="mt-1 truncate font-mono text-sm font-bold text-zinc-100">
                  {latest ? latest.status : "Sin actividad"}
                </p>
                <p className="text-[11px] text-zinc-400">
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
          </details>
        </div>
      )}
    </section>
  );
}
