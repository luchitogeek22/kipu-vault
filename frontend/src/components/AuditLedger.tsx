"use client";

import React, { useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  ExternalLink,
  Info,
  ShieldAlert,
  ShieldCheck,
  Snowflake,
  XCircle,
} from "lucide-react";
import type {
  AuditLogEntry,
  AuditStatus,
  AuditVerifyResponse,
} from "@/lib/api";
import {
  explorerTxUrl,
  formatBaseUnitsAsUsdc,
  truncateMiddle,
} from "@/lib/format";
import type { ExperienceLevel } from "@/lib/ux";

interface AuditLedgerProps {
  entries: AuditLogEntry[];
  onVerifyTx: (txSignature: string) => Promise<AuditVerifyResponse>;
  experienceLevel: ExperienceLevel;
  isFrozen?: boolean;
  isAuthenticated?: boolean;
}

type ActivityFilter = "all" | "allowed" | "blocked" | "alerts";

function statusBadgeClasses(status: AuditStatus, errorName?: string | null): string {
  if (errorName === "VaultFrozen") {
    return "border-sky-400/60 bg-sky-500/15 text-sky-200";
  }
  if (status === "EXECUTED") {
    return "border-kipu-emerald/50 bg-kipu-emerald/15 text-kipu-emerald";
  }
  if (status === "BLOCKED_ONCHAIN" || status === "BLOCKED_PREFLIGHT") {
    return "border-kipu-crimson/50 bg-kipu-crimson/15 text-kipu-crimson";
  }
  if (status === "REJECTED_BY_AI" || status === "NEEDS_RECIPIENT_APPROVAL") {
    return "border-kipu-gold/50 bg-kipu-gold/15 text-kipu-gold";
  }
  return "border-zinc-700 bg-zinc-800 text-zinc-300";
}

function statusPlainLabel(status: AuditStatus): string {
  switch (status) {
    case "EXECUTED":
      return "Autorizada en Solana";
    case "BLOCKED_ONCHAIN":
      return "Bloqueada por contrato";
    case "BLOCKED_PREFLIGHT":
      return "Detenida pre-envío";
    case "REJECTED_BY_AI":
      return "Alerta / Rechazada IA";
    case "NEEDS_RECIPIENT_APPROVAL":
      return "Esperando aprobación";
    case "FAILED_INFRA":
      return "Error de red / RPC";
    default:
      return "En proceso";
  }
}

function describeDecisionReason(entry: AuditLogEntry): string {
  if (entry.status === "EXECUTED") {
    return "Cumplió tope por tx, límite 24h y Allowlist on-chain.";
  }
  switch (entry.error_name) {
    case "ExceedsTransactionLimit":
      return "El monto supera el tope máximo por operación.";
    case "ExceedsDailyLimit":
      return "Alcanzó el límite acumulado de 24 horas.";
    case "RecipientNotAllowed":
      return "Destino fuera de la Allowlist autorizada.";
    case "VaultFrozen":
      return "Bóveda congelada por Emergency Freeze.";
    default:
      if (entry.status === "REJECTED_BY_AI") {
        return "Rechazada por análisis de seguridad del copiloto.";
      }
      if (entry.status === "NEEDS_RECIPIENT_APPROVAL") {
        return "El destinatario requiere firma explícita del propietario.";
      }
      return entry.error_name ?? "Evaluación registrada en historial on-chain.";
  }
}

export function AuditLedger({
  entries,
  onVerifyTx,
  experienceLevel,
  isFrozen = false,
  isAuthenticated = false,
}: AuditLedgerProps) {
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [verifyingSig, setVerifyingSig] = useState<string | null>(null);
  const [verifyModal, setVerifyModal] = useState<{
    txSignature: string;
    result: AuditVerifyResponse;
  } | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    if (!verifyModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setVerifyModal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [verifyModal]);

  const handleVerify = async (txSignature: string) => {
    setVerifyingSig(txSignature);
    setVerifyError(null);
    try {
      const result = await onVerifyTx(txSignature);
      setVerifyModal({ txSignature, result });
    } catch (err) {
      setVerifyError(
        err instanceof Error ? err.message : "Error verificando la transacción"
      );
    } finally {
      setVerifyingSig(null);
    }
  };

  const allowedEntries = entries.filter((e) => e.status === "EXECUTED");
  const blockedEntries = entries.filter(
    (e) => e.status === "BLOCKED_ONCHAIN" || e.status === "BLOCKED_PREFLIGHT"
  );
  const alertEntries = entries.filter(
    (e) =>
      e.status === "REJECTED_BY_AI" ||
      e.status === "NEEDS_RECIPIENT_APPROVAL" ||
      e.status === "FAILED_INFRA" ||
      e.error_name === "VaultFrozen"
  );

  const visibleEntries =
    filter === "allowed"
      ? allowedEntries
      : filter === "blocked"
        ? blockedEntries
        : filter === "alerts"
          ? alertEntries
          : entries;

  const total = entries.length;
  const allowedPct = total > 0 ? Math.round((allowedEntries.length / total) * 100) : 0;
  const blockedPct = total > 0 ? Math.round((blockedEntries.length / total) * 100) : 0;
  const alertPct = total > 0 ? Math.max(0, 100 - allowedPct - blockedPct) : 0;

  return (
    <section
      data-tour="ledger"
      aria-label="Security Activity Center"
      className="rounded-xl border border-kipu-border bg-kipu-card p-4 shadow-sm"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-kipu-border pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-kipu-border bg-kipu-bg text-kipu-gold">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-sm font-semibold text-white">
              Security Activity Center
            </h2>
            <p className="text-[11px] text-zinc-300">
              Historial real on-chain · Transacciones autorizadas, bloqueadas y
              motivo de cada decisión
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-md border border-kipu-border bg-kipu-bg px-2.5 py-1 text-[11px] text-zinc-300">
          <Info className="h-3.5 w-3.5 shrink-0 text-kipu-gold" />
          <span>
            El hash SHA-256 atesta el registro frente a la transacción en Solana
          </span>
        </div>
      </div>

      {/* Security alerts + Interactive real distribution bar + Filters */}
      <div className="mb-3 space-y-2.5 rounded-lg border border-kipu-border bg-kipu-bg p-3">
        {isFrozen && (
          <div className="flex items-center gap-2 rounded-md border border-sky-400/60 bg-sky-500/15 px-3 py-1.5 text-xs text-sky-100">
            <Snowflake className="h-3.5 w-3.5 shrink-0 text-sky-300" />
            <span>
              Alerta activa: Emergency Freeze habilitado — toda ejecución nueva
              del agente quedará detenida.
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5" role="tablist">
            {(
              [
                { id: "all", label: `Todas (${total})` },
                { id: "allowed", label: `Autorizadas (${allowedEntries.length})` },
                { id: "blocked", label: `Bloqueadas (${blockedEntries.length})` },
                { id: "alerts", label: `Alertas (${alertEntries.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={filter === tab.id}
                onClick={() => setFilter(tab.id)}
                className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition ${
                  filter === tab.id
                    ? "border-kipu-gold bg-kipu-gold/15 text-amber-100"
                    : "border-kipu-border bg-kipu-card text-zinc-300 hover:border-zinc-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {total > 0 && (
            <div className="flex items-center gap-3 font-mono text-[11px] text-zinc-300">
              <span className="text-emerald-300">{allowedPct}% autorizadas</span>
              <span className="text-red-300">{blockedPct}% bloqueadas</span>
              {alertPct > 0 && (
                <span className="text-amber-200">{alertPct}% alertas</span>
              )}
            </div>
          )}
        </div>

        {/* Interactive proportion chart when real data exists */}
        {total > 0 && (
          <div
            aria-label="Distribución real de decisiones de seguridad"
            className="flex h-2 w-full overflow-hidden rounded-full bg-zinc-900"
          >
            {allowedPct > 0 && (
              <button
                type="button"
                onClick={() => setFilter("allowed")}
                title={`Autorizadas: ${allowedEntries.length}`}
                style={{ width: `${allowedPct}%` }}
                className="h-full bg-kipu-emerald transition-all hover:opacity-80"
              />
            )}
            {blockedPct > 0 && (
              <button
                type="button"
                onClick={() => setFilter("blocked")}
                title={`Bloqueadas: ${blockedEntries.length}`}
                style={{ width: `${blockedPct}%` }}
                className="h-full bg-kipu-crimson transition-all hover:opacity-80"
              />
            )}
            {alertPct > 0 && (
              <button
                type="button"
                onClick={() => setFilter("alerts")}
                title={`Alertas / Rechazadas IA: ${alertEntries.length}`}
                style={{ width: `${alertPct}%` }}
                className="h-full bg-kipu-gold transition-all hover:opacity-80"
              />
            )}
          </div>
        )}
      </div>

      {verifyError && (
        <div className="mb-2.5 rounded-lg border border-kipu-crimson/50 bg-kipu-crimson/10 px-3 py-2 text-xs text-red-200">
          {verifyError}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-kipu-border text-xs font-semibold uppercase tracking-wider text-zinc-300">
              <th className="py-2 pr-3">Estado</th>
              <th className="py-2 pr-3">Monto</th>
              <th className="py-2 pr-3">Motivo de decisión</th>
              <th className="py-2 pr-3">Audit hash (SHA-256)</th>
              <th className="py-2 pr-3">Tx / Audit ID</th>
              <th className="py-2 text-right">Integridad</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-kipu-border/60">
            {visibleEntries.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-6 text-center text-xs text-zinc-300"
                >
                  {total === 0 ? (
                    isAuthenticated ? (
                      "Aún no hay ejecuciones reales en esta bóveda. Usa Kipu AI Copilot arriba para registrar tu primera evidencia on-chain."
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <ShieldAlert className="h-3.5 w-3.5 text-zinc-400" />
                        Las pruebas en Modo Demo Sandbox son locales. Conecta tu
                        wallet y firma SIWS para ver el registro real en Solana
                        Devnet aquí.
                      </span>
                    )
                  ) : (
                    "No hay registros en esta categoría de filtro."
                  )}
                </td>
              </tr>
            ) : (
              visibleEntries.map((entry) => {
                const hasSignature = Boolean(entry.tx_signature);
                const isPreflight = entry.status === "BLOCKED_PREFLIGHT";
                return (
                  <tr key={entry.id} className="hover:bg-zinc-900/50">
                    <td className="py-2.5 pr-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-block rounded border px-1.5 py-0.5 font-mono text-[11px] font-medium ${statusBadgeClasses(
                            entry.status,
                            entry.error_name
                          )}`}
                        >
                          {experienceLevel === "beginner"
                            ? statusPlainLabel(entry.status)
                            : entry.status}
                        </span>
                        {isPreflight && (
                          <span className="rounded border border-kipu-crimson/40 bg-kipu-bg px-1.5 py-0.5 text-[11px] text-red-200">
                            pre-envío
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-2.5 pr-3 font-mono text-zinc-100">
                      {entry.amount_base_units
                        ? `${formatBaseUnitsAsUsdc(entry.amount_base_units, 2)} USDC`
                        : "—"}
                    </td>

                    <td className="max-w-xs py-2.5 pr-3 text-xs text-zinc-200">
                      {describeDecisionReason(entry)}
                    </td>

                    <td className="py-2.5 pr-3 font-mono text-zinc-300">
                      {truncateMiddle(entry.decision_hash, 8, 6)}
                    </td>

                    <td className="py-2.5 pr-3 font-mono">
                      {entry.tx_signature ? (
                        <a
                          href={explorerTxUrl(entry.tx_signature)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-kipu-gold hover:underline"
                        >
                          tx: {truncateMiddle(entry.tx_signature, 6, 4)}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span
                          className="text-xs text-zinc-400"
                          title="No existe transacción enviada a Solana"
                        >
                          audit id: {truncateMiddle(entry.id, 6, 4)} (sin tx)
                        </span>
                      )}
                    </td>

                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        disabled={
                          !hasSignature || verifyingSig === entry.tx_signature
                        }
                        onClick={() =>
                          entry.tx_signature &&
                          void handleVerify(entry.tx_signature)
                        }
                        title={
                          hasSignature
                            ? "Verificar hash, monto y bóveda contra Solana"
                            : "Las filas sin firma no son verificables on-chain"
                        }
                        className="inline-flex items-center gap-1 rounded-md border border-kipu-border bg-kipu-bg px-2.5 py-1 text-xs font-medium text-zinc-200 hover:border-kipu-emerald/60 hover:text-kipu-emerald disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900/60 disabled:text-zinc-500"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {hasSignature && verifyingSig === entry.tx_signature
                          ? "Verificando..."
                          : "Verificar"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {verifyModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Verificación de integridad contra Solana"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setVerifyModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-xl border border-kipu-border bg-kipu-card p-5 shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between border-b border-kipu-border pb-3">
              <div className="flex items-center gap-2">
                {verifyModal.result.verified ? (
                  <CheckCircle2 className="h-5 w-5 text-kipu-emerald" />
                ) : (
                  <XCircle className="h-5 w-5 text-kipu-crimson" />
                )}
                <h3 className="text-sm font-semibold text-zinc-100">
                  {verifyModal.result.verified
                    ? "Integridad verificada contra Solana"
                    : "Discrepancia detectada en la verificación"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setVerifyModal(null)}
                className="text-xs text-zinc-300 hover:text-white"
              >
                Cerrar
              </button>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-kipu-border bg-kipu-bg p-3">
                <span className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-400">
                  Hash off-chain (SHA-256 canonical_json)
                </span>
                <p
                  className={`break-all font-mono text-xs ${
                    verifyModal.result.offchain_hash ===
                    verifyModal.result.onchain_hash
                      ? "text-kipu-emerald"
                      : "text-kipu-crimson"
                  }`}
                >
                  {verifyModal.result.offchain_hash}
                </p>
              </div>

              <div className="rounded-lg border border-kipu-border bg-kipu-bg p-3">
                <span className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-400">
                  Hash on-chain (data de agent_execute)
                </span>
                <p
                  className={`break-all font-mono text-xs ${
                    verifyModal.result.offchain_hash ===
                    verifyModal.result.onchain_hash
                      ? "text-kipu-emerald"
                      : "text-kipu-crimson"
                  }`}
                >
                  {verifyModal.result.onchain_hash ?? "No encontrado"}
                </p>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div className="rounded border border-kipu-border bg-kipu-bg p-2">
                <span className="block text-[10px] text-zinc-400">Monto</span>
                <span className="font-mono text-zinc-100">
                  {verifyModal.result.amount_match ? "Coincide" : "Difiere"}
                </span>
              </div>
              <div className="rounded border border-kipu-border bg-kipu-bg p-2">
                <span className="block text-[10px] text-zinc-400">Bóveda</span>
                <span className="font-mono text-zinc-100">
                  {verifyModal.result.vault_match ? "Coincide" : "Difiere"}
                </span>
              </div>
              <div className="rounded border border-kipu-border bg-kipu-bg p-2">
                <span className="block text-[10px] text-zinc-400">
                  Tx On-Chain
                </span>
                <span className="font-mono text-zinc-100">
                  {verifyModal.result.tx_succeeded
                    ? "Exitosa"
                    : `Revertida (${verifyModal.result.tx_error_name ?? "Error"})`}
                </span>
              </div>
              <div className="rounded border border-kipu-border bg-kipu-bg p-2">
                <span className="block text-[10px] text-zinc-400">
                  JSON Canónico
                </span>
                <span className="font-mono text-zinc-100">
                  {verifyModal.result.canonical_shape_valid
                    ? "Íntegro"
                    : "Alterado"}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>Verificado: {verifyModal.result.checked_at}</span>
              <a
                href={explorerTxUrl(verifyModal.txSignature)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-kipu-gold hover:underline"
              >
                Ver transacción en Explorer <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
