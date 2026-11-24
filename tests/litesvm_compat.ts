import fs from "fs";
import path from "path";
import {
  AccountInfo,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  Clock,
  FailedTransactionMetadata,
  LiteSvm,
  Rent,
  TransactionMetadata,
} from "litesvm/dist/internal";

export { Clock, FailedTransactionMetadata, Rent, TransactionMetadata };

/**
 * Thin @solana/web3.js v1 adapter over litesvm@1.6.2's internal NAPI binding
 * (PR #398 clears x87 FPU state on linux-x64, avoiding litesvm 0.3.3 std::bad_alloc).
 */
export class Web3LiteSVM {
  private readonly inner: LiteSvm;

  constructor() {
    this.inner = new LiteSvm();
  }

  getAccount(address: PublicKey): AccountInfo<Uint8Array> | null {
    const acc = this.inner.getAccount(address.toBytes());
    if (!acc) {
      return null;
    }
    const rawRentEpoch = acc.rentEpoch();
    const rentEpoch =
      rawRentEpoch > BigInt(Number.MAX_SAFE_INTEGER) ? 0 : Number(rawRentEpoch);
    return {
      executable: acc.executable(),
      owner: new PublicKey(acc.owner()),
      lamports: Number(acc.lamports()),
      data: acc.data(),
      rentEpoch,
    };
  }

  airdrop(
    address: PublicKey,
    lamports: bigint
  ): TransactionMetadata | FailedTransactionMetadata | null {
    return this.inner.airdrop(address.toBytes(), lamports);
  }

  addProgramFromFile(programId: PublicKey, programPath: string): void {
    this.inner.addProgramFromFile(programId.toBytes(), programPath);
  }

  sendTransaction(
    tx: Transaction | VersionedTransaction
  ): TransactionMetadata | FailedTransactionMetadata {
    if ("version" in tx) {
      return this.inner.sendVersionedTransaction(tx.serialize());
    }
    return this.inner.sendLegacyTransaction(tx.serialize());
  }

  latestBlockhash(): string {
    return this.inner.latestBlockhash();
  }

  expireBlockhash(): void {
    this.inner.expireBlockhash();
  }

  minimumBalanceForRentExemption(dataLen: bigint): bigint {
    return this.inner.minimumBalanceForRentExemption(dataLen);
  }

  getClock(): Clock {
    return this.inner.getClock();
  }

  setClock(clock: Clock): void {
    this.inner.setClock(clock);
  }

  getRent(): Rent {
    return this.inner.getRent();
  }
}

export function fromWorkspace(workspacePath: string): Web3LiteSVM {
  const sbfOutDir = path.join(workspacePath, "target", "deploy");
  const anchorTomlPath = path.join(workspacePath, "Anchor.toml");
  const lines = fs.readFileSync(anchorTomlPath, "utf8").split(/\r?\n/);

  const svm = new Web3LiteSVM();
  let inLocalnet = false;

  for (const rawLine of lines) {
    const line = rawLine.split("#")[0]?.trim() ?? "";
    if (!line) {
      continue;
    }
    if (line.startsWith("[")) {
      inLocalnet = line === "[programs.localnet]";
      continue;
    }
    if (!inLocalnet) {
      continue;
    }
    const match = /^([A-Za-z0-9_-]+)\s*=\s*"([^"]+)"/.exec(line);
    if (!match) {
      continue;
    }
    const programKey = match[1];
    const programId = match[2];
    if (!programKey || !programId) {
      continue;
    }
    const programPath = path.join(
      sbfOutDir,
      `${programKey.replace(/-/g, "_")}.so`
    );
    svm.addProgramFromFile(new PublicKey(programId), programPath);
  }

  return svm;
}
