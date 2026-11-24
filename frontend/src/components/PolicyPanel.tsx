"use client";

import React, { useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Plus,
  RefreshCw,
  Settings2,
  Shield,
  Trash2,
  Users,
} from "lucide-react";
import {
  explorerAddressUrl,
  formatBaseUnitsAsUsdc,
  truncateMiddle,
} from "@/lib/format";
import type { DecodedVaultState } from "@/lib/kipuVault";

interface PolicyPanelProps {
  mintInput: string;
  onChangeMintInput: (val: string) => void;
  vault: DecodedVaultState | null;
  connectedWallet: string | null;
  loadingVault: boolean;
  onRefreshVault: () => Promise<void>;
  onInitializeVault: (params: {
    mint: string;
    agent: string;
    maxPerTxUsdc: string;
    dailyLimitUsdc: string;
  }) => Promise<void>;
  onDeposit: (amountUsdc: string) => Promise<void>;
  onWithdraw: (amountUsdc: string) => Promise<void>;
  onUpdatePolicy: (params: {
    newAgent: string;
    newMaxPerTxUsdc: string;
    newDailyLimitUsdc: string;
  }) => Promise<void>;
  onAddRecipient: (recipient: string) => Promise<void>;
  onRemoveRecipient: (recipient: string) => Promise<void>;
  busyAction: string | null;
}

export function PolicyPanel({
  mintInput,
  onChangeMintInput,
  vault,
  connectedWallet,
  loadingVault,
  onRefreshVault,
  onInitializeVault,
  onDeposit,
  onWithdraw,
  onUpdatePolicy,
  onAddRecipient,
  onRemoveRecipient,
  busyAction,
}: PolicyPanelProps) {
  const [initAgent, setInitAgent] = useState("");
  const [initMaxPerTx, setInitMaxPerTx] = useState("10");
  const [initDailyLimit, setInitDailyLimit] = useState("50");

  const [depositAmount, setDepositAmount] = useState("100");
  const [withdrawAmount, setWithdrawAmount] = useState("10");

  const [policyAgent, setPolicyAgent] = useState("");
  const [policyMaxPerTx, setPolicyMaxPerTx] = useState("");
  const [policyDailyLimit, setPolicyDailyLimit] = useState("");

  const [newRecipient, setNewRecipient] = useState("");

  const isOwner = Boolean(
    connectedWallet && vault && connectedWallet === vault.owner
  );

  const dailyPct =
    vault && vault.dailyLimit > 0n
      ? Math.min(
          100,
          Number((vault.spentToday * 100n) / vault.dailyLimit)
        )
      : 0;

  const perTxPct =
    vault && vault.dailyLimit > 0n
      ? Math.min(
          100,
          Number((vault.maxPerTx * 100n) / vault.dailyLimit)
        )
      : 0;

  return (
    <aside className="flex flex-col gap-2.5 rounded-xl border border-kipu-border bg-kipu-card p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-kipu-gold" />
          <h2 className="text-sm font-semibold text-zinc-100">
            Políticas On-Chain
          </h2>
        </div>
        <button
          type="button"
          onClick={() => void onRefreshVault()}
          disabled={loadingVault}
          className="inline-flex items-center gap-1 rounded-md border border-kipu-border bg-kipu-bg px-2 py-1 text-[11px] text-zinc-300 hover:border-kipu-gold/50"
        >
          <RefreshCw
            className={`h-3 w-3 ${loadingVault ? "animate-spin" : ""}`}
          />
          Sync
        </button>
      </div>

      {/* Mint selector */}
      <div className="rounded-lg border border-kipu-border bg-kipu-bg p-2.5">
        <label className="mb-1 block text-[11px] font-medium text-zinc-400">
          Mint Mock USDC (SPL clásico)
        </label>
        <input
          type="text"
          value={mintInput}
          onChange={(e) => onChangeMintInput(e.target.value)}
          placeholder="Dirección base58 del Mint SPL"
          className="w-full rounded-md border border-kipu-border bg-kipu-card px-2.5 py-1.5 font-mono text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-kipu-gold focus:outline-none"
        />
        {vault && (
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-400">
            <span>PDA Bóveda:</span>
            <a
              href={explorerAddressUrl(vault.address)}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-kipu-gold hover:underline"
            >
              {truncateMiddle(vault.address, 6, 6)}
            </a>
          </div>
        )}
      </div>

      {!vault ? (
        <div className="rounded-lg border border-kipu-gold/30 bg-kipu-bg p-2.5">
          <p className="mb-2 text-xs font-medium text-kipu-gold">
            No existe bóveda para este owner + mint. Créala aquí:
          </p>
          <div className="space-y-2">
            <input
              type="text"
              value={initAgent}
              onChange={(e) => setInitAgent(e.target.value)}
              placeholder="Pubkey del Agente"
              className="w-full rounded-md border border-kipu-border bg-kipu-card px-2.5 py-1.5 font-mono text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-kipu-gold focus:outline-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[10px] text-zinc-400">
                  Tope / tx (Mock USDC)
                </label>
                <input
                  type="text"
                  value={initMaxPerTx}
                  onChange={(e) => setInitMaxPerTx(e.target.value)}
                  className="w-full rounded-md border border-kipu-border bg-kipu-card px-2 py-1 font-mono text-xs text-zinc-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] text-zinc-400">
                  Límite diario (Mock USDC)
                </label>
                <input
                  type="text"
                  value={initDailyLimit}
                  onChange={(e) => setInitDailyLimit(e.target.value)}
                  className="w-full rounded-md border border-kipu-border bg-kipu-card px-2 py-1 font-mono text-xs text-zinc-100"
                />
              </div>
            </div>
            <button
              type="button"
              disabled={!connectedWallet || busyAction !== null}
              onClick={() =>
                void onInitializeVault({
                  mint: mintInput,
                  agent: initAgent,
                  maxPerTxUsdc: initMaxPerTx,
                  dailyLimitUsdc: initDailyLimit,
                })
              }
              className="w-full rounded-lg bg-kipu-gold px-3 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busyAction === "initialize"
                ? "Creando bóveda..."
                : "Crear Bóveda (initialize_vault)"}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Live policy bars */}
          <div className="space-y-2 rounded-lg border border-kipu-border bg-kipu-bg p-2.5">
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-zinc-400">Ventana 24h (fija) / Límite diario</span>
                <span className="font-mono text-zinc-100">
                  {formatBaseUnitsAsUsdc(vault.spentToday, 2)} /{" "}
                  {formatBaseUnitsAsUsdc(vault.dailyLimit, 2)} Mock USDC
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className={`h-full transition-all ${
                    dailyPct >= 90 ? "bg-kipu-crimson" : "bg-kipu-gold"
                  }`}
                  style={{ width: `${dailyPct}%` }}
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-zinc-400">Tope por transacción</span>
                <span className="font-mono text-kipu-gold">
                  {formatBaseUnitsAsUsdc(vault.maxPerTx, 2)} Mock USDC
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full bg-kipu-gold/70"
                  style={{ width: `${perTxPct}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-0.5 text-[11px]">
              <div className="rounded border border-kipu-border bg-kipu-card px-2 py-1">
                <span className="block text-zinc-500">Estado</span>
                <span
                  className={`font-semibold ${
                    vault.isFrozen ? "text-kipu-crimson" : "text-kipu-emerald"
                  }`}
                >
                  {vault.isFrozen ? "CONGELADA (FROZEN)" : "ACTIVA"}
                </span>
              </div>
              <div className="rounded border border-kipu-border bg-kipu-card px-2 py-1">
                <span className="block text-zinc-500">Ejecuciones</span>
                <span className="font-mono font-semibold text-zinc-100">
                  {vault.totalExecutions.toString()}
                </span>
              </div>
            </div>

            <div className="text-[11px] text-zinc-400">
              Agente:{" "}
              <span className="font-mono text-zinc-200">
                {truncateMiddle(vault.agent, 6, 6)}
              </span>
            </div>
          </div>

          {/* Deposit / Withdraw */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-kipu-border bg-kipu-bg p-2">
              <label className="mb-1 block text-[11px] text-zinc-400">
                Depositar (Mock USDC)
              </label>
              <input
                type="text"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="mb-1.5 w-full rounded border border-kipu-border bg-kipu-card px-2 py-1 font-mono text-xs text-zinc-100"
              />
              <button
                type="button"
                disabled={!isOwner || busyAction !== null}
                onClick={() => void onDeposit(depositAmount)}
                className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-kipu-emerald/50 bg-kipu-emerald/15 px-2 py-1.5 text-xs font-medium text-kipu-emerald hover:bg-kipu-emerald/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowDownToLine className="h-3.5 w-3.5" />
                {busyAction === "deposit" ? "..." : "Depositar"}
              </button>
            </div>

            <div className="rounded-lg border border-kipu-border bg-kipu-bg p-2">
              <label className="mb-1 block text-[11px] text-zinc-400">
                Retirar (Mock USDC)
              </label>
              <input
                type="text"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="mb-1.5 w-full rounded border border-kipu-border bg-kipu-card px-2 py-1 font-mono text-xs text-zinc-100"
              />
              <button
                type="button"
                disabled={!isOwner || busyAction !== null}
                onClick={() => void onWithdraw(withdrawAmount)}
                className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-kipu-gold/50 bg-kipu-gold/15 px-2 py-1.5 text-xs font-medium text-kipu-gold hover:bg-kipu-gold/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowUpFromLine className="h-3.5 w-3.5" />
                {busyAction === "withdraw" ? "..." : "Retirar"}
              </button>
            </div>
          </div>

          {/* Allowlist */}
          <div className="rounded-lg border border-kipu-border bg-kipu-bg p-2.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-200">
                <Users className="h-3.5 w-3.5 text-kipu-gold" />
                Allowlist de destinatarios
              </span>
              <span className="font-mono text-[11px] text-zinc-400">
                {vault.recipientCount}/8
              </span>
            </div>

            <div className="mb-2 flex gap-1.5">
              <input
                type="text"
                value={newRecipient}
                onChange={(e) => setNewRecipient(e.target.value)}
                placeholder="Wallet destino (base58)"
                className="min-w-0 flex-1 rounded border border-kipu-border bg-kipu-card px-2 py-1 font-mono text-xs text-zinc-100 placeholder:text-zinc-600"
              />
              <button
                type="button"
                disabled={
                  !isOwner ||
                  !newRecipient.trim() ||
                  vault.recipientCount >= 8 ||
                  busyAction !== null
                }
                onClick={() => {
                  const target = newRecipient.trim();
                  setNewRecipient("");
                  void onAddRecipient(target);
                }}
                className="inline-flex items-center gap-1 rounded bg-kipu-gold px-2.5 py-1 text-xs font-semibold text-zinc-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar
              </button>
            </div>

            {vault.allowedRecipients.length === 0 ? (
              <p className="text-[11px] text-zinc-500">
                Sin destinatarios autorizados aún.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {vault.allowedRecipients.map((addr) => (
                  <li
                    key={addr}
                    className="flex items-center justify-between rounded border border-kipu-border bg-kipu-card px-2 py-1"
                  >
                    <a
                      href={explorerAddressUrl(addr)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-[11px] text-zinc-200 hover:text-kipu-gold"
                    >
                      {truncateMiddle(addr, 8, 6)}
                    </a>
                    <button
                      type="button"
                      disabled={!isOwner || busyAction !== null}
                      onClick={() => void onRemoveRecipient(addr)}
                      title="Quitar de allowlist"
                      className="text-zinc-500 hover:text-kipu-crimson disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Update policy */}
          <details className="rounded-lg border border-kipu-border bg-kipu-bg p-2.5">
            <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-zinc-300">
              <Settings2 className="h-3.5 w-3.5 text-kipu-gold" />
              Actualizar políticas
            </summary>
            <div className="mt-2 space-y-2">
              <input
                type="text"
                value={policyAgent}
                onChange={(e) => setPolicyAgent(e.target.value)}
                placeholder="Nuevo agente (opcional)"
                className="w-full rounded border border-kipu-border bg-kipu-card px-2 py-1 font-mono text-xs text-zinc-100 placeholder:text-zinc-600"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={policyMaxPerTx}
                  onChange={(e) => setPolicyMaxPerTx(e.target.value)}
                  placeholder="Max/tx (Mock USDC)"
                  className="w-full rounded border border-kipu-border bg-kipu-card px-2 py-1 font-mono text-xs text-zinc-100 placeholder:text-zinc-600"
                />
                <input
                  type="text"
                  value={policyDailyLimit}
                  onChange={(e) => setPolicyDailyLimit(e.target.value)}
                  placeholder="Diario (Mock USDC)"
                  className="w-full rounded border border-kipu-border bg-kipu-card px-2 py-1 font-mono text-xs text-zinc-100 placeholder:text-zinc-600"
                />
              </div>
              <button
                type="button"
                disabled={!isOwner || busyAction !== null}
                onClick={() =>
                  void onUpdatePolicy({
                    newAgent: policyAgent,
                    newMaxPerTxUsdc: policyMaxPerTx,
                    newDailyLimitUsdc: policyDailyLimit,
                  })
                }
                className="w-full rounded-md border border-kipu-gold/50 bg-kipu-gold/15 px-2.5 py-1.5 text-xs font-medium text-kipu-gold hover:bg-kipu-gold/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busyAction === "update_policy"
                  ? "Actualizando..."
                  : "Firmar update_policy"}
              </button>
            </div>
          </details>
        </>
      )}
    </aside>
  );
}
