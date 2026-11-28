"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import {
  SolanaMobileWalletAdapter,
  createDefaultAddressSelector,
  createDefaultAuthorizationResultCache,
} from "@solana-mobile/wallet-adapter-mobile";
import { ExternalLink, ShieldCheck, Smartphone, X } from "lucide-react";
import "@solana/wallet-adapter-react-ui/styles.css";
import { FRONTEND_CONFIG } from "@/lib/config";

export function SolanaProviders({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [mobileModalOpen, setMobileModalOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleMobileWalletNotFound = useCallback(async () => {
    setMobileModalOpen(true);
  }, []);

  const wallets = useMemo(() => {
    const base = [new PhantomWalletAdapter(), new SolflareWalletAdapter()];
    if (!mounted || typeof window === "undefined") {
      return base;
    }

    const origin = `${window.location.protocol}//${window.location.host}`;
    const mobileAdapter = new SolanaMobileWalletAdapter({
      addressSelector: createDefaultAddressSelector(),
      appIdentity: {
        name: "KipuVault",
        uri: origin,
      },
      authorizationResultCache: createDefaultAuthorizationResultCache(),
      chain: "solana:devnet",
      onWalletNotFound: handleMobileWalletNotFound,
    });

    return [mobileAdapter, ...base];
  }, [handleMobileWalletNotFound, mounted]);

  // Silenciar console.error para rechazos del usuario (lo maneja KipuDashboard inline)
  // y evitar que Next.js dev overlay bloquee la pantalla en presentaciones.
  const handleWalletError = useCallback((error: Error) => {
    const msg = error?.message ?? "";
    const lower = msg.toLowerCase();
    if (
      typeof navigator !== "undefined" &&
      /android|iphone|ipad|ipod/i.test(navigator.userAgent) &&
      (lower.includes("not found") ||
        lower.includes("walletnotfound") ||
        error?.name === "WalletNotFoundError")
    ) {
      setMobileModalOpen(true);
    }

    if (lower.includes("rejected") || lower.includes("cancel")) {
      console.warn("[KipuVault Wallet]", error.name, msg);
      return;
    }
    console.warn("[KipuVault Wallet Error]", error.name, msg);
  }, []);

  const deepLinks = useMemo(() => {
    if (!mounted || typeof window === "undefined") {
      return {
        phantom: "https://phantom.app/ul/browse/https%3A%2F%2Fkipu-vault.vercel.app%2F%3Fapp%3D1",
        solflare: "https://solflare.com/ul/v1/browse/https%3A%2F%2Fkipu-vault.vercel.app%2F%3Fapp%3D1",
      };
    }
    const targetUrl = `${window.location.origin}${window.location.pathname}?app=1`;
    const refOrigin = window.location.origin;
    return {
      phantom: `https://phantom.app/ul/browse/${encodeURIComponent(targetUrl)}?ref=${encodeURIComponent(refOrigin)}`,
      solflare: `https://solflare.com/ul/v1/browse/${encodeURIComponent(targetUrl)}?ref=${encodeURIComponent(refOrigin)}`,
    };
  }, [mounted]);

  return (
    <ConnectionProvider endpoint={FRONTEND_CONFIG.solanaRpcUrl}>
      <WalletProvider
        wallets={wallets}
        onError={handleWalletError}
        autoConnect
      >
        <WalletModalProvider>
          {children}

          {mobileModalOpen && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="kipu-mobile-wallet-title"
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 backdrop-blur-sm sm:items-center"
            >
              <div className="w-full max-w-md rounded-2xl border border-kipu-border bg-kipu-card p-5 shadow-2xl">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-kipu-gold/40 bg-kipu-gold/10 text-kipu-gold">
                      <Smartphone className="h-4 w-4" />
                    </span>
                    <div>
                      <h2
                        id="kipu-mobile-wallet-title"
                        className="font-display text-base font-bold text-kipu-text"
                      >
                        Conectar wallet en celular
                      </h2>
                      <p className="text-[11px] text-zinc-400">
                        Solana Devnet · Deep Link directo
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileModalOpen(false)}
                    aria-label="Cerrar"
                    className="rounded-lg border border-kipu-border bg-kipu-bg p-1.5 text-zinc-400 hover:text-zinc-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-zinc-300">
                  Chrome móvil no tiene extensión inyectada y no respondió ninguna
                  app compatible por Mobile Wallet Adapter. Abre KipuVault dentro
                  del navegador interno de tu wallet para conectar en 1 toque:
                </p>

                <div className="mt-4 space-y-2.5">
                  <a
                    href={deepLinks.phantom}
                    target="_blank"
                    rel="noreferrer"
                    className="flex w-full items-center justify-between rounded-xl bg-kipu-gold px-4 py-3 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400"
                  >
                    <span className="inline-flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" />
                      Abrir KipuVault en Phantom App
                    </span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>

                  <a
                    href={deepLinks.solflare}
                    target="_blank"
                    rel="noreferrer"
                    className="flex w-full items-center justify-between rounded-xl border border-kipu-border bg-kipu-bg px-4 py-2.5 text-xs font-medium text-kipu-text transition hover:border-zinc-600"
                  >
                    <span>Abrir en Solflare App</span>
                    <ExternalLink className="h-3.5 w-3.5 text-zinc-400" />
                  </a>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-kipu-border pt-3 text-[11px]">
                  <a
                    href="https://phantom.app/download"
                    target="_blank"
                    rel="noreferrer"
                    className="text-zinc-400 underline hover:text-kipu-gold"
                  >
                    ¿No tienes Phantom? Instalar
                  </a>
                  <button
                    type="button"
                    onClick={() => setMobileModalOpen(false)}
                    className="font-medium text-kipu-emerald hover:underline"
                  >
                    Seguir en Modo Sandbox
                  </button>
                </div>
              </div>
            </div>
          )}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
