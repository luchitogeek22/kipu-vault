import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SolanaProviders } from "@/components/SolanaProviders";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "KipuVault — Solana Smart Vault + AI Copilot",
  description:
    "Bóveda inteligente en Solana Devnet con guardrails on-chain que limitan el radio de daño de un agente de IA.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${jetbrainsMono.variable} dark`}
    >
      <body className="min-h-screen bg-kipu-bg font-sans antialiased">
        <SolanaProviders>{children}</SolanaProviders>
      </body>
    </html>
  );
}
