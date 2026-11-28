"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Cpu,
  ExternalLink,
  FileCode2,
  Fingerprint,
  KeyRound,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Snowflake,
  Terminal,
  UserCheck,
  Wallet,
  XCircle,
} from "lucide-react";
import { explorerTxUrl, truncateMiddle } from "@/lib/format";

export type LandingLang = "es" | "en";

export type ProofKind = "executed" | "freeze" | "blocked_limit" | "blocked_allowlist";

export interface VerifiedDevnetProof {
  id: ProofKind;
  category: "authorized" | "blocked" | "freeze";
  badgeEs: string;
  badgeEn: string;
  titleEs: string;
  titleEn: string;
  instruction: string;
  detailEs: string;
  detailEn: string;
  amountLabel: string;
  signature: string;
  errorCode?: string;
}

/**
 * Verified real Solana Devnet transactions executed against program
 * EVPQDCiHnR47n7PKGw1nUD4dRm3ALN4AZrxgxj2kUfSx.
 */
export const VERIFIED_DEVNET_PROOFS: VerifiedDevnetProof[] = [
  {
    id: "executed",
    category: "authorized",
    badgeEs: "Autorizada",
    badgeEn: "Authorized",
    titleEs: "AgentExecute · Pago permitido",
    titleEn: "AgentExecute · Allowed payout",
    instruction: "AgentExecute",
    detailEs:
      "Monto dentro del tope/tx y destino presente en la allowlist. SPL Token ejecutó la transferencia.",
    detailEn:
      "Amount within per-tx cap and destination listed in allowlist. SPL Token executed the transfer.",
    amountLabel: "Dentro de reglas",
    signature:
      "3jbwLUqiVUA9qBxep2W3H39AwA1fP2P5nYi6kuzfGbbALrukXLTwZV8e5VpeTEzcrLa75TKBbYnJxuS7Nto2SLLU",
  },
  {
    id: "blocked_limit",
    category: "blocked",
    badgeEs: "Bloqueada",
    badgeEn: "Blocked",
    titleEs: "ExceedsTransactionLimit · 0 Mock USDC movidos",
    titleEn: "ExceedsTransactionLimit · 0 Mock USDC moved",
    instruction: "AgentExecute -> Err 6003",
    detailEs:
      "El agente intentó transferir por encima del tope por operación. Anchor abortó la instrucción antes de mover fondos.",
    detailEn:
      "Agent attempted to exceed the per-transaction cap. Anchor aborted the instruction before moving tokens.",
    amountLabel: "0 Mock USDC",
    signature:
      "Gs6rkU8BYGvJkz69KPdZVdmcJamNiohzujVejEYeR7MBDxiaEzmBiFi7qaYw4tdqU9mND7Y8z1zNeivBnVt2zXW",
    errorCode: "AnchorError 6003",
  },
  {
    id: "blocked_allowlist",
    category: "blocked",
    badgeEs: "Bloqueada",
    badgeEn: "Blocked",
    titleEs: "RecipientNotAllowed · 0 Mock USDC movidos",
    titleEn: "RecipientNotAllowed · 0 Mock USDC moved",
    instruction: "AgentExecute -> Err 6008",
    detailEs:
      "El destinatario no figuraba en la allowlist de la bóveda PDA. El programa rechazó la transferencia.",
    detailEn:
      "Destination wallet was absent from the PDA allowlist. The program rejected the transfer.",
    amountLabel: "0 Mock USDC",
    signature:
      "34GvjgQLNENKSimYLt7DmQwgdKXdH3S3CLpstiqUWnhtqpRf4QdTCrxgRNzB4fNfZ4L2aFJNyk3VaXmv5Cq1baUx",
    errorCode: "AnchorError 6008",
  },
  {
    id: "freeze",
    category: "freeze",
    badgeEs: "Freeze",
    badgeEn: "Freeze",
    titleEs: "EmergencyFreeze · Bóveda congelada",
    titleEn: "EmergencyFreeze · Vault frozen",
    instruction: "EmergencyFreeze",
    detailEs:
      "El dueño ejecutó el bloqueo de emergencia on-chain: toda operación del agente queda suspendida hasta reactivar.",
    detailEn:
      "Owner triggered on-chain emergency lock: all agent executions remain suspended until reactivated.",
    amountLabel: "0 Mock USDC",
    signature:
      "4BqtaonLWhqu3ej592qU1eJ8aFcRpuP2fN5kCGuK5tdKzipyY5ysAKk9APyHncwbcquVUdZFdDNWL48mHR8w64vK",
  },
];

interface RevealProps {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}

/**
 * Lightweight IntersectionObserver reveal wrapper that gracefully falls back
 * to visible after a short delay or when prefers-reduced-motion is set.
 */
export function Reveal({ children, className = "", delayMs = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.06, rootMargin: "0px 0px -24px 0px" }
    );
    observer.observe(el);

    const fallbackTimer = window.setTimeout(() => setVisible(true), 900);
    return () => {
      observer.disconnect();
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  return (
    <div
      ref={ref}
      style={delayMs > 0 ? { transitionDelay: `${delayMs}ms` } : undefined}
      className={`kipu-reveal ${visible ? "kipu-reveal-visible" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Section 1: Problem Statement — why autonomous AI agents with hot keys fail.
 */
export function ProblemStatementSection({ lang }: { lang: LandingLang }) {
  const isEs = lang === "es";

  const risks = [
    {
      icon: Terminal,
      tone: "text-kipu-crimson border-kipu-crimson/30 bg-kipu-crimson/10",
      title: isEs ? "Prompt injection en runtime" : "Runtime prompt injection",
      attack: isEs
        ? "Un texto externo manipula al modelo para que ignore sus instrucciones y apruebe una salida no prevista."
        : "Untrusted external input hijacks the model into ignoring its system instructions and issuing an unexpected payout.",
      whyFails: isEs
        ? "Las reglas en lenguaje natural son sugerencias probabilísticas, no límites técnicos."
        : "Natural-language instructions are probabilistic suggestions, not technical guardrails.",
    },
    {
      icon: AlertTriangle,
      tone: "text-kipu-gold border-kipu-gold/30 bg-kipu-gold/10",
      title: isEs ? "Alucinaciones de montos" : "Hallucinated transfer amounts",
      attack: isEs
        ? "El agente confunde unidades o decimales y firma un envío de 500 USDC en vez de 5 USDC."
        : "The agent misreads decimals or units and signs a 500 USDC transfer instead of 5 USDC.",
      whyFails: isEs
        ? "Una wallet EOA tradicional ejecuta cualquier monto que tenga saldo disponible."
        : "A standard hot wallet signs and settles any amount up to the full balance.",
    },
    {
      icon: ShieldAlert,
      tone: "text-kipu-crimson border-kipu-crimson/30 bg-kipu-crimson/10",
      title: isEs ? "Desvío a direcciones atacantes" : "Diversion to attacker wallets",
      attack: isEs
        ? "Un webhook alterado cambia la dirección destino hacia la wallet de un tercero."
        : "A tampered tool output or webhook swaps the recipient address for an attacker's wallet.",
      whyFails: isEs
        ? "Sin una allowlist verificada por el programa, la transacción se liquida de forma irreversible."
        : "Without an on-chain allowlist enforced at execution, the transfer settles irreversibly.",
    },
    {
      icon: KeyRound,
      tone: "text-sky-400 border-sky-400/30 bg-sky-400/10",
      title: isEs ? "Exposición de hot keys" : "Hot key exposure",
      attack: isEs
        ? "Si la llave privada del servidor del agente se filtra, una wallet normal queda vaciada al instante."
        : "If the agent server's private key leaks, a normal wallet can be drained immediately.",
      whyFails: isEs
        ? "La única defensa real es que el agente nunca custodie el fondo y pueda congelarse en 1 click."
        : "Real containment means the agent never holds custody and can be frozen in one click.",
    },
  ];

  return (
    <section
      id="problem"
      className="mx-auto max-w-6xl border-b border-kipu-border px-4 py-14 sm:px-6 sm:py-16"
    >
      <Reveal>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-kipu-crimson">
              {isEs ? "01 · El problema" : "01 · Problem statement"}
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-kipu-text sm:text-3xl">
              {isEs
                ? "Darle una wallet directa a un agente IA es darle un cheque en blanco"
                : "Giving an AI agent a direct wallet key is writing a blank check"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              {isEs
                ? "Los prompts no detienen un payload manipulado. Cuando el servidor del agente ya decidió enviar fondos, solo una política verificada por el smart contract puede frenar la transferencia."
                : "Prompts cannot stop a hijacked payload. Once an agent server decides to send funds, only deterministic smart-contract rules can reject the transaction."}
            </p>
          </div>
          <div className="rounded-xl border border-kipu-border bg-kipu-card px-4 py-3 text-xs text-zinc-300 lg:max-w-sm">
            <span className="font-semibold text-kipu-gold">
              {isEs ? "Principio KipuVault: " : "KipuVault principle: "}
            </span>
            {isEs
              ? "confía en el contrato en Solana, no en la obediencia del LLM."
              : "trust the Solana program, not LLM prompt compliance."}
          </div>
        </div>
      </Reveal>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {risks.map((item, idx) => {
          const Icon = item.icon;
          return (
            <Reveal key={item.title} delayMs={idx * 60}>
              <article className="flex h-full flex-col justify-between rounded-2xl border border-kipu-border bg-kipu-card p-5 transition-colors hover:border-zinc-700">
                <div>
                  <div
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border ${item.tone}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-kipu-text">{item.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-400">{item.attack}</p>
                </div>
                <p className="mt-4 border-t border-kipu-border/80 pt-3 text-[11px] leading-relaxed text-zinc-500">
                  {item.whyFails}
                </p>
              </article>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Section 2: Animated How It Works pipeline (Agent -> KipuVault SDK -> Smart Contract -> Solana)
 * alongside the 4-role custody model.
 */
export function HowItWorksAnimatedSection({ lang }: { lang: LandingLang }) {
  const isEs = lang === "es";
  const [flowMode, setFlowMode] = useState<"allowed" | "blocked">("allowed");
  const isAllowed = flowMode === "allowed";

  const nodes = [
    {
      step: "01",
      title: isEs ? "Agent IA" : "AI Agent",
      sub: isAllowed
        ? isEs
          ? "Propone 5 Mock USDC -> Allowlist"
          : "Proposes 5 Mock USDC -> Allowlist"
        : isEs
          ? "Intenta 150 Mock USDC (Red-Team)"
          : "Attempts 150 Mock USDC (Red-Team)",
      icon: Bot,
      state: "active",
    },
    {
      step: "02",
      title: "KipuVault SDK",
      sub: isEs
        ? "Serializa intención + hash SHA-256"
        : "Serializes intent + SHA-256 hash",
      icon: FileCode2,
      state: "active",
    },
    {
      step: "03",
      title: "Smart Contract (Anchor PDA)",
      sub: isAllowed
        ? isEs
          ? "Valida tope/tx, cuota 24h y allowlist"
          : "Checks per-tx cap, 24h quota & allowlist"
        : isEs
          ? "Rechaza Err 6003 ExceedsTransactionLimit"
          : "Rejects Err 6003 ExceedsTransactionLimit",
      icon: Cpu,
      state: isAllowed ? "pass" : "block",
    },
    {
      step: "04",
      title: "Solana Devnet",
      sub: isAllowed
        ? isEs
          ? "SPL Token liquida 5 Mock USDC"
          : "SPL Token settles 5 Mock USDC"
        : isEs
          ? "0 Mock USDC movidos · Estado intacto"
          : "0 Mock USDC moved · Vault untouched",
      icon: CheckCircle2,
      state: isAllowed ? "pass" : "halt",
    },
  ];

  const custodyRoles = [
    {
      num: "01",
      title: isEs ? "Dueño (Phantom)" : "Owner (Phantom)",
      desc: isEs
        ? "Define topes, edita la allowlist, retira libremente y puede congelar en 1 click."
        : "Sets caps, edits allowlist, withdraws freely, and can freeze in one click.",
      icon: UserCheck,
      tone: "text-kipu-gold",
    },
    {
      num: "02",
      title: isEs ? "Bóveda PDA (Custodia)" : "PDA Vault (Custody)",
      desc: isEs
        ? "Cuenta controlada por el programa Anchor. Guarda los fondos bajo reglas on-chain."
        : "Anchor-owned account holding funds under on-chain rules.",
      icon: Lock,
      tone: "text-kipu-emerald",
    },
    {
      num: "03",
      title: isEs ? "Agente IA (Delegado)" : "AI Agent (Delegated)",
      desc: isEs
        ? "Solo firma SOL para ejecutar pagos permitidos. No puede retirar ni cambiar reglas."
        : "Only signs SOL fees for allowed payouts. Cannot withdraw or alter rules.",
      icon: Bot,
      tone: "text-zinc-200",
    },
    {
      num: "04",
      title: isEs ? "Destino Allowlist" : "Allowlisted Recipient",
      desc: isEs
        ? "Solo wallets registradas en la bóveda pueden recibir fondos del programa."
        : "Only pre-authorized wallets in the vault allowlist can receive funds.",
      icon: Wallet,
      tone: "text-kipu-emerald",
    },
  ];

  return (
    <section
      id="how-it-works"
      className="mx-auto max-w-6xl border-b border-kipu-border px-4 py-14 sm:px-6 sm:py-16"
    >
      <Reveal>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-kipu-gold">
              {isEs ? "02 · Cómo funciona" : "02 · How it works"}
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-kipu-text sm:text-3xl">
              {isEs
                ? "De la intención del agente a la validación on-chain en Solana"
                : "From agent intent to deterministic on-chain validation"}
            </h2>
          </div>

          <div
            className="inline-flex w-fit rounded-xl border border-kipu-border bg-kipu-card p-1 text-xs font-medium"
            role="group"
            aria-label={isEs ? "Modo de flujo" : "Flow simulation mode"}
          >
            <button
              type="button"
              onClick={() => setFlowMode("allowed")}
              className={`rounded-lg px-3 py-1.5 transition-colors ${
                isAllowed
                  ? "bg-kipu-emerald/20 text-kipu-emerald"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {isEs ? "Flujo Permitido" : "Allowed Flow"}
            </button>
            <button
              type="button"
              onClick={() => setFlowMode("blocked")}
              className={`rounded-lg px-3 py-1.5 transition-colors ${
                !isAllowed
                  ? "bg-kipu-crimson/20 text-kipu-crimson"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {isEs ? "Bloqueo On-Chain" : "On-Chain Block"}
            </button>
          </div>
        </div>
      </Reveal>

      {/* Interactive animated 4-stage pipeline */}
      <Reveal delayMs={80}>
        <div className="mt-8 rounded-2xl border border-kipu-border bg-kipu-card p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-kipu-border/80 pb-3 text-xs">
            <span className="font-mono text-zinc-400">
              Agent -&gt; KipuVault SDK -&gt; Smart Contract -&gt; Solana
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                isAllowed
                  ? "border-kipu-emerald/40 bg-kipu-emerald/10 text-kipu-emerald"
                  : "border-kipu-crimson/40 bg-kipu-crimson/10 text-kipu-crimson"
              }`}
            >
              {isAllowed ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              {isAllowed
                ? isEs
                  ? "Autorizada · 5 Mock USDC transferidos"
                  : "Authorized · 5 Mock USDC settled"
                : isEs
                  ? "Rechazada en Smart Contract · 0 Mock USDC movidos"
                  : "Rejected at Smart Contract · 0 Mock USDC moved"}
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-4 md:gap-4">
            {nodes.map((node, index) => {
              const Icon = node.icon;
              const isBlockedNode = node.state === "block";
              const isHaltedNode = node.state === "halt";
              const isPassedNode = node.state === "pass";

              const cardStyle = isBlockedNode
                ? "border-kipu-crimson/60 bg-kipu-crimson/[0.08]"
                : isHaltedNode
                  ? "border-kipu-border bg-kipu-bg/60 opacity-65"
                  : isPassedNode
                    ? "border-kipu-emerald/45 bg-kipu-emerald/[0.06]"
                    : "border-kipu-border bg-kipu-bg";

              const iconStyle = isBlockedNode
                ? "border-kipu-crimson/40 bg-kipu-crimson/15 text-kipu-crimson"
                : isHaltedNode
                  ? "border-kipu-border bg-zinc-900 text-zinc-500"
                  : isPassedNode
                    ? "border-kipu-emerald/40 bg-kipu-emerald/15 text-kipu-emerald"
                    : "border-kipu-gold/30 bg-kipu-gold/10 text-kipu-gold";

              return (
                <div key={node.step} className="relative flex flex-col">
                  <div
                    className={`flex h-full flex-col justify-between rounded-xl border p-4 transition-all ${cardStyle}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${iconStyle}`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="font-mono text-[11px] font-semibold text-zinc-500">
                        {node.step}
                      </span>
                    </div>
                    <div className="mt-3">
                      <h3 className="text-sm font-semibold text-kipu-text">{node.title}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-400">{node.sub}</p>
                    </div>
                  </div>

                  {/* Animated signal track between nodes on desktop */}
                  {index < nodes.length - 1 && (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none hidden md:flex items-center justify-center my-0 absolute -right-4 top-1/2 z-10 w-4 -translate-y-1/2"
                    >
                      <div className="relative h-0.5 w-full overflow-hidden rounded-full bg-zinc-800">
                        {!( !isAllowed && index === 2 ) && (
                          <span
                            className={`kipu-flow-dot absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full ${
                              !isAllowed && index >= 1
                                ? "bg-kipu-crimson shadow-[0_0_8px_#EF4444]"
                                : "bg-kipu-emerald shadow-[0_0_8px_#10B981]"
                            }`}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Reveal>

      {/* Custody role separation cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {custodyRoles.map((role, idx) => {
          const Icon = role.icon;
          return (
            <Reveal key={role.num} delayMs={idx * 55}>
              <div className="h-full rounded-xl border border-kipu-border bg-kipu-card/70 p-4 transition-colors hover:border-zinc-700">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-zinc-500">{role.num}</span>
                  <Icon className={`h-4 w-4 ${role.tone}`} />
                </div>
                <h3 className="mt-2.5 text-sm font-semibold text-kipu-text">{role.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">{role.desc}</p>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Section 5: Audit Center Preview — interactive filterable preview backed
 * strictly by verified real Solana Devnet signatures.
 */
export function AuditCenterPreviewSection({
  lang,
  onOpenDashboard,
}: {
  lang: LandingLang;
  onOpenDashboard: () => void;
}) {
  const isEs = lang === "es";
  const [filter, setFilter] = useState<"all" | "authorized" | "blocked" | "freeze">("all");

  const filtered = VERIFIED_DEVNET_PROOFS.filter((item) =>
    filter === "all" ? true : item.category === filter
  );

  const filters: { id: "all" | "authorized" | "blocked" | "freeze"; label: string }[] = [
    { id: "all", label: isEs ? "Todos (4)" : "All (4)" },
    { id: "authorized", label: isEs ? "Autorizadas" : "Authorized" },
    { id: "blocked", label: isEs ? "Bloqueadas" : "Blocked" },
    { id: "freeze", label: "Freeze" },
  ];

  return (
    <section
      id="audit-preview"
      className="mx-auto max-w-6xl border-b border-kipu-border px-4 py-14 sm:px-6 sm:py-16"
    >
      <Reveal>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-kipu-gold">
              {isEs ? "05 · Audit Center" : "05 · Audit Center"}
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-kipu-text sm:text-3xl">
              {isEs
                ? "Nada bajo la alfombra: auditoría verificable en Solana"
                : "Nothing swept under the rug: verifiable Solana audit trail"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              {isEs
                ? "Cada decisión del agente registra un hash SHA-256 junto a la firma real en Devnet. Filtra abajo transacciones reales ejecutadas contra el programa."
                : "Every agent decision links a SHA-256 payload hash with its real Devnet signature. Filter real transactions executed against the program below."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {filters.map((tab) => {
              const active = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "border-kipu-gold/50 bg-kipu-gold/15 text-kipu-gold"
                      : "border-kipu-border bg-kipu-card text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </Reveal>

      <Reveal delayMs={80}>
        <div className="mt-8 overflow-hidden rounded-2xl border border-kipu-border bg-kipu-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-kipu-border bg-kipu-bg/60 px-4 py-3 text-xs">
            <span className="inline-flex items-center gap-2 font-medium text-zinc-300">
              <Fingerprint className="h-4 w-4 text-kipu-gold" />
              {isEs
                ? "Registros reales verificables en Solana Devnet"
                : "Real verifiable records on Solana Devnet"}
            </span>
            <button
              type="button"
              onClick={onOpenDashboard}
              className="inline-flex items-center gap-1.5 font-medium text-kipu-gold hover:underline"
            >
              {isEs ? "Abrir Audit Ledger completo" : "Open full Audit Ledger"}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="divide-y divide-kipu-border">
            {filtered.map((item) => {
              const isAuth = item.category === "authorized";
              const isFreeze = item.category === "freeze";
              const badgeTone = isAuth
                ? "border-kipu-emerald/40 bg-kipu-emerald/10 text-kipu-emerald"
                : isFreeze
                  ? "border-sky-400/40 bg-sky-400/10 text-sky-400"
                  : "border-kipu-crimson/40 bg-kipu-crimson/10 text-kipu-crimson";

              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 p-4 transition-colors hover:bg-white/[0.015] sm:flex-row sm:items-center sm:justify-between sm:px-5"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badgeTone}`}
                      >
                        {isAuth ? (
                          <ShieldCheck className="h-3 w-3" />
                        ) : isFreeze ? (
                          <Snowflake className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        {isEs ? item.badgeEs : item.badgeEn}
                      </span>
                      <span className="font-mono text-[11px] text-zinc-400">
                        {item.instruction}
                      </span>
                      {item.errorCode && (
                        <span className="rounded bg-kipu-crimson/15 px-1.5 py-0.5 font-mono text-[10px] text-kipu-crimson">
                          {item.errorCode}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-kipu-text">
                      {isEs ? item.titleEs : item.titleEn}
                    </h3>
                    <p className="text-xs leading-relaxed text-zinc-400">
                      {isEs ? item.detailEs : item.detailEn}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-3 sm:flex-col sm:items-end">
                    <span className="font-mono text-xs font-medium text-zinc-300">
                      {item.amountLabel}
                    </span>
                    <a
                      href={explorerTxUrl(item.signature)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-kipu-border bg-kipu-bg px-3 py-1.5 font-mono text-[11px] text-kipu-gold transition-colors hover:border-kipu-gold/50"
                    >
                      <span>{truncateMiddle(item.signature, 8, 6)}</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
