"use client";

import React, { createContext, useContext, useMemo, useState } from "react";
import { PollarProvider, usePollar } from "@pollar/react";
import "@pollar/react/styles.css";
import type { SubmitOutcome } from "@pollar/core";
import {
  Check,
  Copy,
  ExternalLink,
  History,
  LogOut,
  Send,
  Sparkles,
  UserCheck,
  Wallet,
} from "lucide-react";
import { FRONTEND_CONFIG } from "@/lib/config";
import { explorerAddressUrl, explorerTxUrl, truncateMiddle } from "@/lib/format";

interface PollarBridgeValue {
  configured: boolean;
  isAuthenticated: boolean;
  verified: boolean;
  hasWallet: boolean;
  solanaAddress: string | null;
  providerLabel: string | null;
  openLoginModal: () => void;
  createWallet: () => Promise<void>;
  openWalletBalanceModal: () => void;
  openSendModal: () => void;
  openReceiveModal: () => void;
  openTxHistoryModal: () => void;
  logout: () => void;
  sendSolanaPayment: (params: {
    destination: string;
    amountBaseUnits: string;
    mint?: string | null;
  }) => Promise<SubmitOutcome>;
}

const DEFAULT_BRIDGE: PollarBridgeValue = {
  configured: false,
  isAuthenticated: false,
  verified: false,
  hasWallet: false,
  solanaAddress: null,
  providerLabel: null,
  openLoginModal: () => {},
  createWallet: async () => {},
  openWalletBalanceModal: () => {},
  openSendModal: () => {},
  openReceiveModal: () => {},
  openTxHistoryModal: () => {},
  logout: () => {},
  sendSolanaPayment: async () => ({
    status: "error",
    details: "Pollar Publishable Key no configurada.",
  }),
};

const PollarBridgeContext = createContext<PollarBridgeValue>(DEFAULT_BRIDGE);

export function usePollarBridge(): PollarBridgeValue {
  return useContext(PollarBridgeContext);
}

function PollarBridgeInner({ children }: { children: React.ReactNode }) {
  const pollar = usePollar();

  const value = useMemo<PollarBridgeValue>(() => {
    const solWallet =
      pollar.wallets.find((w) => w.chain === "SOLANA") ??
      (pollar.wallet && (!pollar.wallet.chain || pollar.wallet.chain === "SOLANA")
        ? pollar.wallet
        : null);

    return {
      configured: true,
      isAuthenticated: pollar.isAuthenticated,
      verified: pollar.verified,
      hasWallet: pollar.hasWallet,
      solanaAddress: solWallet?.address ?? null,
      providerLabel: solWallet?.provider ?? null,
      openLoginModal: pollar.openLoginModal,
      createWallet: async () => {
        await pollar.createWallet();
      },
      openWalletBalanceModal: pollar.openWalletBalanceModal,
      openSendModal: pollar.openSendModal,
      openReceiveModal: pollar.openReceiveModal,
      openTxHistoryModal: pollar.openTxHistoryModal,
      logout: pollar.logout,
      sendSolanaPayment: ({ destination, amountBaseUnits, mint }) =>
        pollar.sendPayment({
          chain: "SOLANA",
          destination,
          amount: amountBaseUnits,
          ...(mint ? { mint } : {}),
        }),
    };
  }, [pollar]);

  return (
    <PollarBridgeContext.Provider value={value}>
      {children}
    </PollarBridgeContext.Provider>
  );
}

/**
 * Mounts PollarProvider only when NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY is present,
 * keeping existing Phantom/Solflare and Sandbox flows unaffected otherwise.
 */
export function PollarOptionalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const apiKey = FRONTEND_CONFIG.pollarPublishableKey.trim();

  if (!apiKey) {
    return (
      <PollarBridgeContext.Provider value={DEFAULT_BRIDGE}>
        {children}
      </PollarBridgeContext.Provider>
    );
  }

  return (
    <PollarProvider client={{ apiKey }}>
      <PollarBridgeInner>{children}</PollarBridgeInner>
    </PollarProvider>
  );
}

interface PollarPayCardProps {
  demoRecipientAddress: string;
  onSelectAsDemoRecipient: (addr: string) => void;
  vaultAddress: string | null;
  mintAddress: string;
}

export function PollarPayCard({
  demoRecipientAddress,
  onSelectAsDemoRecipient,
  vaultAddress,
  mintAddress,
}: PollarPayCardProps) {
  const pollar = usePollarBridge();
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [creatingWallet, setCreatingWallet] = useState(false);
  const [payDestination, setPayDestination] = useState(demoRecipientAddress);
  const [paySolAmount, setPaySolAmount] = useState("0.001");
  const [payTokenMode, setPayTokenMode] = useState<"SOL" | "SPL">("SOL");
  const [sending, setSending] = useState(false);
  const [txResult, setTxResult] = useState<{
    ok: boolean;
    message: string;
    hash?: string;
  } | null>(null);

  const handleCopy = async (addr: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(addr);
        setCopiedAddr(true);
        window.setTimeout(() => setCopiedAddr(false), 1600);
      }
    } catch {
      setCopiedAddr(false);
    }
  };

  const handleDirectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = payDestination.trim();
    const numeric = Number(paySolAmount);
    if (!target || !Number.isFinite(numeric) || numeric <= 0) {
      setTxResult({
        ok: false,
        message: "Ingresa un destinatario Solana y un monto mayor a 0.",
      });
      return;
    }

    setSending(true);
    setTxResult(null);
    try {
      const decimals = payTokenMode === "SOL" ? 1_000_000_000 : 1_000_000;
      const baseUnits = String(Math.round(numeric * decimals));
      const outcome = await pollar.sendSolanaPayment({
        destination: target,
        amountBaseUnits: baseUnits,
        mint: payTokenMode === "SPL" ? mintAddress : null,
      });

      if (outcome.status === "success" || outcome.status === "pending") {
        setTxResult({
          ok: true,
          message:
            outcome.status === "success"
              ? "Pago ejecutado vía Pollar SDK en Solana."
              : "Transacción enviada (pendiente de confirmación).",
          hash: outcome.hash,
        });
      } else if (outcome.status === "cosign_pending") {
        setTxResult({
          ok: true,
          message: "Solicitud enviada para co-firma en tu dispositivo Pollar.",
        });
      } else {
        setTxResult({
          ok: false,
          message:
            outcome.details ||
            outcome.resultCode ||
            "No se pudo completar el pago Pollar.",
          hash: outcome.hash,
        });
      }
    } catch (err) {
      setTxResult({
        ok: false,
        message:
          err instanceof Error ? err.message : "Error enviando pago con Pollar.",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <section
      aria-label="Pollar Onboarding y Pagos Solana"
      className="kipu-card-glow rounded-2xl border border-kipu-border p-4"
    >
      <div className="flex items-start justify-between gap-2 border-b border-kipu-border pb-3">
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-kipu-text">
              <Sparkles className="h-3.5 w-3.5 text-kipu-gold" />
              Pollar Pay &amp; Wallet
            </span>
            <span className="rounded-full border border-kipu-gold/30 bg-kipu-gold/10 px-2 py-0.5 font-mono text-[10px] text-kipu-gold">
              @pollar/react
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-400">
            Onboarding social (Email/Google) y pagos Solana sin extensión móvil.
          </p>
        </div>

        {pollar.configured && pollar.isAuthenticated && (
          <button
            type="button"
            onClick={pollar.logout}
            title="Cerrar sesión Pollar"
            className="rounded-lg border border-kipu-border bg-kipu-bg p-1.5 text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {!pollar.configured ? (
        <div className="mt-3 space-y-2.5 text-xs">
          <p className="rounded-xl border border-kipu-border bg-kipu-bg/80 p-3 leading-relaxed text-zinc-300">
            El SDK de Pollar está integrado y listo. Agrega tu clave pública{" "}
            <code className="font-mono text-[11px] text-kipu-gold">
              NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY
            </code>{" "}
            en <code className="font-mono text-[11px]">.env.local</code> o Vercel
            para activar login social y pagos Solana Devnet.
          </p>
          <a
            href="https://dashboard.pollar.xyz"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-medium text-kipu-gold hover:underline"
          >
            <span>Obtener Publishable Key en dashboard.pollar.xyz</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      ) : !pollar.isAuthenticated ? (
        <div className="mt-3 space-y-2.5">
          <button
            type="button"
            onClick={pollar.openLoginModal}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-kipu-gold px-3.5 py-2.5 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400"
          >
            <UserCheck className="h-4 w-4" />
            <span>Conectar con Pollar (Email / Google)</span>
          </button>
          <p className="text-[11px] leading-relaxed text-zinc-400">
            Ideal para celulares sin Phantom instalada: crea tu wallet Solana y
            úsala como destinatario autorizado o paga servicios en Devnet.
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {/* Connected Pollar Solana Address */}
          <div className="rounded-xl border border-kipu-emerald/35 bg-kipu-emerald/[0.06] p-3">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="font-semibold text-kipu-emerald">
                Wallet Pollar activa
                {pollar.providerLabel ? ` · ${pollar.providerLabel}` : ""}
              </span>
              {!pollar.verified && (
                <span className="font-mono text-[10px] text-kipu-gold">
                  Verificando sesión...
                </span>
              )}
            </div>

            {pollar.solanaAddress ? (
              <>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <a
                    href={explorerAddressUrl(pollar.solanaAddress)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs text-zinc-100 hover:text-kipu-gold hover:underline"
                  >
                    {truncateMiddle(pollar.solanaAddress, 8, 6)}
                  </a>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void handleCopy(pollar.solanaAddress!)}
                      className="inline-flex items-center gap-1 rounded border border-kipu-border bg-kipu-bg px-2 py-1 text-[10px] text-zinc-300 hover:border-zinc-600"
                    >
                      {copiedAddr ? (
                        <>
                          <Check className="h-3 w-3 text-kipu-emerald" />
                          <span>Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectAsDemoRecipient(pollar.solanaAddress!)}
                      className="rounded border border-kipu-gold/40 bg-kipu-gold/10 px-2 py-1 text-[10px] font-medium text-kipu-gold hover:bg-kipu-gold/20"
                    >
                      Usar como destino
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="mt-2 space-y-2">
                <p className="text-[11px] text-zinc-300">
                  Sesión iniciada. Si no ves tu dirección Solana, habilita{" "}
                  <strong>Solana</strong> en Pollar Dashboard o genera la wallet
                  ahora:
                </p>
                {!pollar.hasWallet && (
                  <button
                    type="button"
                    disabled={creatingWallet}
                    onClick={async () => {
                      setCreatingWallet(true);
                      try {
                        await pollar.createWallet();
                      } finally {
                        setCreatingWallet(false);
                      }
                    }}
                    className="rounded-lg border border-kipu-gold/50 bg-kipu-gold/15 px-3 py-1.5 text-[11px] font-semibold text-kipu-gold transition hover:bg-kipu-gold/25 disabled:opacity-50"
                  >
                    {creatingWallet ? "Creando wallet..." : "Crear wallet Solana ahora"}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Native Pollar Modal triggers */}
          <div className="grid grid-cols-3 gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={pollar.openWalletBalanceModal}
              className="inline-flex items-center justify-center gap-1 rounded-lg border border-kipu-border bg-kipu-bg px-2 py-1.5 text-zinc-200 transition hover:border-zinc-600"
            >
              <Wallet className="h-3 w-3 text-kipu-gold" />
              <span>Balance</span>
            </button>
            <button
              type="button"
              onClick={pollar.openReceiveModal}
              className="inline-flex items-center justify-center gap-1 rounded-lg border border-kipu-border bg-kipu-bg px-2 py-1.5 text-zinc-200 transition hover:border-zinc-600"
            >
              <span>Recibir</span>
            </button>
            <button
              type="button"
              onClick={pollar.openTxHistoryModal}
              className="inline-flex items-center justify-center gap-1 rounded-lg border border-kipu-border bg-kipu-bg px-2 py-1.5 text-zinc-200 transition hover:border-zinc-600"
            >
              <History className="h-3 w-3 text-kipu-emerald" />
              <span>Historial</span>
            </button>
          </div>

          {/* Direct sendPayment({ chain: 'SOLANA' }) flow */}
          <form
            onSubmit={handleDirectPayment}
            className="space-y-2 rounded-xl border border-kipu-border bg-kipu-bg/70 p-3"
          >
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="font-medium text-zinc-300">
                Pago directo Solana (SDK)
              </span>
              <div className="flex items-center gap-1">
                {vaultAddress && (
                  <button
                    type="button"
                    onClick={() => setPayDestination(vaultAddress)}
                    className="rounded border border-kipu-border bg-kipu-card px-1.5 py-0.5 text-[10px] text-zinc-300 hover:border-kipu-gold/50 hover:text-kipu-gold"
                  >
                    A bóveda
                  </button>
                )}
                <button
                  type="button"
                  onClick={pollar.openSendModal}
                  className="rounded border border-kipu-border bg-kipu-card px-1.5 py-0.5 text-[10px] text-zinc-300 hover:border-zinc-600"
                >
                  Modal Pollar
                </button>
              </div>
            </div>

            <input
              type="text"
              value={payDestination}
              onChange={(e) => setPayDestination(e.target.value)}
              placeholder="Dirección destino Solana"
              className="w-full rounded-lg border border-kipu-border bg-kipu-card px-2.5 py-1.5 font-mono text-[11px] text-zinc-100 placeholder:text-zinc-500 focus:border-kipu-gold focus:outline-none"
            />

            <div className="flex items-center gap-2">
              <input
                type="number"
                step="any"
                min="0"
                value={paySolAmount}
                onChange={(e) => setPaySolAmount(e.target.value)}
                className="w-24 rounded-lg border border-kipu-border bg-kipu-card px-2.5 py-1.5 font-mono text-xs text-zinc-100 focus:border-kipu-gold focus:outline-none"
              />
              <select
                value={payTokenMode}
                onChange={(e) =>
                  setPayTokenMode(e.target.value as "SOL" | "SPL")
                }
                aria-label="Activo Pollar"
                className="rounded-lg border border-kipu-border bg-kipu-card px-2 py-1.5 text-xs text-zinc-200 focus:border-kipu-gold focus:outline-none"
              >
                <option value="SOL">SOL</option>
                <option value="SPL">Mock USDC</option>
              </select>
              <button
                type="submit"
                disabled={sending || !pollar.verified}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-kipu-gold px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{sending ? "Enviando..." : "Enviar"}</span>
              </button>
            </div>

            {txResult && (
              <div
                className={`rounded-lg border px-2.5 py-2 text-[11px] ${
                  txResult.ok
                    ? "border-kipu-emerald/40 bg-kipu-emerald/10 text-emerald-200"
                    : "border-kipu-crimson/40 bg-kipu-crimson/10 text-red-200"
                }`}
              >
                <p>{txResult.message}</p>
                {txResult.hash && (
                  <a
                    href={explorerTxUrl(txResult.hash)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 font-mono text-kipu-gold hover:underline"
                  >
                    <span>{truncateMiddle(txResult.hash, 8, 6)}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}
          </form>
        </div>
      )}
    </section>
  );
}
