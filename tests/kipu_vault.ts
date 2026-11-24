import fs from "fs";
import path from "path";
import crypto from "crypto";
import * as anchor from "@coral-xyz/anchor";
import { BN, EventParser, Idl, Program } from "@coral-xyz/anchor";
import { BankrunProvider, startAnchor } from "anchor-bankrun";
import { Clock, ProgramTestContext } from "solana-bankrun";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  AccountLayout,
  createAssociatedTokenAccountInstruction,
  createInitializeMint2Instruction,
  createMintToCheckedInstruction,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
} from "@solana/spl-token";
import { expect } from "chai";
import type {
  KipuVaultAccountsNamespace,
  KipuVaultMethods,
  VaultStateView,
} from "../scripts/kipu_types";

const ROOT_DIR = path.resolve(__dirname, "..");
const IDL_PATH = path.join(ROOT_DIR, "target", "idl", "kipu_vault.json");
const VAULT_SEED = Buffer.from("kipu_vault");
const DECIMALS = 6;
const USDC = 1_000_000;
const U64_MAX_STR = "18446744073709551615";

const KIPU_ERRORS = {
  UnauthorizedOwner: 6000,
  UnauthorizedAgent: 6001,
  VaultFrozen: 6002,
  ExceedsTransactionLimit: 6003,
  ExceedsDailyLimit: 6004,
  InvalidPolicyConfig: 6005,
  InvalidAmount: 6006,
  MathOverflow: 6007,
  RecipientNotAllowed: 6008,
  RecipientListFull: 6009,
  RecipientAlreadyExists: 6010,
  RecipientNotFound: 6011,
  InvalidDecisionHash: 6012,
  InvalidMint: 6013,
} as const;

type KipuErrorName = keyof typeof KIPU_ERRORS;

function makeHash(label: string): number[] {
  return Array.from(crypto.createHash("sha256").update(label).digest());
}

function deriveVaultPda(
  programId: PublicKey,
  owner: PublicKey,
  mint: PublicKey
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [VAULT_SEED, owner.toBuffer(), mint.toBuffer()],
    programId
  );
  return pda;
}

async function resolveBlockhash(context: ProgramTestContext): Promise<string> {
  const latest = await context.banksClient.getLatestBlockhash();
  return latest ? latest[0] : context.lastBlockhash;
}

async function sendBankrunTx(
  context: ProgramTestContext,
  tx: Transaction,
  signers: Keypair[]
): Promise<string[]> {
  tx.recentBlockhash = await resolveBlockhash(context);
  tx.feePayer = context.payer.publicKey;
  tx.sign(context.payer, ...signers);
  const meta = await context.banksClient.processTransaction(tx);
  return meta.logMessages;
}

async function tryBankrunTx(
  context: ProgramTestContext,
  tx: Transaction,
  signers: Keypair[]
): Promise<{ result: string | null; logs: string[] }> {
  tx.recentBlockhash = await resolveBlockhash(context);
  tx.feePayer = context.payer.publicKey;
  tx.sign(context.payer, ...signers);
  const res = await context.banksClient.tryProcessTransaction(tx);
  return {
    result: res.result,
    logs: res.meta?.logMessages ?? [],
  };
}

async function fundSystemAccount(
  context: ProgramTestContext,
  pubkey: PublicKey,
  lamports = 2_000_000_000
): Promise<void> {
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: context.payer.publicKey,
      toPubkey: pubkey,
      lamports,
    })
  );
  await sendBankrunTx(context, tx, []);
}

async function createSplMint(
  context: ProgramTestContext,
  mintAuthority: PublicKey
): Promise<PublicKey> {
  const mintKp = Keypair.generate();
  const rent = await getMinimumBalanceForRentExemptMint(
    new BankrunProvider(context).connection
  );
  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: context.payer.publicKey,
      newAccountPubkey: mintKp.publicKey,
      space: MINT_SIZE,
      lamports: rent,
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMint2Instruction(
      mintKp.publicKey,
      DECIMALS,
      mintAuthority,
      null,
      TOKEN_PROGRAM_ID
    )
  );
  await sendBankrunTx(context, tx, [mintKp]);
  return mintKp.publicKey;
}

async function createAtaAndMint(
  context: ProgramTestContext,
  mint: PublicKey,
  owner: PublicKey,
  mintAuthority: Keypair | null,
  amount: bigint
): Promise<PublicKey> {
  const ata = getAssociatedTokenAddressSync(
    mint,
    owner,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const tx = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      context.payer.publicKey,
      ata,
      owner,
      mint,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  );
  if (amount > 0n) {
    if (!mintAuthority) {
      throw new Error("mintAuthority required when amount > 0");
    }
    tx.add(
      createMintToCheckedInstruction(
        mint,
        ata,
        mintAuthority.publicKey,
        amount,
        DECIMALS,
        [],
        TOKEN_PROGRAM_ID
      )
    );
  }
  const signers = amount > 0n && mintAuthority ? [mintAuthority] : [];
  await sendBankrunTx(context, tx, signers);
  return ata;
}

async function getTokenBalance(
  context: ProgramTestContext,
  tokenAccount: PublicKey
): Promise<bigint> {
  const info = await context.banksClient.getAccount(tokenAccount);
  if (!info) {
    throw new Error(`Token account not found: ${tokenAccount.toBase58()}`);
  }
  const decoded = AccountLayout.decode(info.data);
  return decoded.amount;
}

function expectKipuErrorResult(
  outcome: { result: string | null; logs: string[] },
  errorName: KipuErrorName
): void {
  const code = KIPU_ERRORS[errorName];
  const hexCode = `0x${code.toString(16)}`;
  const joinedLogs = outcome.logs.join("\n");
  expect(outcome.result, `Expected ${errorName} (${code}), but tx succeeded`).to.not.be.null;
  const hasName = joinedLogs.includes(errorName);
  const hasDecimal = joinedLogs.includes(String(code));
  const hasHex = (outcome.result ?? "").toLowerCase().includes(hexCode) ||
    joinedLogs.toLowerCase().includes(hexCode);
  expect(
    hasName || hasDecimal || hasHex,
    `Expected KipuError::${errorName} (${code} / ${hexCode}), got result="${outcome.result}" logs:\n${joinedLogs}`
  ).to.be.true;
}

describe("kipu_vault (anchor-bankrun)", () => {
  let idl: Idl;

  before(() => {
    if (!fs.existsSync(IDL_PATH)) {
      throw new Error(
        `Missing IDL at ${IDL_PATH}. Run "anchor build" before running tests.`
      );
    }
    idl = JSON.parse(fs.readFileSync(IDL_PATH, "utf8")) as Idl;
  });

  async function setupFixture(opts?: {
    maxPerTx?: BN;
    dailyLimit?: BN;
    initialOwnerMintAmount?: bigint;
    initialDeposit?: BN;
  }) {
    const context = await startAnchor(ROOT_DIR, [], []);
    const provider = new BankrunProvider(context);
    anchor.setProvider(provider);
    const program = new Program(idl, provider);
    const methods = program.methods as unknown as KipuVaultMethods;

    const owner = Keypair.generate();
    const agent = Keypair.generate();
    const recipient = Keypair.generate();
    const attacker = Keypair.generate();

    await fundSystemAccount(context, owner.publicKey);
    await fundSystemAccount(context, agent.publicKey);
    await fundSystemAccount(context, attacker.publicKey);

    const mint = await createSplMint(context, owner.publicKey);
    const ownerAta = await createAtaAndMint(
      context,
      mint,
      owner.publicKey,
      owner,
      opts?.initialOwnerMintAmount ?? BigInt(1_000 * USDC)
    );
    const recipientAta = await createAtaAndMint(
      context,
      mint,
      recipient.publicKey,
      null,
      0n
    );
    const attackerAta = await createAtaAndMint(
      context,
      mint,
      attacker.publicKey,
      null,
      0n
    );

    const vault = deriveVaultPda(program.programId, owner.publicKey, mint);
    const vaultAta = getAssociatedTokenAddressSync(
      mint,
      vault,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const maxPerTx = opts?.maxPerTx ?? new BN(10 * USDC);
    const dailyLimit = opts?.dailyLimit ?? new BN(25 * USDC);

    const initTx = await methods
      .initializeVault(agent.publicKey, maxPerTx, dailyLimit)
      .accountsStrict({
        owner: owner.publicKey,
        mint,
        vault,
        vaultTokenAccount: vaultAta,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .transaction();
    await sendBankrunTx(context, initTx, [owner]);

    if (opts?.initialDeposit && opts.initialDeposit.gt(new BN(0))) {
      const depTx = await methods
        .deposit(opts.initialDeposit)
        .accountsStrict({
          owner: owner.publicKey,
          vault,
          mint,
          ownerTokenAccount: ownerAta,
          vaultTokenAccount: vaultAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .transaction();
      await sendBankrunTx(context, depTx, [owner]);
    }

    const fetchVault = async (): Promise<VaultStateView> => {
      const vaultAccounts = program.account as unknown as KipuVaultAccountsNamespace;
      return vaultAccounts.vaultState.fetch(vault);
    };

    return {
      context,
      provider,
      program,
      methods,
      owner,
      agent,
      recipient,
      attacker,
      mint,
      ownerAta,
      recipientAta,
      attackerAta,
      vault,
      vaultAta,
      fetchVault,
    };
  }

  it("1. Inicialización correcta (estado y ATA)", async () => {
    const f = await setupFixture({
      maxPerTx: new BN(10 * USDC),
      dailyLimit: new BN(50 * USDC),
    });

    const state = await f.fetchVault();
    expect(state.owner.equals(f.owner.publicKey)).to.be.true;
    expect(state.agent.equals(f.agent.publicKey)).to.be.true;
    expect(state.mint.equals(f.mint)).to.be.true;
    expect(state.maxPerTx.toNumber()).to.equal(10 * USDC);
    expect(state.dailyLimit.toNumber()).to.equal(50 * USDC);
    expect(state.spentToday.toNumber()).to.equal(0);
    expect(state.windowStart.toNumber()).to.be.greaterThan(0);
    expect(state.isFrozen).to.be.false;
    expect(state.totalExecutions.toNumber()).to.equal(0);
    expect(state.recipientCount).to.equal(0);

    const vaultAtaBalance = await getTokenBalance(f.context, f.vaultAta);
    expect(vaultAtaBalance).to.equal(0n);
  });

  it("2. Inicialización inválida: max_per_tx = 0, daily_limit < max_per_tx, agent == owner", async () => {
    const context = await startAnchor(ROOT_DIR, [], []);
    const provider = new BankrunProvider(context);
    anchor.setProvider(provider);
    const program = new Program(idl, provider);
    const methods = program.methods as unknown as KipuVaultMethods;

    const owner = Keypair.generate();
    const agent = Keypair.generate();
    await fundSystemAccount(context, owner.publicKey);
    const mint = await createSplMint(context, owner.publicKey);
    const vault = deriveVaultPda(program.programId, owner.publicKey, mint);
    const vaultAta = getAssociatedTokenAddressSync(
      mint,
      vault,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const cases: Array<[PublicKey, BN, BN]> = [
      [agent.publicKey, new BN(0), new BN(10 * USDC)],
      [agent.publicKey, new BN(20 * USDC), new BN(10 * USDC)],
      [owner.publicKey, new BN(10 * USDC), new BN(20 * USDC)],
    ];

    for (const [ag, maxTx, daily] of cases) {
      const tx = await methods
        .initializeVault(ag, maxTx, daily)
        .accountsStrict({
          owner: owner.publicKey,
          mint,
          vault,
          vaultTokenAccount: vaultAta,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .transaction();
      const res = await tryBankrunTx(context, tx, [owner]);
      expectKipuErrorResult(res, "InvalidPolicyConfig");
    }
  });

  it("3. Depósito correcto y amount = 0 -> InvalidAmount", async () => {
    const f = await setupFixture();
    const depAmount = new BN(100 * USDC);

    const txOk = await f.methods
      .deposit(depAmount)
      .accountsStrict({
        owner: f.owner.publicKey,
        vault: f.vault,
        mint: f.mint,
        ownerTokenAccount: f.ownerAta,
        vaultTokenAccount: f.vaultAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();
    await sendBankrunTx(f.context, txOk, [f.owner]);
    expect(await getTokenBalance(f.context, f.vaultAta)).to.equal(BigInt(100 * USDC));

    const txZero = await f.methods
      .deposit(new BN(0))
      .accountsStrict({
        owner: f.owner.publicKey,
        vault: f.vault,
        mint: f.mint,
        ownerTokenAccount: f.ownerAta,
        vaultTokenAccount: f.vaultAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();
    const resZero = await tryBankrunTx(f.context, txZero, [f.owner]);
    expectKipuErrorResult(resZero, "InvalidAmount");
  });

  it("4. add_recipient correcto; duplicado, lista llena (el noveno) y Pubkey::default() fallan", async () => {
    const f = await setupFixture();

    // Pubkey::default() rejected
    const txDefault = await f.methods
      .addRecipient(PublicKey.default)
      .accountsStrict({ owner: f.owner.publicKey, vault: f.vault })
      .transaction();
    expectKipuErrorResult(
      await tryBankrunTx(f.context, txDefault, [f.owner]),
      "InvalidPolicyConfig"
    );

    // Add 8 distinct recipients
    const firstRecipient = f.recipient.publicKey;
    const recipients: PublicKey[] = [
      firstRecipient,
      ...Array.from({ length: 7 }, () => Keypair.generate().publicKey),
    ];

    for (const r of recipients) {
      const tx = await f.methods
        .addRecipient(r)
        .accountsStrict({ owner: f.owner.publicKey, vault: f.vault })
        .transaction();
      await sendBankrunTx(f.context, tx, [f.owner]);
    }

    const state = await f.fetchVault();
    expect(state.recipientCount).to.equal(8);

    // Duplicate rejected
    const txDup = await f.methods
      .addRecipient(firstRecipient)
      .accountsStrict({ owner: f.owner.publicKey, vault: f.vault })
      .transaction();
    expectKipuErrorResult(
      await tryBankrunTx(f.context, txDup, [f.owner]),
      "RecipientAlreadyExists"
    );

    // 9th rejected (RecipientListFull)
    const txNinth = await f.methods
      .addRecipient(Keypair.generate().publicKey)
      .accountsStrict({ owner: f.owner.publicKey, vault: f.vault })
      .transaction();
    expectKipuErrorResult(
      await tryBankrunTx(f.context, txNinth, [f.owner]),
      "RecipientListFull"
    );
  });

  it("5. agent_execute exitoso: saldo destino, spent_today, total_executions y KipuAuditEvent con decision_hash", async () => {
    const f = await setupFixture({ initialDeposit: new BN(100 * USDC) });

    const addTx = await f.methods
      .addRecipient(f.recipient.publicKey)
      .accountsStrict({ owner: f.owner.publicKey, vault: f.vault })
      .transaction();
    await sendBankrunTx(f.context, addTx, [f.owner]);

    const amount = new BN(5 * USDC);
    const decisionHash = makeHash("pay-5-usdc-code-review");

    const execTx = await f.methods
      .agentExecute(amount, decisionHash)
      .accountsStrict({
        agent: f.agent.publicKey,
        vault: f.vault,
        mint: f.mint,
        vaultTokenAccount: f.vaultAta,
        destinationToken: f.recipientAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();
    const logs = await sendBankrunTx(f.context, execTx, [f.agent]);

    expect(await getTokenBalance(f.context, f.recipientAta)).to.equal(BigInt(5 * USDC));
    expect(await getTokenBalance(f.context, f.vaultAta)).to.equal(BigInt(95 * USDC));

    const state = await f.fetchVault();
    expect(state.spentToday.toNumber()).to.equal(5 * USDC);
    expect(state.totalExecutions.toNumber()).to.equal(1);

    const parser = new EventParser(f.program.programId, f.program.coder);
    const events = Array.from(parser.parseLogs(logs));
    const auditEvent = events.find(
      (ev) => ev.name.toLowerCase() === "kipuauditevent"
    );
    expect(auditEvent, "KipuAuditEvent must be emitted").to.exist;
    const data = auditEvent!.data as {
      vault: PublicKey;
      agent: PublicKey;
      destination: PublicKey;
      amount: BN;
      decisionHash: number[];
    };
    expect(data.vault.equals(f.vault)).to.be.true;
    expect(data.agent.equals(f.agent.publicKey)).to.be.true;
    expect(data.destination.equals(f.recipientAta)).to.be.true;
    expect(data.amount.toNumber()).to.equal(5 * USDC);
    expect(Array.from(data.decisionHash)).to.deep.equal(decisionHash);
  });

  it("6. ExceedsTransactionLimit", async () => {
    const f = await setupFixture({
      maxPerTx: new BN(10 * USDC),
      dailyLimit: new BN(100 * USDC),
      initialDeposit: new BN(100 * USDC),
    });

    await sendBankrunTx(
      f.context,
      await f.methods
        .addRecipient(f.recipient.publicKey)
        .accountsStrict({ owner: f.owner.publicKey, vault: f.vault })
        .transaction(),
      [f.owner]
    );

    const tx = await f.methods
      .agentExecute(new BN(11 * USDC), makeHash("over-max-tx"))
      .accountsStrict({
        agent: f.agent.publicKey,
        vault: f.vault,
        mint: f.mint,
        vaultTokenAccount: f.vaultAta,
        destinationToken: f.recipientAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();

    expectKipuErrorResult(
      await tryBankrunTx(f.context, tx, [f.agent]),
      "ExceedsTransactionLimit"
    );
  });

  it("7. ExceedsDailyLimit por acumulación de varias ejecuciones válidas", async () => {
    const f = await setupFixture({
      maxPerTx: new BN(10 * USDC),
      dailyLimit: new BN(25 * USDC),
      initialDeposit: new BN(100 * USDC),
    });

    await sendBankrunTx(
      f.context,
      await f.methods
        .addRecipient(f.recipient.publicKey)
        .accountsStrict({ owner: f.owner.publicKey, vault: f.vault })
        .transaction(),
      [f.owner]
    );

    for (const i of [1, 2]) {
      const tx = await f.methods
        .agentExecute(new BN(10 * USDC), makeHash(`batch-${i}`))
        .accountsStrict({
          agent: f.agent.publicKey,
          vault: f.vault,
          mint: f.mint,
          vaultTokenAccount: f.vaultAta,
          destinationToken: f.recipientAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .transaction();
      await sendBankrunTx(f.context, tx, [f.agent]);
    }

    // 20 USDC spent, daily_limit = 25 USDC; 6 USDC pushes to 26 -> ExceedsDailyLimit
    const txOver = await f.methods
      .agentExecute(new BN(6 * USDC), makeHash("batch-3-over"))
      .accountsStrict({
        agent: f.agent.publicKey,
        vault: f.vault,
        mint: f.mint,
        vaultTokenAccount: f.vaultAta,
        destinationToken: f.recipientAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();

    expectKipuErrorResult(
      await tryBankrunTx(f.context, txOver, [f.agent]),
      "ExceedsDailyLimit"
    );
  });

  it("8. Reinicio de ventana: tras avanzar el reloj 86400 s, spent_today vuelve a 0 y la ejecución pasa", async () => {
    const f = await setupFixture({
      maxPerTx: new BN(10 * USDC),
      dailyLimit: new BN(15 * USDC),
      initialDeposit: new BN(100 * USDC),
    });

    await sendBankrunTx(
      f.context,
      await f.methods
        .addRecipient(f.recipient.publicKey)
        .accountsStrict({ owner: f.owner.publicKey, vault: f.vault })
        .transaction(),
      [f.owner]
    );

    await sendBankrunTx(
      f.context,
      await f.methods
        .agentExecute(new BN(10 * USDC), makeHash("day-1"))
        .accountsStrict({
          agent: f.agent.publicKey,
          vault: f.vault,
          mint: f.mint,
          vaultTokenAccount: f.vaultAta,
          destinationToken: f.recipientAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .transaction(),
      [f.agent]
    );

    // Same window: +10 exceeds 15
    const blockedTx = await f.methods
      .agentExecute(new BN(10 * USDC), makeHash("day-1-blocked"))
      .accountsStrict({
        agent: f.agent.publicKey,
        vault: f.vault,
        mint: f.mint,
        vaultTokenAccount: f.vaultAta,
        destinationToken: f.recipientAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();
    expectKipuErrorResult(
      await tryBankrunTx(f.context, blockedTx, [f.agent]),
      "ExceedsDailyLimit"
    );

    // Advance Clock by 86,400 seconds
    const currentClock = await f.context.banksClient.getClock();
    f.context.setClock(
      new Clock(
        currentClock.slot + 10n,
        currentClock.epochStartTimestamp,
        currentClock.epoch,
        currentClock.leaderScheduleEpoch,
        currentClock.unixTimestamp + 86_400n
      )
    );

    await sendBankrunTx(
      f.context,
      await f.methods
        .agentExecute(new BN(10 * USDC), makeHash("day-2-ok"))
        .accountsStrict({
          agent: f.agent.publicKey,
          vault: f.vault,
          mint: f.mint,
          vaultTokenAccount: f.vaultAta,
          destinationToken: f.recipientAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .transaction(),
      [f.agent]
    );

    const state = await f.fetchVault();
    expect(state.spentToday.toNumber()).to.equal(10 * USDC);
    expect(state.totalExecutions.toNumber()).to.equal(2);
  });

  it("9. VaultFrozen con la bóveda congelada", async () => {
    const f = await setupFixture({ initialDeposit: new BN(50 * USDC) });

    await sendBankrunTx(
      f.context,
      await f.methods
        .addRecipient(f.recipient.publicKey)
        .accountsStrict({ owner: f.owner.publicKey, vault: f.vault })
        .transaction(),
      [f.owner]
    );

    await sendBankrunTx(
      f.context,
      await f.methods
        .emergencyFreeze(true)
        .accountsStrict({ owner: f.owner.publicKey, vault: f.vault })
        .transaction(),
      [f.owner]
    );

    const tx = await f.methods
      .agentExecute(new BN(5 * USDC), makeHash("while-frozen"))
      .accountsStrict({
        agent: f.agent.publicKey,
        vault: f.vault,
        mint: f.mint,
        vaultTokenAccount: f.vaultAta,
        destinationToken: f.recipientAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();

    expectKipuErrorResult(
      await tryBankrunTx(f.context, tx, [f.agent]),
      "VaultFrozen"
    );
  });

  it("10. withdraw del owner exitoso con la bóveda congelada", async () => {
    const f = await setupFixture({ initialDeposit: new BN(50 * USDC) });

    await sendBankrunTx(
      f.context,
      await f.methods
        .emergencyFreeze(true)
        .accountsStrict({ owner: f.owner.publicKey, vault: f.vault })
        .transaction(),
      [f.owner]
    );

    const beforeOwner = await getTokenBalance(f.context, f.ownerAta);
    await sendBankrunTx(
      f.context,
      await f.methods
        .withdraw(new BN(30 * USDC))
        .accountsStrict({
          owner: f.owner.publicKey,
          vault: f.vault,
          mint: f.mint,
          vaultTokenAccount: f.vaultAta,
          ownerTokenAccount: f.ownerAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .transaction(),
      [f.owner]
    );

    expect(await getTokenBalance(f.context, f.vaultAta)).to.equal(BigInt(20 * USDC));
    expect(await getTokenBalance(f.context, f.ownerAta)).to.equal(
      beforeOwner + BigInt(30 * USDC)
    );
  });

  it("11. Descongelar restablece al agente", async () => {
    const f = await setupFixture({ initialDeposit: new BN(50 * USDC) });

    await sendBankrunTx(
      f.context,
      await f.methods
        .addRecipient(f.recipient.publicKey)
        .accountsStrict({ owner: f.owner.publicKey, vault: f.vault })
        .transaction(),
      [f.owner]
    );

    await sendBankrunTx(
      f.context,
      await f.methods
        .emergencyFreeze(true)
        .accountsStrict({ owner: f.owner.publicKey, vault: f.vault })
        .transaction(),
      [f.owner]
    );
    await sendBankrunTx(
      f.context,
      await f.methods
        .emergencyFreeze(false)
        .accountsStrict({ owner: f.owner.publicKey, vault: f.vault })
        .transaction(),
      [f.owner]
    );

    await sendBankrunTx(
      f.context,
      await f.methods
        .agentExecute(new BN(5 * USDC), makeHash("after-unfreeze"))
        .accountsStrict({
          agent: f.agent.publicKey,
          vault: f.vault,
          mint: f.mint,
          vaultTokenAccount: f.vaultAta,
          destinationToken: f.recipientAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .transaction(),
      [f.agent]
    );

    expect(await getTokenBalance(f.context, f.recipientAta)).to.equal(BigInt(5 * USDC));
  });

  it("12. RecipientNotAllowed (destino fuera de la allowlist) y también tras remove_recipient", async () => {
    const f = await setupFixture({ initialDeposit: new BN(50 * USDC) });

    // Attacker not in allowlist
    const txOut = await f.methods
      .agentExecute(new BN(5 * USDC), makeHash("not-allowed"))
      .accountsStrict({
        agent: f.agent.publicKey,
        vault: f.vault,
        mint: f.mint,
        vaultTokenAccount: f.vaultAta,
        destinationToken: f.attackerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();
    expectKipuErrorResult(
      await tryBankrunTx(f.context, txOut, [f.agent]),
      "RecipientNotAllowed"
    );

    // Add then remove recipient -> must fail with RecipientNotAllowed
    await sendBankrunTx(
      f.context,
      await f.methods
        .addRecipient(f.recipient.publicKey)
        .accountsStrict({ owner: f.owner.publicKey, vault: f.vault })
        .transaction(),
      [f.owner]
    );
    await sendBankrunTx(
      f.context,
      await f.methods
        .removeRecipient(f.recipient.publicKey)
        .accountsStrict({ owner: f.owner.publicKey, vault: f.vault })
        .transaction(),
      [f.owner]
    );

    const txAfterRemove = await f.methods
      .agentExecute(new BN(5 * USDC), makeHash("after-remove"))
      .accountsStrict({
        agent: f.agent.publicKey,
        vault: f.vault,
        mint: f.mint,
        vaultTokenAccount: f.vaultAta,
        destinationToken: f.recipientAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();
    expectKipuErrorResult(
      await tryBankrunTx(f.context, txAfterRemove, [f.agent]),
      "RecipientNotAllowed"
    );
  });

  it("13. InvalidMint (token account de destino con otro mint)", async () => {
    const f = await setupFixture({ initialDeposit: new BN(50 * USDC) });

    await sendBankrunTx(
      f.context,
      await f.methods
        .addRecipient(f.recipient.publicKey)
        .accountsStrict({ owner: f.owner.publicKey, vault: f.vault })
        .transaction(),
      [f.owner]
    );

    const otherMint = await createSplMint(f.context, f.owner.publicKey);
    const wrongMintDestAta = await createAtaAndMint(
      f.context,
      otherMint,
      f.recipient.publicKey,
      null,
      0n
    );

    const tx = await f.methods
      .agentExecute(new BN(5 * USDC), makeHash("wrong-mint"))
      .accountsStrict({
        agent: f.agent.publicKey,
        vault: f.vault,
        mint: f.mint,
        vaultTokenAccount: f.vaultAta,
        destinationToken: wrongMintDestAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();

    expectKipuErrorResult(
      await tryBankrunTx(f.context, tx, [f.agent]),
      "InvalidMint"
    );
  });

  it("14. InvalidDecisionHash (hash de ceros)", async () => {
    const f = await setupFixture({ initialDeposit: new BN(50 * USDC) });

    await sendBankrunTx(
      f.context,
      await f.methods
        .addRecipient(f.recipient.publicKey)
        .accountsStrict({ owner: f.owner.publicKey, vault: f.vault })
        .transaction(),
      [f.owner]
    );

    const zeroHash = new Array<number>(32).fill(0);
    const tx = await f.methods
      .agentExecute(new BN(5 * USDC), zeroHash)
      .accountsStrict({
        agent: f.agent.publicKey,
        vault: f.vault,
        mint: f.mint,
        vaultTokenAccount: f.vaultAta,
        destinationToken: f.recipientAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();

    expectKipuErrorResult(
      await tryBankrunTx(f.context, tx, [f.agent]),
      "InvalidDecisionHash"
    );
  });

  it("15. El agente no puede withdraw, update_policy, emergency_freeze ni add_recipient (UnauthorizedOwner)", async () => {
    const f = await setupFixture({ initialDeposit: new BN(50 * USDC) });
    const agentAta = await createAtaAndMint(
      f.context,
      f.mint,
      f.agent.publicKey,
      null,
      0n
    );

    const txs = [
      await f.methods
        .withdraw(new BN(5 * USDC))
        .accountsStrict({
          owner: f.agent.publicKey,
          vault: f.vault,
          mint: f.mint,
          vaultTokenAccount: f.vaultAta,
          ownerTokenAccount: agentAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .transaction(),
      await f.methods
        .updatePolicy(null, new BN(100 * USDC), null)
        .accountsStrict({ owner: f.agent.publicKey, vault: f.vault })
        .transaction(),
      await f.methods
        .emergencyFreeze(true)
        .accountsStrict({ owner: f.agent.publicKey, vault: f.vault })
        .transaction(),
      await f.methods
        .addRecipient(f.attacker.publicKey)
        .accountsStrict({ owner: f.agent.publicKey, vault: f.vault })
        .transaction(),
    ];

    for (const tx of txs) {
      expectKipuErrorResult(
        await tryBankrunTx(f.context, tx, [f.agent]),
        "UnauthorizedOwner"
      );
    }
  });

  it("16. Un tercero no puede congelar ni modificar nada", async () => {
    const f = await setupFixture({ initialDeposit: new BN(50 * USDC) });

    await sendBankrunTx(
      f.context,
      await f.methods
        .addRecipient(f.recipient.publicKey)
        .accountsStrict({ owner: f.owner.publicKey, vault: f.vault })
        .transaction(),
      [f.owner]
    );

    const ownerOnlyTxs = [
      await f.methods
        .emergencyFreeze(true)
        .accountsStrict({ owner: f.attacker.publicKey, vault: f.vault })
        .transaction(),
      await f.methods
        .updatePolicy(f.attacker.publicKey, null, null)
        .accountsStrict({ owner: f.attacker.publicKey, vault: f.vault })
        .transaction(),
      await f.methods
        .addRecipient(f.attacker.publicKey)
        .accountsStrict({ owner: f.attacker.publicKey, vault: f.vault })
        .transaction(),
      await f.methods
        .removeRecipient(f.recipient.publicKey)
        .accountsStrict({ owner: f.attacker.publicKey, vault: f.vault })
        .transaction(),
      await f.methods
        .withdraw(new BN(5 * USDC))
        .accountsStrict({
          owner: f.attacker.publicKey,
          vault: f.vault,
          mint: f.mint,
          vaultTokenAccount: f.vaultAta,
          ownerTokenAccount: f.attackerAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .transaction(),
    ];

    for (const tx of ownerOnlyTxs) {
      expectKipuErrorResult(
        await tryBankrunTx(f.context, tx, [f.attacker]),
        "UnauthorizedOwner"
      );
    }

    const agentTx = await f.methods
      .agentExecute(new BN(5 * USDC), makeHash("third-party-exec"))
      .accountsStrict({
        agent: f.attacker.publicKey,
        vault: f.vault,
        mint: f.mint,
        vaultTokenAccount: f.vaultAta,
        destinationToken: f.recipientAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();

    expectKipuErrorResult(
      await tryBankrunTx(f.context, agentTx, [f.attacker]),
      "UnauthorizedAgent"
    );
  });

  it("17. update_policy: cambios válidos; daily_limit < max_per_tx y new_agent == owner -> InvalidPolicyConfig", async () => {
    const f = await setupFixture({
      maxPerTx: new BN(10 * USDC),
      dailyLimit: new BN(25 * USDC),
    });

    await sendBankrunTx(
      f.context,
      await f.methods
        .updatePolicy(null, new BN(20 * USDC), new BN(80 * USDC))
        .accountsStrict({ owner: f.owner.publicKey, vault: f.vault })
        .transaction(),
      [f.owner]
    );

    const state = await f.fetchVault();
    expect(state.maxPerTx.toNumber()).to.equal(20 * USDC);
    expect(state.dailyLimit.toNumber()).to.equal(80 * USDC);

    const txInvalidLimits = await f.methods
      .updatePolicy(null, new BN(50 * USDC), new BN(40 * USDC))
      .accountsStrict({ owner: f.owner.publicKey, vault: f.vault })
      .transaction();
    expectKipuErrorResult(
      await tryBankrunTx(f.context, txInvalidLimits, [f.owner]),
      "InvalidPolicyConfig"
    );

    const txAgentIsOwner = await f.methods
      .updatePolicy(f.owner.publicKey, null, null)
      .accountsStrict({ owner: f.owner.publicKey, vault: f.vault })
      .transaction();
    expectKipuErrorResult(
      await tryBankrunTx(f.context, txAgentIsOwner, [f.owner]),
      "InvalidPolicyConfig"
    );
  });

  it("18. El agente anterior pierde acceso tras update_policy(new_agent) (UnauthorizedAgent)", async () => {
    const f = await setupFixture({ initialDeposit: new BN(50 * USDC) });
    const newAgent = Keypair.generate();

    await sendBankrunTx(
      f.context,
      await f.methods
        .addRecipient(f.recipient.publicKey)
        .accountsStrict({ owner: f.owner.publicKey, vault: f.vault })
        .transaction(),
      [f.owner]
    );

    await sendBankrunTx(
      f.context,
      await f.methods
        .updatePolicy(newAgent.publicKey, null, null)
        .accountsStrict({ owner: f.owner.publicKey, vault: f.vault })
        .transaction(),
      [f.owner]
    );

    const oldAgentTx = await f.methods
      .agentExecute(new BN(5 * USDC), makeHash("old-agent"))
      .accountsStrict({
        agent: f.agent.publicKey,
        vault: f.vault,
        mint: f.mint,
        vaultTokenAccount: f.vaultAta,
        destinationToken: f.recipientAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();
    expectKipuErrorResult(
      await tryBankrunTx(f.context, oldAgentTx, [f.agent]),
      "UnauthorizedAgent"
    );

    // New agent succeeds
    await sendBankrunTx(
      f.context,
      await f.methods
        .agentExecute(new BN(5 * USDC), makeHash("new-agent"))
        .accountsStrict({
          agent: newAgent.publicKey,
          vault: f.vault,
          mint: f.mint,
          vaultTokenAccount: f.vaultAta,
          destinationToken: f.recipientAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .transaction(),
      [newAgent]
    );
    expect(await getTokenBalance(f.context, f.recipientAta)).to.equal(BigInt(5 * USDC));
  });

  it("19. MathOverflow con daily_limit = u64::MAX y spent_today cerca del máximo", async () => {
    const u64Max = new BN(U64_MAX_STR);
    const firstSpend = u64Max.sub(new BN(5));

    const f = await setupFixture({
      maxPerTx: u64Max,
      dailyLimit: u64Max,
      initialOwnerMintAmount: BigInt(U64_MAX_STR),
      initialDeposit: u64Max,
    });

    await sendBankrunTx(
      f.context,
      await f.methods
        .addRecipient(f.recipient.publicKey)
        .accountsStrict({ owner: f.owner.publicKey, vault: f.vault })
        .transaction(),
      [f.owner]
    );

    // Spend u64::MAX - 5 -> succeeds
    await sendBankrunTx(
      f.context,
      await f.methods
        .agentExecute(firstSpend, makeHash("near-u64-max"))
        .accountsStrict({
          agent: f.agent.publicKey,
          vault: f.vault,
          mint: f.mint,
          vaultTokenAccount: f.vaultAta,
          destinationToken: f.recipientAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .transaction(),
      [f.agent]
    );

    // Spend 6 more: (u64::MAX - 5) + 6 overflows u64 -> MathOverflow
    const overflowTx = await f.methods
      .agentExecute(new BN(6), makeHash("trigger-overflow"))
      .accountsStrict({
        agent: f.agent.publicKey,
        vault: f.vault,
        mint: f.mint,
        vaultTokenAccount: f.vaultAta,
        destinationToken: f.recipientAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();

    expectKipuErrorResult(
      await tryBankrunTx(f.context, overflowTx, [f.agent]),
      "MathOverflow"
    );
  });

  it("20. withdraw por encima del saldo falla sin cambiar el estado", async () => {
    const f = await setupFixture({ initialDeposit: new BN(20 * USDC) });

    const beforeVaultBal = await getTokenBalance(f.context, f.vaultAta);
    const beforeOwnerBal = await getTokenBalance(f.context, f.ownerAta);
    const beforeState = await f.fetchVault();

    const tx = await f.methods
      .withdraw(new BN(25 * USDC))
      .accountsStrict({
        owner: f.owner.publicKey,
        vault: f.vault,
        mint: f.mint,
        vaultTokenAccount: f.vaultAta,
        ownerTokenAccount: f.ownerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();

    const res = await tryBankrunTx(f.context, tx, [f.owner]);
    expect(res.result).to.not.be.null;

    expect(await getTokenBalance(f.context, f.vaultAta)).to.equal(beforeVaultBal);
    expect(await getTokenBalance(f.context, f.ownerAta)).to.equal(beforeOwnerBal);
    const afterState = await f.fetchVault();
    expect(afterState.spentToday.toString()).to.equal(beforeState.spentToday.toString());
    expect(afterState.totalExecutions.toString()).to.equal(
      beforeState.totalExecutions.toString()
    );
  });
});
