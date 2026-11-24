import type { BN } from "@coral-xyz/anchor";
import type { PublicKey, Transaction } from "@solana/web3.js";

export interface VaultStateView {
  owner: PublicKey;
  agent: PublicKey;
  mint: PublicKey;
  maxPerTx: BN;
  dailyLimit: BN;
  spentToday: BN;
  windowStart: BN;
  isFrozen: boolean;
  totalExecutions: BN;
  allowedRecipients: PublicKey[];
  recipientCount: number;
  bump: number;
}

export interface KipuMethodBuilder {
  accountsStrict: (accounts: Record<string, PublicKey>) => {
    rpc: () => Promise<string>;
    transaction: () => Promise<Transaction>;
  };
}

export interface KipuVaultMethods {
  initializeVault: (
    agent: PublicKey,
    maxPerTx: BN,
    dailyLimit: BN
  ) => KipuMethodBuilder;
  deposit: (amount: BN) => KipuMethodBuilder;
  withdraw: (amount: BN) => KipuMethodBuilder;
  agentExecute: (amount: BN, decisionHash: number[]) => KipuMethodBuilder;
  updatePolicy: (
    newAgent: PublicKey | null,
    newMaxPerTx: BN | null,
    newDailyLimit: BN | null
  ) => KipuMethodBuilder;
  emergencyFreeze: (freeze: boolean) => KipuMethodBuilder;
  addRecipient: (recipient: PublicKey) => KipuMethodBuilder;
  removeRecipient: (recipient: PublicKey) => KipuMethodBuilder;
}

export interface KipuVaultAccountsNamespace {
  vaultState: {
    fetch: (addr: PublicKey) => Promise<VaultStateView>;
  };
}
