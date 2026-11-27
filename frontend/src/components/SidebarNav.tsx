"use client";

import React, { useState } from "react";
import {
  Activity,
  Bot,
  Compass,
  ExternalLink,
  HelpCircle,
  LayoutDashboard,
  Shield,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { FRONTEND_CONFIG } from "@/lib/config";
import { explorerAddressUrl, truncateMiddle } from "@/lib/format";

interface SidebarNavProps {
  showWizardAction: boolean;
  onOpenWizard: () => void;
  onOpenHelp: () => void;
  onOpenWelcome: () => void;
  isRealVault: boolean;
}

export function SidebarNav({
  showWizardAction,
  onOpenWizard,
  onOpenHelp,
  onOpenWelcome,
  isRealVault,
}: SidebarNavProps) {
  const [activeId, setActiveId] = useState<string>("sec-overview");

  const navItems = [
    { id: "sec-overview", label: "Dashboard", icon: LayoutDashboard },
    { id: "sec-copilot", label: "Copilot IA", icon: Bot },
    { id: "sec-config", label: "Vault Config", icon: Shield },
    { id: "sec-activity", label: "Activity Center", icon: Activity },
  ];

  return (
    <aside
      aria-label="Navegación lateral KipuVault"
      className="hidden lg:flex lg:w-56 lg:shrink-0 lg:flex-col lg:justify-between lg:border-r lg:border-kipu-border lg:bg-[#0C0C0E] lg:p-4"
    >
      <div className="space-y-6">
        {/* Brand matching TrustScan top-left */}
        <button
          type="button"
          onClick={onOpenWelcome}
          className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1 text-left transition hover:opacity-90"
          title="Volver a la pantalla de bienvenida"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-kipu-gold/50 bg-kipu-gold/15 text-kipu-gold">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-white">
            kipuvault<span className="text-kipu-gold">.</span>
          </span>
        </button>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeId === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={() => setActiveId(item.id)}
                className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                  active
                    ? "border-kipu-gold/50 bg-kipu-gold/10 text-white"
                    : "border-transparent text-zinc-400 hover:bg-kipu-card hover:text-zinc-100"
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${
                    active ? "text-kipu-gold" : "text-zinc-400"
                  }`}
                />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>

        <div className="border-t border-kipu-border pt-4">
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Manage
          </p>
          <div className="space-y-1">
            {showWizardAction && (
              <button
                type="button"
                onClick={onOpenWizard}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-kipu-card hover:text-white"
              >
                <Wrench className="h-4 w-4 text-zinc-400" />
                <span>Asistente</span>
              </button>
            )}
            <button
              type="button"
              onClick={onOpenHelp}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-kipu-card hover:text-white"
            >
              <HelpCircle className="h-4 w-4 text-kipu-gold" />
              <span>Ayuda & Glosario</span>
            </button>
            <button
              type="button"
              onClick={onOpenWelcome}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-kipu-card hover:text-white"
            >
              <Compass className="h-4 w-4 text-zinc-400" />
              <span>Bienvenida</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom TrustScan-style Card adapted to real Solana Devnet Program */}
      <div className="kipu-card-glow rounded-xl border border-kipu-gold/30 p-3 text-xs">
        <p className="font-display text-xs font-bold text-white">
          {isRealVault ? "Devnet Vault Active" : "Solana Devnet"}
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-300">
          Contrato Anchor verificado en Solana Devnet:
        </p>
        <p className="mt-1 font-mono text-[11px] text-kipu-gold">
          {truncateMiddle(FRONTEND_CONFIG.programId, 6, 5)}
        </p>
        <a
          href={explorerAddressUrl(FRONTEND_CONFIG.programId)}
          target="_blank"
          rel="noreferrer"
          className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-kipu-gold px-2.5 py-1.5 text-[11px] font-semibold text-zinc-950 transition hover:bg-amber-400"
        >
          Ver en Explorer
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </aside>
  );
}
