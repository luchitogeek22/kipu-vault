import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { SolanaProviders } from "@/components/SolanaProviders";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://kipu-vault.vercel.app"),
  title: "KipuVault — Guardrails On-Chain en Solana para Agentes de IA",
  description:
    "Bóveda inteligente en Solana Devnet que limita cuánto y a quién puede transferir tu agente de IA mediante límites on-chain, allowlist, Emergency Freeze y auditoría SHA-256.",
  openGraph: {
    title: "KipuVault — Tu agente es IA. El control sigue siendo tuyo.",
    description:
      "Reglas en contratos Anchor sobre Solana Devnet: tope por transacción, cupo diario 24h, allowlist estricta y Emergency Freeze.",
    url: "https://kipu-vault.vercel.app",
    siteName: "KipuVault",
    locale: "es_PE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "KipuVault — Guardrails On-Chain para Agentes de IA en Solana",
    description:
      "Limita el radio de daño de agentes autónomos con políticas en Anchor, Emergency Freeze y pruebas verificables en Solana Explorer.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} dark`}
    >
      <body className="min-h-screen bg-kipu-bg font-sans antialiased">
        <SolanaProviders>{children}</SolanaProviders>
      </body>
    </html>
  );
}
