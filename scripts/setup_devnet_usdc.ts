import fs from "fs";
import path from "path";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  mintToChecked,
} from "@solana/spl-token";

const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const DECIMALS = 6;
const INITIAL_OWNER_USDC = 1_000_000_000n; // 1,000.000000 Mock USDC
const MIN_SOL_LAMPORTS = Math.floor(0.8 * LAMPORTS_PER_SOL);
const AIRDROP_LAMPORTS = 1 * LAMPORTS_PER_SOL;

const ROOT_DIR = path.resolve(__dirname, "..");
const KEYPAIRS_DIR = path.join(ROOT_DIR, "keypairs");
const OUTPUT_PATH = path.join(__dirname, "devnet-output.json");

export interface DevnetOutput {
  rpcUrl: string;
  mint: string;
  decimals: number;
  owner: string;
  ownerAta: string;
  agent: string;
  demoRecipient: string;
  demoRecipientAta: string;
  updatedAt: string;
}

function loadOrCreateKeypair(filename: string): Keypair {
  fs.mkdirSync(KEYPAIRS_DIR, { recursive: true });
  const filePath = path.join(KEYPAIRS_DIR, filename);

  if (fs.existsSync(filePath)) {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(raw));
  }

  const kp = Keypair.generate();
  fs.writeFileSync(filePath, JSON.stringify(Array.from(kp.secretKey)), {
    mode: 0o600,
  });
  return kp;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureSolBalance(
  connection: Connection,
  pubkey: PublicKey,
  label: string
): Promise<void> {
  const current = await connection.getBalance(pubkey, "confirmed");
  if (current >= MIN_SOL_LAMPORTS) {
    console.log(
      `[airdrop] ${label} (${pubkey.toBase58()}) ya tiene ${(current / LAMPORTS_PER_SOL).toFixed(3)} SOL`
    );
    return;
  }

  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(
        `[airdrop] Solicitando 1 SOL para ${label} (${pubkey.toBase58()}) [intento ${attempt}/${maxAttempts}]...`
      );
      const sig = await connection.requestAirdrop(pubkey, AIRDROP_LAMPORTS);
      const latest = await connection.getLatestBlockhash("confirmed");
      await connection.confirmTransaction(
        {
          signature: sig,
          blockhash: latest.blockhash,
          lastValidBlockHeight: latest.lastValidBlockHeight,
        },
        "confirmed"
      );
      const updated = await connection.getBalance(pubkey, "confirmed");
      console.log(
        `[airdrop] ${label} fondeado: ${(updated / LAMPORTS_PER_SOL).toFixed(3)} SOL`
      );
      return;
    } catch (err) {
      const delayMs = 2000 * Math.pow(2, attempt - 1);
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[airdrop] Faucet limitó o falló para ${label} (${msg}). Esperando ${delayMs} ms...`
      );
      if (attempt === maxAttempts) {
        throw new Error(
          `No se pudo fondear SOL para ${label} (${pubkey.toBase58()}) tras ${maxAttempts} intentos: ${msg}`
        );
      }
      await sleep(delayMs);
    }
  }
}

async function resolveExistingMint(
  connection: Connection
): Promise<PublicKey | null> {
  if (!fs.existsSync(OUTPUT_PATH)) {
    return null;
  }
  try {
    const parsed = JSON.parse(
      fs.readFileSync(OUTPUT_PATH, "utf8")
    ) as Partial<DevnetOutput>;
    if (!parsed.mint) {
      return null;
    }
    const candidate = new PublicKey(parsed.mint);
    const info = await connection.getAccountInfo(candidate, "confirmed");
    if (info && info.owner.equals(TOKEN_PROGRAM_ID)) {
      console.log(`[mint] Reutilizando Mock USDC existente: ${candidate.toBase58()}`);
      return candidate;
    }
    return null;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const connection = new Connection(RPC_URL, "confirmed");

  const owner = loadOrCreateKeypair("owner-keypair.json");
  const agent = loadOrCreateKeypair("agent-keypair.json");
  const demoRecipient = loadOrCreateKeypair("demo-recipient-keypair.json");

  await ensureSolBalance(connection, owner.publicKey, "owner");
  await ensureSolBalance(connection, agent.publicKey, "agent");

  let mint = await resolveExistingMint(connection);
  if (!mint) {
    console.log("[mint] Creando nuevo Mock USDC SPL (6 decimales)...");
    mint = await createMint(
      connection,
      owner,
      owner.publicKey,
      null,
      DECIMALS,
      undefined,
      { commitment: "confirmed" },
      TOKEN_PROGRAM_ID
    );
    console.log(`[mint] Mock USDC creado: ${mint.toBase58()}`);
  }

  const ownerAtaAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    owner,
    mint,
    owner.publicKey,
    false,
    "confirmed",
    { commitment: "confirmed" },
    TOKEN_PROGRAM_ID
  );

  const demoRecipientAtaAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    owner,
    mint,
    demoRecipient.publicKey,
    false,
    "confirmed",
    { commitment: "confirmed" },
    TOKEN_PROGRAM_ID
  );

  const currentOwnerTokenState = await getAccount(
    connection,
    ownerAtaAccount.address,
    "confirmed",
    TOKEN_PROGRAM_ID
  );

  if (currentOwnerTokenState.amount === 0n) {
    console.log("[mint] Acuñando 1,000 Mock USDC al owner...");
    await mintToChecked(
      connection,
      owner,
      mint,
      ownerAtaAccount.address,
      owner,
      INITIAL_OWNER_USDC,
      DECIMALS,
      [],
      { commitment: "confirmed" },
      TOKEN_PROGRAM_ID
    );
  } else {
    console.log(
      `[mint] Owner ATA ya tiene ${(Number(currentOwnerTokenState.amount) / 1_000_000).toFixed(2)} Mock USDC`
    );
  }

  const output: DevnetOutput = {
    rpcUrl: RPC_URL,
    mint: mint.toBase58(),
    decimals: DECIMALS,
    owner: owner.publicKey.toBase58(),
    ownerAta: ownerAtaAccount.address.toBase58(),
    agent: agent.publicKey.toBase58(),
    demoRecipient: demoRecipient.publicKey.toBase58(),
    demoRecipientAta: demoRecipientAtaAccount.address.toBase58(),
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`[done] Guardado ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error("[setup_devnet_usdc] Error:", err);
  process.exit(1);
});
