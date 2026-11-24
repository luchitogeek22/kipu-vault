import {
  AnchorProvider,
  BN,
  Idl,
  Program,
} from "@anchor-lang/core";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import rawIdl from "../idl/kipu_vault.json";
import { FRONTEND_CONFIG } from "./config";

export const VAULT_SEED = Buffer.from("kipu_vault");

export interface DecodedVaultState {
  address: string;
  vaultAta: string;
  owner: string;
  agent: string;
  mint: string;
  maxPerTx: bigint;
  dailyLimit: bigint;
  spentToday: bigint;
  windowStart: number;
  isFrozen: boolean;
  totalExecutions: bigint;
  allowedRecipients: string[];
  recipientCount: number;
  bump: number;
  vaultTokenBalance: bigint;
}

interface RawAnchorVaultAccount {
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

interface KipuMethodBuilder {
  accountsStrict: (accounts: Record<string, PublicKey>) => {
    rpc: () => Promise<string>;
    transaction: () => Promise<Transaction>;
  };
}

interface KipuMethods {
  initializeVault: (
    agent: PublicKey,
    maxPerTx: BN,
    dailyLimit: BN
  ) => KipuMethodBuilder;
  deposit: (amount: BN) => KipuMethodBuilder;
  withdraw: (amount: BN) => KipuMethodBuilder;
  updatePolicy: (
    newAgent: PublicKey | null,
    newMaxPerTx: BN | null,
    newDailyLimit: BN | null
  ) => KipuMethodBuilder;
  emergencyFreeze: (freeze: boolean) => KipuMethodBuilder;
  addRecipient: (recipient: PublicKey) => KipuMethodBuilder;
  removeRecipient: (recipient: PublicKey) => KipuMethodBuilder;
}

export function getKipuIdlWithConfiguredProgramId(): Idl {
  const cloned = JSON.parse(JSON.stringify(rawIdl)) as Record<string, unknown>;
  cloned.address = FRONTEND_CONFIG.programId;
  return cloned as unknown as Idl;
}

export function getProgramId(): PublicKey {
  return new PublicKey(FRONTEND_CONFIG.programId);
}

export function deriveVaultPda(owner: PublicKey, mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [VAULT_SEED, owner.toBuffer(), mint.toBuffer()],
    getProgramId()
  );
  return pda;
}

export function getVaultProgram(
  connection: Connection,
  wallet: AnchorWallet
): { program: Program; methods: KipuMethods } {
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  const program = new Program(getKipuIdlWithConfiguredProgramId(), provider);
  return {
    program,
    methods: program.methods as unknown as KipuMethods,
  };
}

export async function fetchVaultStateOnChain(
  connection: Connection,
  vaultAddress: PublicKey
): Promise<DecodedVaultState | null> {
  const info = await connection.getAccountInfo(vaultAddress, "confirmed");
  if (!info || !info.owner.equals(getProgramId())) {
    return null;
  }

  const dummyWallet: AnchorWallet = {
    publicKey: vaultAddress,
    signTransaction: async <T extends Transaction | import("@solana/web3.js").VersionedTransaction>(tx: T) => tx,
    signAllTransactions: async <T extends Transaction | import("@solana/web3.js").VersionedTransaction>(txs: T[]) => txs,
  };
  const { program } = getVaultProgram(connection, dummyWallet);
  const decoded = program.coder.accounts.decode<RawAnchorVaultAccount>(
    "VaultState",
    info.data
  );

  const vaultAta = getAssociatedTokenAddressSync(
    decoded.mint,
    vaultAddress,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  let vaultTokenBalance = 0n;
  try {
    const tokenAcc = await getAccount(
      connection,
      vaultAta,
      "confirmed",
      TOKEN_PROGRAM_ID
    );
    vaultTokenBalance = tokenAcc.amount;
  } catch {
    vaultTokenBalance = 0n;
  }

  const count = Number(decoded.recipientCount);
  const recipients = decoded.allowedRecipients
    .slice(0, count)
    .map((k) => k.toBase58());

  return {
    address: vaultAddress.toBase58(),
    vaultAta: vaultAta.toBase58(),
    owner: decoded.owner.toBase58(),
    agent: decoded.agent.toBase58(),
    mint: decoded.mint.toBase58(),
    maxPerTx: BigInt(decoded.maxPerTx.toString()),
    dailyLimit: BigInt(decoded.dailyLimit.toString()),
    spentToday: BigInt(decoded.spentToday.toString()),
    windowStart: decoded.windowStart.toNumber(),
    isFrozen: Boolean(decoded.isFrozen),
    totalExecutions: BigInt(decoded.totalExecutions.toString()),
    allowedRecipients: recipients,
    recipientCount: count,
    bump: Number(decoded.bump),
    vaultTokenBalance,
  };
}

export async function initializeVaultTx(
  connection: Connection,
  wallet: AnchorWallet,
  params: {
    mint: PublicKey;
    agent: PublicKey;
    maxPerTxBaseUnits: bigint;
    dailyLimitBaseUnits: bigint;
  }
): Promise<string> {
  const { methods } = getVaultProgram(connection, wallet);
  const vault = deriveVaultPda(wallet.publicKey, params.mint);
  const vaultAta = getAssociatedTokenAddressSync(
    params.mint,
    vault,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return methods
    .initializeVault(
      params.agent,
      new BN(params.maxPerTxBaseUnits.toString()),
      new BN(params.dailyLimitBaseUnits.toString())
    )
    .accountsStrict({
      owner: wallet.publicKey,
      mint: params.mint,
      vault,
      vaultTokenAccount: vaultAta,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .rpc();
}

export async function depositToVaultTx(
  connection: Connection,
  wallet: AnchorWallet,
  params: { vault: PublicKey; mint: PublicKey; amountBaseUnits: bigint }
): Promise<string> {
  const { methods } = getVaultProgram(connection, wallet);
  const ownerAta = getAssociatedTokenAddressSync(
    params.mint,
    wallet.publicKey,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const vaultAta = getAssociatedTokenAddressSync(
    params.mint,
    params.vault,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return methods
    .deposit(new BN(params.amountBaseUnits.toString()))
    .accountsStrict({
      owner: wallet.publicKey,
      vault: params.vault,
      mint: params.mint,
      ownerTokenAccount: ownerAta,
      vaultTokenAccount: vaultAta,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
}

export async function withdrawFromVaultTx(
  connection: Connection,
  wallet: AnchorWallet,
  params: { vault: PublicKey; mint: PublicKey; amountBaseUnits: bigint }
): Promise<string> {
  const { methods } = getVaultProgram(connection, wallet);
  const ownerAta = getAssociatedTokenAddressSync(
    params.mint,
    wallet.publicKey,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const vaultAta = getAssociatedTokenAddressSync(
    params.mint,
    params.vault,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return methods
    .withdraw(new BN(params.amountBaseUnits.toString()))
    .accountsStrict({
      owner: wallet.publicKey,
      vault: params.vault,
      mint: params.mint,
      vaultTokenAccount: vaultAta,
      ownerTokenAccount: ownerAta,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
}

export async function updatePolicyTx(
  connection: Connection,
  wallet: AnchorWallet,
  params: {
    vault: PublicKey;
    newAgent: PublicKey | null;
    newMaxPerTx: bigint | null;
    newDailyLimit: bigint | null;
  }
): Promise<string> {
  const { methods } = getVaultProgram(connection, wallet);
  return methods
    .updatePolicy(
      params.newAgent,
      params.newMaxPerTx !== null ? new BN(params.newMaxPerTx.toString()) : null,
      params.newDailyLimit !== null ? new BN(params.newDailyLimit.toString()) : null
    )
    .accountsStrict({
      owner: wallet.publicKey,
      vault: params.vault,
    })
    .rpc();
}

export async function emergencyFreezeTx(
  connection: Connection,
  wallet: AnchorWallet,
  params: { vault: PublicKey; freeze: boolean }
): Promise<string> {
  const { methods } = getVaultProgram(connection, wallet);
  return methods
    .emergencyFreeze(params.freeze)
    .accountsStrict({
      owner: wallet.publicKey,
      vault: params.vault,
    })
    .rpc();
}

export async function addRecipientTx(
  connection: Connection,
  wallet: AnchorWallet,
  params: { vault: PublicKey; recipient: PublicKey }
): Promise<string> {
  const { methods } = getVaultProgram(connection, wallet);
  return methods
    .addRecipient(params.recipient)
    .accountsStrict({
      owner: wallet.publicKey,
      vault: params.vault,
    })
    .rpc();
}

export async function removeRecipientTx(
  connection: Connection,
  wallet: AnchorWallet,
  params: { vault: PublicKey; recipient: PublicKey }
): Promise<string> {
  const { methods } = getVaultProgram(connection, wallet);
  return methods
    .removeRecipient(params.recipient)
    .accountsStrict({
      owner: wallet.publicKey,
      vault: params.vault,
    })
    .rpc();
}
