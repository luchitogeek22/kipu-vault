export const FRONTEND_CONFIG = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
  solanaRpcUrl:
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
  programId:
    process.env.NEXT_PUBLIC_PROGRAM_ID ??
    "KipuVau1t1111111111111111111111111111111111",
} as const;
