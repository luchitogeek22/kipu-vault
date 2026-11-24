"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  FileSearch,
  Info,
  ShieldCheck,
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

interface AuditLedgerProps {
  entries: AuditLogEntry[];
  onVerifyTx: (txSignature: string) => Promise<AuditVerifyResponse>;
}

function statusBadgeClasses(status: AuditStatus): string {
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

export function AuditLedger({ entries, onVerifyTx }: AuditLedgerProps) {
  const [verifyingSig, setVerifyingSig] = useState<string | null>(null);
  const [verifyModal, setVerifyModal] = useState<{
    txSignature: string;
    result: AuditVerifyResponse;
  } | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

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

  return (
    <section className="rounded-xl border border-kipu-border bg-kipu-card p-3.5">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-kipu-border pb-2.5">
        <div className="flex items-center gap-2">
          <FileSearch className="h-4 w-4 text-kipu-gold" />
          <h2 className="text-sm font-semibold text-zinc-100">
            Kipu Audit Ledger
          </h2>
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-md border border-kipu-gold/30 bg-kipu-gold/5 px-2.5 py-1 text-[11px] text-amber-200">
          <Info className="h-3.5 w-3.5 shrink-0 text-kipu-gold" />
          <span>
            El hash es una atestación de auditoría, no prueba que la decisión
            fuera correcta
          </span>
        </div>
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
              <th className="py-2 pr-3">Audit hash (SHA-256)</th>
              <th className="py-2 pr-3">Tx Signature / Audit ID</th>
              <th className="py-2 text-right">Integridad</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-kipu-border/60">
            {entries.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-6 text-center text-xs text-zinc-300"
                >
                  Aún no hay registros de auditoría para esta bóveda.
                </td>
              </tr>
            ) : (
              entries.map((entry) => {
                const hasSignature = Boolean(entry.tx_signature);
                const isPreflight = entry.status === "BLOCKED_PREFLIGHT";
                return (
                  <tr key={entry.id} className="hover:bg-zinc-900/50">
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-block rounded border px-1.5 py-0.5 font-mono text-xs font-medium ${statusBadgeClasses(
                            entry.status
                          )}`}
                        >
                          {entry.status}
                        </span>
                        {isPreflight && (
                          <span className="rounded border border-kipu-crimson/40 bg-kipu-bg px-1.5 py-0.5 text-xs text-red-200">
                            sin firma
                          </span>
                        )}
                        {entry.error_name && (
                          <span className="font-mono text-xs text-zinc-300">
                            ({entry.error_name})
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-2 pr-3 font-mono text-zinc-100">
                      {entry.amount_base_units
                        ? `${formatBaseUnitsAsUsdc(entry.amount_base_units, 2)} Mock USDC`
                        : "—"}
                    </td>

                    <td className="py-2 pr-3 font-mono text-zinc-300">
                      {truncateMiddle(entry.decision_hash, 8, 6)}
                    </td>

                    <td className="py-2 pr-3 font-mono">
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
                          className="text-xs text-zinc-300"
                          title="No existe transacción enviada a Solana"
                        >
                          audit id: {truncateMiddle(entry.id, 6, 4)} (sin tx
                          on-chain)
                        </span>
                      )}
                    </td>

                    <td className="py-2 text-right">
                      <button
                        type="button"
                        disabled={!hasSignature || verifyingSig === entry.tx_signature}
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
                        {verifyingSig === entry.tx_signature
                          ? "Verificando..."
                          : "Verificar integridad"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Side-by-side hash verification modal */}
      {verifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-kipu-border bg-kipu-card p-5 shadow-2xl">
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
                className="text-xs text-zinc-400 hover:text-zinc-100"
              >
                Cerrar
              </button>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-kipu-border bg-kipu-bg p-3">
                <span className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">
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
                <span className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">
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
                <span className="block text-[10px] text-zinc-500">Monto</span>
                <span className="font-mono text-zinc-100">
                  {verifyModal.result.amount_match ? "Coincide" : "Difiere"}
                </span>
              </div>
              <div className="rounded border border-kipu-border bg-kipu-bg p-2">
                <span className="block text-[10px] text-zinc-500">Bóveda</span>
                <span className="font-mono text-zinc-100">
                  {verifyModal.result.vault_match ? "Coincide" : "Difiere"}
                </span>
              </div>
              <div className="rounded border border-kipu-border bg-kipu-bg p-2">
                <span className="block text-[10px] text-zinc-500">Tx On-Chain</span>
                <span className="font-mono text-zinc-100">
                  {verifyModal.result.tx_succeeded
                    ? "Exitosa"
                    : `Revertida (${verifyModal.result.tx_error_name ?? "Error"})`}
                </span>
              </div>
              <div className="rounded border border-kipu-border bg-kipu-bg p-2">
                <span className="block text-[10px] text-zinc-500">JSON Canónico</span>
                <span className="font-mono text-zinc-100">
                  {verifyModal.result.canonical_shape_valid ? "Íntegro" : "Alterado"}
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
