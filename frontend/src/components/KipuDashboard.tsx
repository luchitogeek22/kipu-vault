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
import {
  formatBaseUnitsAsUsdc,
  parseUsdcToBaseUnits,
} from "@/lib/format";
import { FRONTEND_CONFIG } from "@/lib/config";
import {
  UX_STORAGE_KEYS,
  humanizeUiError,
  readExperienceLevel,
  readStorageFlag,
  writeExperienceLevel,
  writeStorageFlag,
  type ExperienceLevel,
  type SecurityTimelinePoint,
} from "@/lib/ux";
import { TopBar } from "./TopBar";
import { PolicyPanel } from "./PolicyPanel";
import { KipuCopilot, type CopilotMessage } from "./KipuCopilot";
import { AuditLedger } from "./AuditLedger";
import { WelcomeScreen } from "./WelcomeScreen";
import { OnboardingWizard } from "./OnboardingWizard";
import { ProductTour } from "./ProductTour";
import { DashboardOverview } from "./DashboardOverview";
import { HelpDrawer } from "./HelpDrawer";
import { SidebarNav } from "./SidebarNav";

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

  // UX / Onboarding state (root "/" always opens Landing Page by default; ?app=1 jumps straight to Panel)
  const [uxReady, setUxReady] = useState(false);
  const [experienceLevel, setExperienceLevel] =
    useState<ExperienceLevel>("beginner");
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourNeverAuto, setTourNeverAuto] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Interactive Sandbox telemetry (clearly isolated from real on-chain data)
  const [sandboxBalanceUsdc, setSandboxBalanceUsdc] = useState(100);
  const [sandboxFrozen, setSandboxFrozen] = useState(false);
  const [sandboxEvents, setSandboxEvents] = useState<SecurityTimelinePoint[]>([]);

  const connectedWallet = publicKey ? publicKey.toBase58() : null;
  const lastWalletRef = useRef<string | null>(null);

  useEffect(() => {
    const level = readExperienceLevel();
    const wizDismissed = readStorageFlag(UX_STORAGE_KEYS.wizardDismissed);
    const neverAuto = readStorageFlag(UX_STORAGE_KEYS.tourNeverAuto);
    const params =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : null;
    const directPanel =
      params?.get("app") === "1" || params?.get("panel") === "1";

    setExperienceLevel(level);
    setWelcomeDismissed(directPanel);
    setWizardOpen(directPanel && level !== "advanced" && !wizDismissed);
    setTourNeverAuto(neverAuto);
    setUxReady(true);
  }, []);

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

  const refreshVault = useCallback(
    async (silent = false) => {
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

      if (!silent) {
        setLoadingVault(true);
      }
      try {
        const vaultPda = deriveVaultPda(publicKey, mintPk);
        const state = await fetchVaultStateOnChain(connection, vaultPda);
        setVault(state);
        if (state && state.allowedRecipients[0] && !demoRecipientAddress) {
          setDemoRecipientAddress(state.allowedRecipients[0]);
        }
      } catch (err) {
        if (!silent) {
          const msg =
            err instanceof Error ? err.message : "Error leyendo VaultState";
          setBannerError(humanizeUiError(msg));
        }
      } finally {
        if (!silent) {
          setLoadingVault(false);
        }
      }
    },
    [connection, demoRecipientAddress, mintInput, publicKey]
  );

  // Refresh vault when owner + mint changes + live subscription + 3s fallback polling
  useEffect(() => {
    void refreshVault(false);
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
          void refreshVault(true);
        },
        "confirmed"
      );
    } catch {
      subId = null;
    }

    const pollId = setInterval(() => {
      void refreshVault(true);
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.toLowerCase().includes("expirada") || msg.includes("401")) {
        setJwtToken(null);
      }
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
      const msg =
        err instanceof Error ? err.message : "Error en autenticación SIWS";
      setBannerError(humanizeUiError(msg));
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
      const msg =
        err instanceof Error ? err.message : "Transacción rechazada";
      setBannerError(humanizeUiError(msg));
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
      const msg =
        err instanceof Error ? err.message : "Error cambiando estado de Freeze";
      setBannerError(humanizeUiError(msg));
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
      const rawMsg =
        err instanceof Error ? err.message : "Error ejecutando la intención";
      if (rawMsg.toLowerCase().includes("expirada") || rawMsg.includes("401")) {
        setJwtToken(null);
      }
      const friendly = humanizeUiError(rawMsg);
      setBannerError(friendly);
      setMessages((prev) => [
        ...prev,
        { id: `e-${Date.now()}`, role: "assistant", text: friendly },
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
      const msg =
        err instanceof Error
          ? err.message
          : "No se pudo firmar add_recipient";
      setBannerError(humanizeUiError(msg));
      setSendingIntent(false);
    }
  };

  const handleChangeExperienceLevel = (level: ExperienceLevel) => {
    setExperienceLevel(level);
    writeExperienceLevel(level);
    if (level === "advanced") {
      setWelcomeDismissed(true);
      setWizardOpen(false);
      setTourOpen(false);
      writeStorageFlag(UX_STORAGE_KEYS.welcomeDismissed, true);
    }
  };

  const handleStartSetup = () => {
    if (experienceLevel === "advanced") {
      setExperienceLevel("beginner");
      writeExperienceLevel("beginner");
    }
    writeStorageFlag(UX_STORAGE_KEYS.welcomeDismissed, true);
    writeStorageFlag(UX_STORAGE_KEYS.wizardDismissed, false);
    setWelcomeDismissed(true);
    setWizardOpen(true);
  };

  const handleViewDemo = () => {
    if (experienceLevel === "advanced") {
      setExperienceLevel("beginner");
      writeExperienceLevel("beginner");
    }
    writeStorageFlag(UX_STORAGE_KEYS.welcomeDismissed, true);
    setWelcomeDismissed(true);
    setWizardOpen(false);
    if (!readStorageFlag(UX_STORAGE_KEYS.tourNeverAuto)) {
      setTourOpen(true);
    }
  };

  const handleSkipAdvanced = () => {
    const nextLevel =
      experienceLevel === "advanced" ? "advanced" : "intermediate";
    writeExperienceLevel(nextLevel);
    writeStorageFlag(UX_STORAGE_KEYS.welcomeDismissed, true);
    writeStorageFlag(UX_STORAGE_KEYS.wizardDismissed, true);
    writeStorageFlag(UX_STORAGE_KEYS.tourCompleted, true);
    setExperienceLevel(nextLevel);
    setWelcomeDismissed(true);
    setWizardOpen(false);
    setTourOpen(false);
  };

  const handleDismissWizard = () => {
    writeStorageFlag(UX_STORAGE_KEYS.wizardDismissed, true);
    setWizardOpen(false);
  };

  const handleCompleteWizardAndStartTour = () => {
    writeStorageFlag(UX_STORAGE_KEYS.wizardDismissed, true);
    setWizardOpen(false);
    if (experienceLevel !== "advanced") {
      setTourOpen(true);
    }
  };

  const handleToggleNeverShowAuto = (val: boolean) => {
    setTourNeverAuto(val);
    writeStorageFlag(UX_STORAGE_KEYS.tourNeverAuto, val);
  };

  const handleCloseTour = (completed: boolean) => {
    setTourOpen(false);
    if (completed) {
      writeStorageFlag(UX_STORAGE_KEYS.tourCompleted, true);
    }
  };

  const isOwner = Boolean(
    connectedWallet && vault && connectedWallet === vault.owner
  );
  const hasFunds = Boolean(vault && vault.vaultTokenBalance > 0n);
  const maxPerTxDisplay = vault
    ? `${formatBaseUnitsAsUsdc(vault.maxPerTx)} Mock USDC`
    : "—";
  const dailyRemainingRaw = vault
    ? vault.dailyLimit > vault.spentToday
      ? vault.dailyLimit - vault.spentToday
      : BigInt(0)
    : BigInt(0);
  const dailyRemainingDisplay = vault
    ? `${formatBaseUnitsAsUsdc(dailyRemainingRaw)} Mock USDC`
    : "—";

  if (!uxReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-kipu-bg text-xs text-zinc-400">
        Cargando experiencia KipuVault...
      </div>
    );
  }

  if (!welcomeDismissed) {
    return (
      <WelcomeScreen
        onStartSetup={handleStartSetup}
        onViewDemo={handleViewDemo}
        onSkipAdvanced={handleSkipAdvanced}
      />
    );
  }

  return (
    <div className="flex min-h-screen bg-kipu-bg text-zinc-100">
      <SidebarNav
        showWizardAction={experienceLevel !== "advanced" && !wizardOpen}
        onOpenWizard={() => {
          writeStorageFlag(UX_STORAGE_KEYS.wizardDismissed, false);
          setWizardOpen(true);
        }}
        onOpenHelp={() => setHelpOpen(true)}
        onOpenWelcome={() => {
          writeStorageFlag(UX_STORAGE_KEYS.welcomeDismissed, false);
          setWelcomeDismissed(false);
        }}
        isRealVault={Boolean(vault)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
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
          experienceLevel={experienceLevel}
          onChangeExperienceLevel={handleChangeExperienceLevel}
          onOpenHelp={() => setHelpOpen(true)}
          onOpenWelcome={() => {
            writeStorageFlag(UX_STORAGE_KEYS.welcomeDismissed, false);
            setWelcomeDismissed(false);
          }}
          showWizardButton={experienceLevel !== "advanced" && !wizardOpen}
          onOpenWizard={() => {
            writeStorageFlag(UX_STORAGE_KEYS.wizardDismissed, false);
            setWizardOpen(true);
          }}
        />

        <main className="mx-auto w-full max-w-[1440px] space-y-3.5 px-4 py-4 sm:px-6">
        <DashboardOverview
          vault={vault}
          loadingVault={loadingVault}
          connectedWallet={connectedWallet}
          isAuthenticated={Boolean(jwtToken)}
          lowSolWarning={Boolean(health?.low_sol_warning)}
          auditEntries={auditEntries}
          sandboxEvents={sandboxEvents}
          sandboxBalanceUsdc={sandboxBalanceUsdc}
          sandboxFrozen={sandboxFrozen}
          experienceLevel={experienceLevel}
        />

        {wizardOpen && experienceLevel !== "advanced" && (
          <OnboardingWizard
            connectedWallet={connectedWallet}
            vault={vault}
            isAuthenticated={Boolean(jwtToken)}
            signingIn={signingIn}
            onSignIn={handleSignIn}
            mintInput={mintInput}
            onChangeMintInput={setMintInput}
            defaultAgentPubkey={health?.agent_pubkey ?? ""}
            onInitializeVault={handleInitializeVault}
            onUpdatePolicy={handleUpdatePolicy}
            onAddRecipient={handleAddRecipient}
            onDeposit={handleDeposit}
            onToggleFreeze={handleToggleFreeze}
            busyAction={busyAction}
            freezing={freezing}
            errorMessage={bannerError}
            onDismissWizard={handleDismissWizard}
            onCompleteAndStartTour={handleCompleteWizardAndStartTour}
          />
        )}

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
          <div id="sec-copilot" className="flex flex-col gap-3 lg:col-span-8">
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
              experienceLevel={experienceLevel}
              maxPerTxDisplay={maxPerTxDisplay}
              dailyRemainingDisplay={dailyRemainingDisplay}
              allowedCount={vault?.recipientCount ?? 0}
              sandboxFrozen={sandboxFrozen}
              onSandboxToggleFreeze={() => {
                const next = !sandboxFrozen;
                setSandboxFrozen(next);
                return next;
              }}
              onSandboxRecord={(point) => {
                setSandboxEvents((prev) => [...prev, point]);
                if (point.status === "EXECUTED" && point.amountUsdc > 0) {
                  setSandboxBalanceUsdc((prev) =>
                    Math.max(0, Number((prev - point.amountUsdc).toFixed(2)))
                  );
                }
              }}
            />
          </div>

          <div id="sec-config" className="lg:col-span-4">
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
              freezing={freezing}
              onToggleFreeze={handleToggleFreeze}
              experienceLevel={experienceLevel}
            />
          </div>
        </div>

        <div id="sec-activity">
          <AuditLedger
            entries={auditEntries}
            sandboxEvents={sandboxEvents}
            onVerifyTx={(sig) => verifyAuditTx(sig)}
            experienceLevel={experienceLevel}
            isFrozen={vault ? Boolean(vault.isFrozen) : sandboxFrozen}
            isAuthenticated={Boolean(jwtToken)}
          />
        </div>
      </main>
      </div>

      <ProductTour
        open={tourOpen}
        neverShowAuto={tourNeverAuto}
        onToggleNeverShowAuto={handleToggleNeverShowAuto}
        onClose={handleCloseTour}
      />

      <HelpDrawer
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        onRestartTour={() => {
          setHelpOpen(false);
          if (experienceLevel === "advanced") {
            setExperienceLevel("beginner");
            writeExperienceLevel("beginner");
          }
          setTourOpen(true);
        }}
        onOpenWizard={() => {
          setHelpOpen(false);
          if (experienceLevel === "advanced") {
            setExperienceLevel("beginner");
            writeExperienceLevel("beginner");
          }
          writeStorageFlag(UX_STORAGE_KEYS.welcomeDismissed, true);
          writeStorageFlag(UX_STORAGE_KEYS.wizardDismissed, false);
          setWelcomeDismissed(true);
          setWizardOpen(true);
        }}
        onOpenWelcome={() => {
          setHelpOpen(false);
          writeStorageFlag(UX_STORAGE_KEYS.welcomeDismissed, false);
          setWelcomeDismissed(false);
        }}
      />
    </div>
  );
}
