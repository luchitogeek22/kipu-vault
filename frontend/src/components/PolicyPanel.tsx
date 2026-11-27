"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Lock,
  Plus,
  RefreshCw,
  Settings2,
  Shield,
  SlidersHorizontal,
  Snowflake,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import {
  explorerAddressUrl,
  formatBaseUnitsAsUsdc,
  isValidSolanaPubkey,
  parseUsdcToBaseUnits,
  truncateMiddle,
} from "@/lib/format";
import type { DecodedVaultState } from "@/lib/kipuVault";
import type { ExperienceLevel } from "@/lib/ux";
import { InfoTooltip, SkeletonBlock } from "./InfoTooltip";

interface PolicyPanelProps {
  mintInput: string;
  onChangeMintInput: (val: string) => void;
  defaultAgentPubkey: string;
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
  freezing?: boolean;
  onToggleFreeze?: () => Promise<void>;
  experienceLevel: ExperienceLevel;
}

export function PolicyPanel({
  mintInput,
  onChangeMintInput,
  defaultAgentPubkey,
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
  freezing = false,
  onToggleFreeze,
  experienceLevel,
}: PolicyPanelProps) {
  const [initAgent, setInitAgent] = useState(defaultAgentPubkey);
  const [initMaxPerTx, setInitMaxPerTx] = useState("10");
  const [initDailyLimit, setInitDailyLimit] = useState("50");

  useEffect(() => {
    if (!initAgent.trim() && defaultAgentPubkey) {
      setInitAgent(defaultAgentPubkey);
    }
  }, [defaultAgentPubkey, initAgent]);

  const [depositAmount, setDepositAmount] = useState("100");
  const [withdrawAmount, setWithdrawAmount] = useState("10");

  const [policyAgent, setPolicyAgent] = useState("");
  const [policyMaxPerTx, setPolicyMaxPerTx] = useState("");
  const [policyDailyLimit, setPolicyDailyLimit] = useState("");

  const [newRecipient, setNewRecipient] = useState("");
  const [activeTab, setActiveTab] = useState<"rules" | "funds" | "allowlist">(
    "rules"
  );

  const isOwner = Boolean(
    connectedWallet && vault && connectedWallet === vault.owner
  );

  let initValidationError: string | null = null;
  if (!connectedWallet) {
    initValidationError = "Conecta tu wallet Phantom para crear la bóveda.";
  } else if (!isValidSolanaPubkey(mintInput)) {
    initValidationError = "Ingresa un Mint SPL base58 válido.";
  } else if (!isValidSolanaPubkey(initAgent)) {
    initValidationError = "Ingresa una pubkey de Agente base58 válida.";
  } else if (initAgent.trim() === connectedWallet) {
    initValidationError = "El agente debe ser distinto al owner.";
  } else {
    try {
      const txCap = parseUsdcToBaseUnits(initMaxPerTx);
      const dayCap = parseUsdcToBaseUnits(initDailyLimit);
      if (dayCap < txCap) {
        initValidationError = "El límite diario debe ser >= tope por tx.";
      }
    } catch (err) {
      initValidationError =
        err instanceof Error ? err.message : "Montos inválidos.";
    }
  }
  const canCreateVault = initValidationError === null && busyAction === null;

  let canDeposit = false;
  try {
    canDeposit =
      isOwner &&
      busyAction === null &&
      parseUsdcToBaseUnits(depositAmount) > 0n;
  } catch {
    canDeposit = false;
  }

  let canWithdraw = false;
  try {
    const wUnits = parseUsdcToBaseUnits(withdrawAmount);
    canWithdraw =
      isOwner &&
      busyAction === null &&
      vault !== null &&
      wUnits > 0n &&
      wUnits <= vault.vaultTokenBalance;
  } catch {
    canWithdraw = false;
  }

  const canAddRecipient = Boolean(
    isOwner &&
      vault &&
      vault.recipientCount < 8 &&
      isValidSolanaPubkey(newRecipient) &&
      !vault.allowedRecipients.includes(newRecipient.trim()) &&
      busyAction === null
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
    <aside
      data-tour="policies"
      className="flex flex-col gap-2.5 rounded-xl border border-kipu-border bg-kipu-card p-3.5"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-kipu-gold" />
          <div>
            <h2 className="font-display text-sm font-semibold text-white">
              Vault Protection Center
            </h2>
            <p className="text-[11px] text-zinc-400">
              Reglas On-Chain · Configuración de bóveda
            </p>
          </div>
          {experienceLevel !== "advanced" && (
            <InfoTooltip text="Configuración guardada en el contrato de Solana. Ni la IA ni el servidor pueden saltársela." />
          )}
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
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-medium text-zinc-300">
            Mint Mock USDC (SPL clásico)
          </label>
          {experienceLevel === "beginner" && (
            <InfoTooltip text="Identificador del token de prueba en Solana Devnet usado por tu bóveda." />
          )}
        </div>
        <input
          type="text"
          value={mintInput}
          onChange={(e) => onChangeMintInput(e.target.value)}
          placeholder="Dirección base58 del Mint SPL"
          className="w-full rounded-md border border-kipu-border bg-kipu-card px-2.5 py-1.5 font-mono text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-kipu-gold focus:outline-none"
        />
        {vault && (
          <div className="mt-1.5 flex items-center justify-between text-xs text-zinc-300">
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

      {!vault && loadingVault ? (
        <div className="space-y-2 rounded-lg border border-kipu-border bg-kipu-bg p-3">
          <SkeletonBlock className="h-4 w-3/4" />
          <SkeletonBlock className="h-8 w-full" />
          <SkeletonBlock className="h-8 w-full" />
        </div>
      ) : !vault ? (
        <div className="rounded-lg border border-kipu-gold/30 bg-kipu-bg p-2.5">
          <p className="mb-2 text-xs font-medium text-kipu-gold">
            No existe bóveda para este owner + mint. Créala en 1 clic:
          </p>
          <div className="space-y-2">
            <div>
              <label className="mb-1 block text-xs text-zinc-300">
                Pubkey del Agente
              </label>
              <input
                type="text"
                value={initAgent}
                onChange={(e) => setInitAgent(e.target.value)}
                placeholder="Pubkey base58 del Agente"
                className="w-full rounded-md border border-kipu-border bg-kipu-card px-2.5 py-1.5 font-mono text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-kipu-gold focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs text-zinc-300">
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
                <label className="mb-1 block text-xs text-zinc-300">
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
            {initValidationError && (
              <p className="text-xs text-amber-300">{initValidationError}</p>
            )}
            <button
              type="button"
              disabled={!canCreateVault}
              onClick={() =>
                void onInitializeVault({
                  mint: mintInput,
                  agent: initAgent,
                  maxPerTxUsdc: initMaxPerTx,
                  dailyLimitUsdc: initDailyLimit,
                })
              }
              className="w-full rounded-lg bg-kipu-gold px-3 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              {busyAction === "initialize"
                ? "Creando bóveda..."
                : "Crear Bóveda (initialize_vault)"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            role="tablist"
            aria-label="Secciones de configuración de bóveda"
            className="grid grid-cols-3 gap-1 rounded-lg border border-kipu-border bg-kipu-bg p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "rules"}
              onClick={() => setActiveTab("rules")}
              className={`inline-flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition ${
                activeTab === "rules"
                  ? "bg-kipu-card text-white shadow"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <SlidersHorizontal className="h-3 w-3" />
              Límites & Freeze
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "allowlist"}
              onClick={() => setActiveTab("allowlist")}
              className={`inline-flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition ${
                activeTab === "allowlist"
                  ? "bg-kipu-card text-white shadow"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Users className="h-3 w-3" />
              Destinos ({vault.recipientCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "funds"}
              onClick={() => setActiveTab("funds")}
              className={`inline-flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition ${
                activeTab === "funds"
                  ? "bg-kipu-card text-white shadow"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Wallet className="h-3 w-3" />
              Fondos
            </button>
          </div>

          {activeTab === "rules" && (
            <div className="space-y-2.5">
              {/* Transaction Limits + Daily Spending Limits */}
              <div className="space-y-2.5 rounded-lg border border-kipu-border bg-kipu-bg p-2.5">
                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="inline-flex items-center gap-1 font-medium text-zinc-200">
                      Daily Spending Limits (24h)
                      {experienceLevel === "beginner" && (
                        <InfoTooltip text="Gasto acumulado en las últimas 24h frente al máximo diario permitido." />
                      )}
                    </span>
                    <span className="font-mono text-zinc-100">
                      {formatBaseUnitsAsUsdc(vault.spentToday, 2)} /{" "}
                      {formatBaseUnitsAsUsdc(vault.dailyLimit, 2)}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className={`h-full transition-all ${
                        dailyPct >= 90 ? "bg-kipu-crimson" : "bg-kipu-emerald"
                      }`}
                      style={{ width: `${dailyPct}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="inline-flex items-center gap-1 font-medium text-zinc-200">
                      Transaction Limits (máx/tx)
                      {experienceLevel === "beginner" && (
                        <InfoTooltip text="Monto máximo que el agente puede transferir en una sola operación." />
                      )}
                    </span>
                    <span className="font-mono text-zinc-100">
                      {formatBaseUnitsAsUsdc(vault.maxPerTx, 2)} Mock USDC
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full bg-zinc-400"
                      style={{ width: `${perTxPct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Agent Permissions */}
              <div className="rounded-lg border border-kipu-border bg-kipu-bg p-2.5 text-xs">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 font-medium text-zinc-200">
                    <Lock className="h-3.5 w-3.5 text-zinc-300" />
                    Agent Permissions
                  </span>
                  <span className="font-mono text-[11px] text-zinc-300">
                    {vault.totalExecutions.toString()} ejecuciones
                  </span>
                </div>
                <p className="text-[11px] text-zinc-300">
                  Agente autorizado:{" "}
                  <span className="font-mono text-zinc-100">
                    {truncateMiddle(vault.agent, 6, 6)}
                  </span>
                </p>
                <p className="mt-1 text-[11px] text-zinc-400">
                  Solo puede ejecutar pagos dentro de topes y hacia Authorized
                  Destinations. No puede retirar ni modificar reglas.
                </p>
              </div>

              {/* Emergency Freeze Control */}
              <div
                className={`rounded-lg border p-2.5 text-xs ${
                  vault.isFrozen
                    ? "border-sky-400/60 bg-sky-500/15"
                    : "border-kipu-border bg-kipu-bg"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="inline-flex items-center gap-1.5 font-semibold text-white">
                      <Snowflake className="h-3.5 w-3.5 text-sky-300" />
                      Emergency Freeze
                    </span>
                    <p className="mt-0.5 text-[11px] text-zinc-300">
                      Estado:{" "}
                      <strong
                        className={
                          vault.isFrozen ? "text-sky-200" : "text-kipu-emerald"
                        }
                      >
                        {vault.isFrozen ? "Congelada (Freeze)" : "Activa"}
                      </strong>
                    </p>
                  </div>
                  {onToggleFreeze && (
                    <button
                      type="button"
                      disabled={!isOwner || freezing}
                      onClick={() => void onToggleFreeze()}
                      className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold transition ${
                        vault.isFrozen
                          ? "border-kipu-emerald/60 bg-kipu-emerald/20 text-emerald-100 hover:bg-kipu-emerald/30"
                          : "border-sky-400/70 bg-sky-500/20 text-sky-100 hover:bg-sky-500/30"
                      } disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      {freezing
                        ? "Firmando..."
                        : vault.isFrozen
                          ? "Descongelar"
                          : "Congelar"}
                    </button>
                  )}
                </div>
              </div>

              <details
                key={`policy-details-${experienceLevel}`}
                open={experienceLevel === "advanced" ? true : undefined}
                className="rounded-lg border border-kipu-border bg-kipu-bg p-2.5"
              >
                <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-zinc-200">
                  <Settings2 className="h-3.5 w-3.5 text-kipu-gold" />
                  Actualizar políticas
                </summary>
                <div className="mt-2 space-y-2">
                  <input
                    type="text"
                    value={policyAgent}
                    onChange={(e) => setPolicyAgent(e.target.value)}
                    placeholder="Nuevo agente (opcional)"
                    className="w-full rounded border border-kipu-border bg-kipu-card px-2 py-1 font-mono text-xs text-zinc-100 placeholder:text-zinc-500"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={policyMaxPerTx}
                      onChange={(e) => setPolicyMaxPerTx(e.target.value)}
                      placeholder="Max/tx (Mock USDC)"
                      className="w-full rounded border border-kipu-border bg-kipu-card px-2 py-1 font-mono text-xs text-zinc-100 placeholder:text-zinc-500"
                    />
                    <input
                      type="text"
                      value={policyDailyLimit}
                      onChange={(e) => setPolicyDailyLimit(e.target.value)}
                      placeholder="Diario (Mock USDC)"
                      className="w-full rounded border border-kipu-border bg-kipu-card px-2 py-1 font-mono text-xs text-zinc-100 placeholder:text-zinc-500"
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
                    className="w-full rounded-md bg-kipu-gold px-2.5 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
                  >
                    {busyAction === "update_policy"
                      ? "Actualizando..."
                      : "Firmar update_policy"}
                  </button>
                </div>
              </details>
            </div>
          )}

          {activeTab === "funds" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-kipu-border bg-kipu-bg p-2.5">
                <label className="mb-1 block text-xs text-zinc-300">
                  Depositar (Mock USDC)
                </label>
                <input
                  type="text"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="mb-2 w-full rounded border border-kipu-border bg-kipu-card px-2 py-1 font-mono text-xs text-zinc-100"
                />
                <button
                  type="button"
                  disabled={!canDeposit}
                  onClick={() => void onDeposit(depositAmount)}
                  className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-kipu-emerald/50 bg-kipu-emerald/15 px-2 py-1.5 text-xs font-medium text-kipu-emerald hover:bg-kipu-emerald/25 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-800/70 disabled:text-zinc-500"
                >
                  <ArrowDownToLine className="h-3.5 w-3.5" />
                  {busyAction === "deposit" ? "..." : "Depositar"}
                </button>
              </div>

              <div className="rounded-lg border border-kipu-border bg-kipu-bg p-2.5">
                <label className="mb-1 block text-xs text-zinc-300">
                  Retirar (siempre libre)
                </label>
                <input
                  type="text"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="mb-2 w-full rounded border border-kipu-border bg-kipu-card px-2 py-1 font-mono text-xs text-zinc-100"
                />
                <button
                  type="button"
                  disabled={!canWithdraw}
                  onClick={() => void onWithdraw(withdrawAmount)}
                  className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-zinc-600 bg-kipu-card px-2 py-1.5 text-xs font-medium text-zinc-100 hover:border-zinc-400 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-500"
                >
                  <ArrowUpFromLine className="h-3.5 w-3.5" />
                  {busyAction === "withdraw" ? "..." : "Retirar"}
                </button>
              </div>
            </div>
          )}

          {activeTab === "allowlist" && (
            <div
              data-tour="allowlist"
              className="rounded-lg border border-kipu-border bg-kipu-bg p-2.5"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-200">
                  <Users className="h-3.5 w-3.5 text-kipu-emerald" />
                  Allowlist de destinatarios
                  {experienceLevel !== "advanced" && (
                    <InfoTooltip text="Solo las direcciones en esta lista pueden recibir pagos del agente." />
                  )}
                </span>
                <span className="font-mono text-xs text-zinc-300">
                  {vault.recipientCount}/8
                </span>
              </div>

              <div className="mb-2 flex gap-1.5">
                <input
                  type="text"
                  value={newRecipient}
                  onChange={(e) => setNewRecipient(e.target.value)}
                  placeholder="Wallet destino (base58)"
                  className="min-w-0 flex-1 rounded border border-kipu-border bg-kipu-card px-2 py-1 font-mono text-xs text-zinc-100 placeholder:text-zinc-500"
                />
                <button
                  type="button"
                  disabled={!canAddRecipient}
                  onClick={() => {
                    const target = newRecipient.trim();
                    setNewRecipient("");
                    void onAddRecipient(target);
                  }}
                  className="inline-flex items-center gap-1 rounded bg-kipu-gold px-2.5 py-1 text-xs font-semibold text-zinc-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar
                </button>
              </div>

              {vault.allowedRecipients.length === 0 ? (
                <p className="text-xs text-zinc-300">
                  Sin destinatarios autorizados aún. Agrega una wallet
                  confiable para habilitar envíos.
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
                        className="font-mono text-[11px] text-zinc-200 hover:text-kipu-emerald"
                      >
                        {truncateMiddle(addr, 8, 6)}
                      </a>
                      <button
                        type="button"
                        disabled={!isOwner || busyAction !== null}
                        onClick={() => void onRemoveRecipient(addr)}
                        title="Quitar de allowlist"
                        className="text-zinc-400 hover:text-kipu-crimson disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </aside>
  );
}
