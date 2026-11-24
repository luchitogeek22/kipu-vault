import { PublicKey } from "@solana/web3.js";

const USDC_SCALE = 1_000_000n;

export function isValidSolanaPubkey(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    new PublicKey(trimmed);
    return true;
  } catch {
    return false;
  }
}

export function parseUsdcToBaseUnits(raw: string): bigint {
  const cleaned = raw.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(cleaned)) {
    throw new Error(
      "Ingresa un monto USDC válido positivo con hasta 6 decimales (ej. 5 o 10.50)"
    );
  }
  const [wholePart = "0", fracPart = ""] = cleaned.split(".");
  const paddedFrac = fracPart.padEnd(6, "0");
  const baseUnits = BigInt(wholePart) * USDC_SCALE + BigInt(paddedFrac);
  if (baseUnits <= 0n) {
    throw new Error("El monto debe ser mayor a cero");
  }
  return baseUnits;
}

export function formatBaseUnitsAsUsdc(
  value: bigint | string | number | null | undefined,
  decimalsToShow = 2
): string {
  if (value === null || value === undefined || value === "") {
    return "0.00";
  }
  const raw = typeof value === "bigint" ? value : BigInt(String(value));
  const negative = raw < 0n;
  const abs = negative ? -raw : raw;
  const whole = abs / USDC_SCALE;
  const frac = (abs % USDC_SCALE).toString().padStart(6, "0");
  const shownFrac =
    decimalsToShow >= 6 ? frac : frac.slice(0, Math.max(0, decimalsToShow));
  const prefix = negative ? "-" : "";
  return decimalsToShow > 0 ? `${prefix}${whole}.${shownFrac}` : `${prefix}${whole}`;
}

export function truncateMiddle(text: string, head = 6, tail = 4): string {
  if (text.length <= head + tail + 3) {
    return text;
  }
  return `${text.slice(0, head)}...${text.slice(-tail)}`;
}

export function explorerTxUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

export function explorerAddressUrl(address: string): string {
  return `https://explorer.solana.com/address/${address}?cluster=devnet`;
}
