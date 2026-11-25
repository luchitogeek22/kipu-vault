"use client";

import React, { useCallback, useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import "@solana/wallet-adapter-react-ui/styles.css";
import { FRONTEND_CONFIG } from "@/lib/config";

export function SolanaProviders({ children }: { children: React.ReactNode }) {
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  // Silenciar console.error para rechazos del usuario (lo maneja KipuDashboard inline)
  // y evitar que Next.js dev overlay bloquee la pantalla en presentaciones.
  const handleWalletError = useCallback((error: Error) => {
    const msg = error?.message ?? "";
    if (
      msg.toLowerCase().includes("rejected") ||
      msg.toLowerCase().includes("cancel")
    ) {
      console.warn("[KipuVault Wallet]", error.name, msg);
      return;
    }
    console.warn("[KipuVault Wallet Error]", error.name, msg);
  }, []);

  return (
    <ConnectionProvider endpoint={FRONTEND_CONFIG.solanaRpcUrl}>
      <WalletProvider
        wallets={wallets}
        onError={handleWalletError}
        autoConnect
      >
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
