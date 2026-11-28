import rawIdl from "../idl/kipu_vault.json";

const FALLBACK_PROGRAM_ID = "KipuVau1t1111111111111111111111111111111111";

export const FRONTEND_CONFIG = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  solanaRpcUrl:
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com",
  programId:
    process.env.NEXT_PUBLIC_PROGRAM_ID ||
    (rawIdl as { address?: string }).address ||
    FALLBACK_PROGRAM_ID,
  demoMint:
    process.env.NEXT_PUBLIC_DEMO_MINT ||
    "J133Fwmo6WbCHE49vhTGeWxLLguoFotnKfeRUzcTzDxk",
  demoRecipient:
    process.env.NEXT_PUBLIC_DEMO_RECIPIENT ||
    "3kx3s1viSB9p5bZt3wDiyaiVZ5j7uNCA488PMEdWgVpN",
  demoAttacker:
    process.env.NEXT_PUBLIC_DEMO_ATTACKER ||
    "AKSZ5fvbe5rG7FeGqPKca5h1v3TDd8YJ1gjfFZ1SVBW1",
  pollarPublishableKey: process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY || "",
} as const;
