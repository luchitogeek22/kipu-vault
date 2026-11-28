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
  title: "KipuVault — On-Chain Guardrails on Solana for AI Agents",
  description:
    "Solana Devnet smart vault that caps how much and where your AI agent can spend using on-chain limits, strict allowlists, Emergency Freeze, and SHA-256 verification.",
  openGraph: {
    title: "KipuVault — Give your AI agent autonomy. Without giving up custody.",
    description:
      "Anchor smart-contract rules on Solana Devnet: per-tx cap, 24h rolling quota, strict allowlist, and 1-click Emergency Freeze.",
    url: "https://kipu-vault.vercel.app",
    siteName: "KipuVault",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "KipuVault — On-Chain Guardrails for AI Agents on Solana",
    description:
      "Contain autonomous agent blast radius with Anchor policies, Emergency Freeze, and verifiable Solana Explorer proofs.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} dark`}
    >
      <body className="min-h-screen bg-kipu-bg font-sans antialiased">
        <SolanaProviders>{children}</SolanaProviders>
      </body>
    </html>
  );
}
