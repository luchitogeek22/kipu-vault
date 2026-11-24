"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import bs58 from "bs58";
import {
  useAnchorWallet,
  useConnection,
  useWallet,
} from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import {
  addRecipientTx,
  depositToVaultTx,
  deriveVaultPda,
  emergencyFreezeTx,
  fetchVaultStateOnChain,
  initializeVaultTx,
  removeRecipientTx,
  updatePolicyTx,
  withdrawFromVaultTx,
  type DecodedVaultState,
} from "@/lib/kipuVault";
import {
  executeAgentIntent,
  fetchHealth,
  listAuditLogs,
  requestSiwsNonce,
  verifyAuditTx,
  verifySiwsSignature,
  type AuditLogEntry,
  type ExecuteIntentRequest,
  type ExecuteIntentResponse,
  type HealthResponse,
} from "@/lib/api";
import { parseUsdcToBaseUnits } from "@/lib/format";
import { FRONTEND_CONFIG } from "@/lib/config";
import { TopBar } from "./TopBar";
import { PolicyPanel } from "./PolicyPanel";
import { KipuCopilot, type CopilotMessage } from "./KipuCopilot";
import { AuditLedger } from "./AuditLedger";

export function KipuDashboard() {
  const { connection } = useConnection();
  const { publicKey, signMessage } = useWallet();
  const anchorWallet = useAnchorWallet();

  const [mintInput, setMintInput] = useState<string>(FRONTEND_CONFIG.demoMint);
  const [vault, setVault] = useState<DecodedVaultState | null>(null);
  const [loadingVault, setLoadingVault] = useState(false);

  const [jwtToken, setJwtToken] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditLogEntry[]>([]);

  const [demoRecipientAddress, setDemoRecipientAddress] = useState<string>(
    FRONTEND_CONFIG.demoRecipient
  );
  const [attackerAddress, setAttackerAddress] = useState<string>(
    FRONTEND_CONFIG.demoAttacker
  );

  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [sendingIntent, setSendingIntent] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [freezing, setFreezing] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [bannerInfo, setBannerInfo] = useState<string | null>(null);

  const [pendingApproval, setPendingApproval] = useState<{
    recipient: string;
    lastRequest: Omit<ExecuteIntentRequest, "vault_address">;
  } | null>(null);

  const connectedWallet = publicKey ? publicKey.toBase58() : null;
  const lastWalletRef = useRef<string | null>(null);

  // Clear JWT if connected wallet changes
  useEffect(() => {
    if (lastWalletRef.current !== connectedWallet) {
      lastWalletRef.current = connectedWallet;
      setJwtToken(null);
      setAuditEntries([]);
    }
  }, [connectedWallet]);

  // Fetch backend health status
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetchHealth();
        if (active) setHealth(res);
      } catch {
        // backend may not be running during static inspection
      }
    };
    void load();
    const id = setInterval(() => void load(), 15000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const refreshVault = useCallback(async () => {
    if (!publicKey || !mintInput.trim()) {
      setVault(null);
      return;
    }
    let mintPk: PublicKey;
    try {
      mintPk = new PublicKey(mintInput.trim());
    } catch {
      setVault(null);
      return;
    }

    setLoadingVault(true);
    try {
      const vaultPda = deriveVaultPda(publicKey, mintPk);
      const state = await fetchVaultStateOnChain(connection, vaultPda);
      setVault(state);
      if (state && state.allowedRecipients[0] && !demoRecipientAddress) {
        setDemoRecipientAddress(state.allowedRecipients[0]);
      }
    } catch (err) {
      setBannerError(
        err instanceof Error ? err.message : "Error leyendo VaultState"
      );
    } finally {
      setLoadingVault(false);
    }
  }, [connection, demoRecipientAddress, mintInput, publicKey]);

  // Refresh vault when owner + mint changes + live subscription + 3s fallback polling
  useEffect(() => {
    void refreshVault();
    if (!publicKey || !mintInput.trim()) return;

    let mintPk: PublicKey;
    try {
      mintPk = new PublicKey(mintInput.trim());
    } catch {
      return;
    }
    const vaultPda = deriveVaultPda(publicKey, mintPk);

    let subId: number | null = null;
    try {
      subId = connection.onAccountChange(
        vaultPda,
        () => {
          void refreshVault();
        },
        "confirmed"
      );
    } catch {
      subId = null;
    }

    const pollId = setInterval(() => {
      void refreshVault();
    }, 3000);

    return () => {
      if (subId !== null) {
        void connection.removeAccountChangeListener(subId);
      }
      clearInterval(pollId);
    };
  }, [connection, mintInput, publicKey, refreshVault]);

  const refreshAudit = useCallback(async () => {
    if (!jwtToken || !vault) return;
    try {
      const res = await listAuditLogs(vault.address, jwtToken);
      setAuditEntries(res.items);
    } catch {
      // ignore transient polling failure
    }
  }, [jwtToken, vault]);

  useEffect(() => {
    void refreshAudit();
    if (!jwtToken || !vault) return;
    const pollId = setInterval(() => {
      void refreshAudit();
    }, 3000);
    return () => clearInterval(pollId);
  }, [jwtToken, refreshAudit, vault]);

  const handleSignIn = async () => {
    if (!publicKey || !vault) return;
    if (!signMessage) {
      setBannerError(
        "Tu wallet no soporta signMessage para iniciar sesión SIWS."
      );
      return;
    }

    setSigningIn(true);
    setBannerError(null);
    try {
      const walletStr = publicKey.toBase58();
      const challenge = await requestSiwsNonce(walletStr);
      const encodedMsg = new TextEncoder().encode(challenge.message);
      const sigBytes = await signMessage(encodedMsg);
      const signatureB58 = bs58.encode(sigBytes);

      const session = await verifySiwsSignature({
        wallet: walletStr,
        vault_address: vault.address,
        nonce: challenge.nonce,
        signature: signatureB58,
      });
      setJwtToken(session.access_token);
      setBannerInfo("Sesión SIWS verificada correctamente.");
    } catch (err) {
      setBannerError(
        err instanceof Error ? err.message : "Error en autenticación SIWS"
      );
    } finally {
      setSigningIn(false);
    }
  };

  const runOnChainAction = async (
    actionKey: string,
    fn: () => Promise<string>,
    successLabel: string
  ) => {
    setBannerError(null);
    setBannerInfo(null);
    setBusyAction(actionKey);
    try {
      const sig = await fn();
      setBannerInfo(`${successLabel} (tx: ${sig.slice(0, 10)}...)`);
      await refreshVault();
    } catch (err) {
      setBannerError(
        err instanceof Error ? err.message : "Transacción rechazada"
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleInitializeVault = async (params: {
    mint: string;
    agent: string;
    maxPerTxUsdc: string;
    dailyLimitUsdc: string;
  }) => {
    if (!anchorWallet) return;
    await runOnChainAction(
      "initialize",
      async () =>
        initializeVaultTx(connection, anchorWallet, {
          mint: new PublicKey(params.mint.trim()),
          agent: new PublicKey(params.agent.trim()),
          maxPerTxBaseUnits: parseUsdcToBaseUnits(params.maxPerTxUsdc),
          dailyLimitBaseUnits: parseUsdcToBaseUnits(params.dailyLimitUsdc),
        }),
      "Bóveda creada on-chain"
    );
  };

  const handleDeposit = async (amountUsdc: string) => {
    if (!anchorWallet || !vault) return;
    await runOnChainAction(
      "deposit",
      async () =>
        depositToVaultTx(connection, anchorWallet, {
          vault: new PublicKey(vault.address),
          mint: new PublicKey(vault.mint),
          amountBaseUnits: parseUsdcToBaseUnits(amountUsdc),
        }),
      `Depósito de ${amountUsdc} Mock USDC confirmado`
    );
  };

  const handleWithdraw = async (amountUsdc: string) => {
    if (!anchorWallet || !vault) return;
    await runOnChainAction(
      "withdraw",
      async () =>
        withdrawFromVaultTx(connection, anchorWallet, {
          vault: new PublicKey(vault.address),
          mint: new PublicKey(vault.mint),
          amountBaseUnits: parseUsdcToBaseUnits(amountUsdc),
        }),
      `Retiro de ${amountUsdc} Mock USDC confirmado`
    );
  };

  const handleUpdatePolicy = async (params: {
    newAgent: string;
    newMaxPerTxUsdc: string;
    newDailyLimitUsdc: string;
  }) => {
    if (!anchorWallet || !vault) return;
    await runOnChainAction(
      "update_policy",
      async () =>
        updatePolicyTx(connection, anchorWallet, {
          vault: new PublicKey(vault.address),
          newAgent: params.newAgent.trim()
            ? new PublicKey(params.newAgent.trim())
            : null,
          newMaxPerTx: params.newMaxPerTxUsdc.trim()
            ? parseUsdcToBaseUnits(params.newMaxPerTxUsdc)
            : null,
          newDailyLimit: params.newDailyLimitUsdc.trim()
            ? parseUsdcToBaseUnits(params.newDailyLimitUsdc)
            : null,
        }),
      "Política actualizada on-chain"
    );
  };

  const handleAddRecipient = async (recipient: string) => {
    if (!anchorWallet || !vault) return;
    await runOnChainAction(
      "add_recipient",
      async () =>
        addRecipientTx(connection, anchorWallet, {
          vault: new PublicKey(vault.address),
          recipient: new PublicKey(recipient.trim()),
        }),
      "Destinatario agregado a la allowlist"
    );
  };

  const handleRemoveRecipient = async (recipient: string) => {
    if (!anchorWallet || !vault) return;
    await runOnChainAction(
      "remove_recipient",
      async () =>
        removeRecipientTx(connection, anchorWallet, {
          vault: new PublicKey(vault.address),
          recipient: new PublicKey(recipient.trim()),
        }),
      "Destinatario eliminado de la allowlist"
    );
  };

  const handleToggleFreeze = async () => {
    if (!anchorWallet || !vault) return;
    setFreezing(true);
    setBannerError(null);
    try {
      const target = !vault.isFrozen;
      await emergencyFreezeTx(connection, anchorWallet, {
        vault: new PublicKey(vault.address),
        freeze: target,
      });
      setBannerInfo(
        target
          ? "Emergency Freeze activado: el agente quedó bloqueado on-chain."
          : "Bóveda descongelada: el agente vuelve a operar dentro de límites."
      );
      await refreshVault();
    } catch (err) {
      setBannerError(
        err instanceof Error ? err.message : "Error cambiando estado de Freeze"
      );
    } finally {
      setFreezing(false);
    }
  };

  const handleSubmitIntent = async (
    payload: Omit<ExecuteIntentRequest, "vault_address">
  ): Promise<ExecuteIntentResponse | null> => {
    if (!jwtToken || !vault) return null;
    setSendingIntent(true);
    setBannerError(null);

    const userMsgId = `u-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", text: payload.prompt },
    ]);

    try {
      const res = await executeAgentIntent(
        {
          vault_address: vault.address,
          ...payload,
        },
        jwtToken
      );
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: res.explanation_es,
          result: res,
          mode: payload.mode,
        },
      ]);

      if (res.status === "NEEDS_RECIPIENT_APPROVAL" && res.recipient_address) {
        setPendingApproval({
          recipient: res.recipient_address,
          lastRequest: payload,
        });
      }

      await Promise.all([refreshVault(), refreshAudit()]);
      return res;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Error ejecutando la intención";
      setBannerError(msg);
      setMessages((prev) => [
        ...prev,
        { id: `e-${Date.now()}`, role: "assistant", text: msg },
      ]);
      return null;
    } finally {
      setSendingIntent(false);
    }
  };

  const handleApproveAndRetryRecipient = async () => {
    if (!pendingApproval || !anchorWallet || !vault) return;
    const { recipient, lastRequest } = pendingApproval;
    setSendingIntent(true);
    setBannerError(null);
    try {
      await addRecipientTx(connection, anchorWallet, {
        vault: new PublicKey(vault.address),
        recipient: new PublicKey(recipient),
      });
      await refreshVault();
      setPendingApproval(null);
      await handleSubmitIntent(lastRequest);
    } catch (err) {
      setBannerError(
        err instanceof Error
          ? err.message
          : "No se pudo firmar add_recipient"
      );
      setSendingIntent(false);
    }
  };

  const isOwner = Boolean(
    connectedWallet && vault && connectedWallet === vault.owner
  );
  const hasFunds = Boolean(vault && vault.vaultTokenBalance > 0n);
  const hasAllowlist = Boolean(vault && vault.recipientCount > 0);

  const flowSteps = [
    { id: 1, label: "1. Conectar", done: Boolean(connectedWallet) },
    { id: 2, label: "2. Crear bóveda", done: Boolean(vault) },
    { id: 3, label: "3. Iniciar sesión", done: Boolean(jwtToken) },
    { id: 4, label: "4. Depositar y allowlist", done: hasFunds && hasAllowlist },
    {
      id: 5,
      label: "5. Demo en vivo",
      done: Boolean(jwtToken && hasFunds && hasAllowlist && auditEntries.length > 0),
    },
  ];
  const firstIncomplete = flowSteps.find((s) => !s.done)?.id ?? 5;

  return (
    <div className="min-h-screen bg-kipu-bg text-zinc-100">
      <TopBar
        connectedWallet={connectedWallet}
        isAuthenticated={Boolean(jwtToken)}
        signingIn={signingIn}
        onSignIn={handleSignIn}
        vault={vault}
        freezing={freezing}
        onToggleFreeze={handleToggleFreeze}
        agentSolBalance={health?.agent_sol_balance ?? null}
        lowSolWarning={Boolean(health?.low_sol_warning)}
      />

      <main className="mx-auto max-w-[1440px] space-y-3 px-4 py-3.5 sm:px-6">
        {/* Guided Demo Day Stepper */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-kipu-border bg-kipu-card px-3.5 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {flowSteps.map((step) => {
              const isCurrent = step.id === firstIncomplete;
              return (
                <span
                  key={step.id}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${
                    step.done
                      ? "border-kipu-emerald/40 bg-kipu-emerald/10 text-kipu-emerald"
                      : isCurrent
                        ? "border-kipu-gold bg-kipu-gold/15 font-semibold text-kipu-gold"
                        : "border-kipu-border bg-kipu-bg text-zinc-400"
                  }`}
                >
                  <span>{step.done ? "✓" : "○"}</span>
                  <span>{step.label}</span>
                </span>
              );
            })}
          </div>

          {firstIncomplete === 3 && vault && !jwtToken && (
            <button
              type="button"
              disabled={signingIn}
              onClick={() => void handleSignIn()}
              className="rounded-md bg-kipu-gold px-3 py-1 text-xs font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {signingIn ? "Firmando SIWS..." : "Firmar SIWS ahora →"}
            </button>
          )}
          {firstIncomplete === 4 && (
            <span className="text-xs font-medium text-kipu-gold">
              Falta {!hasFunds ? "depositar Mock USDC" : ""}
              {!hasFunds && !hasAllowlist ? " y " : ""}
              {!hasAllowlist ? "agregar destinatario a allowlist" : ""} en Políticas
            </span>
          )}
          {firstIncomplete === 5 && (
            <span className="text-xs font-medium text-kipu-emerald">
              Listo para presentar pasos 1 → 4 en Copilot
            </span>
          )}
        </div>

        {bannerError && (
          <div className="flex items-center justify-between rounded-lg border border-kipu-crimson/60 bg-kipu-crimson/10 px-4 py-2 text-xs text-red-200">
            <span>{bannerError}</span>
            <button
              type="button"
              onClick={() => setBannerError(null)}
              className="ml-4 text-red-300 hover:text-white"
            >
              Cerrar
            </button>
          </div>
        )}

        {bannerInfo && (
          <div className="flex items-center justify-between rounded-lg border border-kipu-emerald/50 bg-kipu-emerald/10 px-4 py-2 text-xs text-emerald-200">
            <span>{bannerInfo}</span>
            <button
              type="button"
              onClick={() => setBannerInfo(null)}
              className="ml-4 text-emerald-300 hover:text-white"
            >
              Cerrar
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <PolicyPanel
              mintInput={mintInput}
              onChangeMintInput={setMintInput}
              defaultAgentPubkey={health?.agent_pubkey ?? ""}
              vault={vault}
              connectedWallet={connectedWallet}
              loadingVault={loadingVault}
              onRefreshVault={refreshVault}
              onInitializeVault={handleInitializeVault}
              onDeposit={handleDeposit}
              onWithdraw={handleWithdraw}
              onUpdatePolicy={handleUpdatePolicy}
              onAddRecipient={handleAddRecipient}
              onRemoveRecipient={handleRemoveRecipient}
              busyAction={busyAction}
            />
          </div>

          <div className="flex flex-col gap-3 lg:col-span-8">
            <KipuCopilot
              demoMode={Boolean(health?.demo_mode)}
              isAuthenticated={Boolean(jwtToken)}
              isOwner={isOwner}
              isFrozen={Boolean(vault?.isFrozen)}
              hasFunds={hasFunds}
              freezing={freezing}
              onToggleFreeze={handleToggleFreeze}
              vaultAddress={vault?.address ?? null}
              demoRecipientAddress={demoRecipientAddress}
              onChangeDemoRecipient={setDemoRecipientAddress}
              attackerAddress={attackerAddress}
              onChangeAttackerAddress={setAttackerAddress}
              onSubmitIntent={handleSubmitIntent}
              pendingApproval={pendingApproval}
              onApproveAndRetryRecipient={handleApproveAndRetryRecipient}
              onDismissApproval={() => setPendingApproval(null)}
              sending={sendingIntent}
              messages={messages}
            />

            <AuditLedger
              entries={auditEntries}
              onVerifyTx={(sig) => verifyAuditTx(sig)}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
