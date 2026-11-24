import fs from "fs";
import path from "path";
import * as anchor from "@coral-xyz/anchor";
import { BN, Program, Idl } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import type { DevnetOutput } from "./setup_devnet_usdc";
import type {
  KipuVaultAccountsNamespace,
  KipuVaultMethods,
} from "./kipu_types";

const ROOT_DIR = path.resolve(__dirname, "..");
const KEYPAIRS_DIR = path.join(ROOT_DIR, "keypairs");
const DEVNET_OUTPUT_PATH = path.join(__dirname, "devnet-output.json");
const VAULT_OUTPUT_PATH = path.join(__dirname, "vault-output.json");
const IDL_PATH = path.join(ROOT_DIR, "target", "idl", "kipu_vault.json");

const DEFAULT_MAX_PER_TX = new BN(10_000_000); // 10.000000 Mock USDC
const DEFAULT_DAILY_LIMIT = new BN(50_000_000); // 50.000000 Mock USDC
const INITIAL_DEPOSIT_TARGET = 100_000_000n; // 100.000000 Mock USDC

function loadKeypair(filename: string): Keypair {
  const filePath = path.join(KEYPAIRS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `No existe ${filePath}. Ejecuta primero: npm run setup:devnet`
    );
  }
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

async function main(): Promise<void> {
  if (!fs.existsSync(DEVNET_OUTPUT_PATH)) {
    throw new Error(
      `No existe ${DEVNET_OUTPUT_PATH}. Ejecuta primero: npm run setup:devnet`
    );
  }
  if (!fs.existsSync(IDL_PATH)) {
    throw new Error(
      `No existe ${IDL_PATH}. Compila primero el programa con: anchor build`
    );
  }

  const devnet = JSON.parse(
    fs.readFileSync(DEVNET_OUTPUT_PATH, "utf8")
  ) as DevnetOutput;
  const idl = JSON.parse(fs.readFileSync(IDL_PATH, "utf8")) as Idl;

  const owner = loadKeypair("owner-keypair.json");
  const agent = loadKeypair("agent-keypair.json");
  const mint = new PublicKey(devnet.mint);
  const ownerAta = new PublicKey(devnet.ownerAta);
  const demoRecipient = new PublicKey(devnet.demoRecipient);

  const connection = new Connection(
    process.env.SOLANA_RPC_URL ?? devnet.rpcUrl,
    "confirmed"
  );
  const wallet = new anchor.Wallet(owner);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const programId = new PublicKey(
    process.env.KIPU_PROGRAM_ID ?? (idl as { address?: string }).address ?? ""
  );
  const program = new Program(idl, provider);
  const methods = program.methods as unknown as KipuVaultMethods;
  const vaultAccounts = program.account as unknown as KipuVaultAccountsNamespace;

  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("kipu_vault"), owner.publicKey.toBuffer(), mint.toBuffer()],
    programId
  );
  const vaultAta = getAssociatedTokenAddressSync(
    mint,
    vaultPda,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const existingVault = await connection.getAccountInfo(vaultPda, "confirmed");
  if (!existingVault) {
    console.log(`[vault] Inicializando KipuVault PDA: ${vaultPda.toBase58()}...`);
    const sig = await methods
      .initializeVault(agent.publicKey, DEFAULT_MAX_PER_TX, DEFAULT_DAILY_LIMIT)
      .accountsStrict({
        owner: owner.publicKey,
        mint,
        vault: vaultPda,
        vaultTokenAccount: vaultAta,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .rpc();
    console.log(`[vault] Inicializada. tx: ${sig}`);
  } else {
    console.log(`[vault] Bóveda ya existe: ${vaultPda.toBase58()}`);
  }

  const vaultState = await vaultAccounts.vaultState.fetch(vaultPda);

  const activeRecipients = vaultState.allowedRecipients
    .slice(0, vaultState.recipientCount)
    .map((k) => k.toBase58());

  if (!activeRecipients.includes(demoRecipient.toBase58())) {
    console.log(
      `[allowlist] Agregando wallet_demo ${demoRecipient.toBase58()}...`
    );
    const sig = await methods
      .addRecipient(demoRecipient)
      .accountsStrict({
        owner: owner.publicKey,
        vault: vaultPda,
      })
      .rpc();
    console.log(`[allowlist] Agregado. tx: ${sig}`);
  } else {
    console.log(`[allowlist] wallet_demo ya está en la allowlist`);
  }

  const vaultTokenState = await getAccount(
    connection,
    vaultAta,
    "confirmed",
    TOKEN_PROGRAM_ID
  );

  if (vaultTokenState.amount < INITIAL_DEPOSIT_TARGET) {
    const missing = INITIAL_DEPOSIT_TARGET - vaultTokenState.amount;
    console.log(
      `[deposit] Depositando ${(Number(missing) / 1_000_000).toFixed(2)} Mock USDC en la bóveda...`
    );
    const sig = await methods
      .deposit(new BN(missing.toString()))
      .accountsStrict({
        owner: owner.publicKey,
        vault: vaultPda,
        mint,
        ownerTokenAccount: ownerAta,
        vaultTokenAccount: vaultAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    console.log(`[deposit] Depositado. tx: ${sig}`);
  } else {
    console.log(
      `[deposit] Balance actual de la bóveda: ${(Number(vaultTokenState.amount) / 1_000_000).toFixed(2)} Mock USDC`
    );
  }

  const vaultOutput = {
    programId: programId.toBase58(),
    vaultPda: vaultPda.toBase58(),
    vaultAta: vaultAta.toBase58(),
    owner: owner.publicKey.toBase58(),
    agent: agent.publicKey.toBase58(),
    mint: mint.toBase58(),
    demoRecipient: demoRecipient.toBase58(),
    maxPerTxBaseUnits: DEFAULT_MAX_PER_TX.toString(),
    dailyLimitBaseUnits: DEFAULT_DAILY_LIMIT.toString(),
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(VAULT_OUTPUT_PATH, JSON.stringify(vaultOutput, null, 2));
  console.log(`[done] Guardado ${VAULT_OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error("[bootstrap_vault] Error:", err);
  process.exit(1);
});
