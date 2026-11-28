"use client";

import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  Code2,
  Coins,
  Copy,
  ExternalLink,
  Fingerprint,
  HelpCircle,
  Layers,
  ListChecks,
  Lock,
  Play,
  ShieldAlert,
  ShieldCheck,
  Snowflake,
  Sparkles,
  TrendingUp,
  UserCheck,
  Wallet,
} from "lucide-react";
import { FRONTEND_CONFIG } from "@/lib/config";
import { explorerAddressUrl, explorerTxUrl, truncateMiddle } from "@/lib/format";
import {
  AuditCenterPreviewSection,
  HowItWorksAnimatedSection,
  ProblemStatementSection,
  Reveal,
  VERIFIED_DEVNET_PROOFS,
  type LandingLang,
} from "./LandingSections";

interface WelcomeScreenProps {
  onStartSetup: () => void;
  onViewDemo: () => void;
  onSkipAdvanced: () => void;
}

const GITHUB_URL = "https://github.com/luchitogeek22/kipu-vault";

/** Inline git repository SVG icon (lucide-react in this project omits Github). */
function GitRepoIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65S8.93 17.38 9 18v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

const ANCHOR_SNIPPET = `import { Program } from "@coral-xyz/anchor";

// El agente solo firma costos de red (SOL); la custodia sigue en la bóveda PDA
await program.methods
  .agentExecute(new BN(5_000_000)) // 5 Mock USDC (6 decimales)
  .accounts({
    agent: agentKeypair.publicKey,
    vault: vaultPda,
    vaultTokenAccount,
    recipientTokenAccount, // Validado contra vault.allowlist en el contrato
    tokenProgram: TOKEN_PROGRAM_ID,
  })
  .signers([agentKeypair])
  .rpc();`;

const CLIENT_SNIPPET = `// 1) Verifica intención del agente y registra SHA-256 on-chain
const res = await fetch(\`\${API_URL}/api/agent/execute\`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: \`Bearer \${siwsJwtToken}\`,
  },
  body: JSON.stringify({
    vault_pda: vaultPda,
    prompt: "Paga 5 Mock USDC por uso de API",
    red_team: false,
  }),
});

const { status, tx_signature, decision_hash } = await res.json();
// 2) Cualquier tercero puede validar el hash público:
// GET /api/audit/verify/\${tx_signature}`;

const API_ENDPOINTS = [
  {
    method: "GET",
    path: "/api/health",
    descEs: "Estado del agente, balance SOL en Devnet, modo demo e IDL cargado.",
    descEn: "Agent pubkey, Devnet SOL balance, demo mode, and loaded IDL state.",
  },
  {
    method: "POST",
    path: "/api/auth/nonce",
    descEs: "Genera un nonce de un solo uso para autenticación SIWS (Sign-In With Solana).",
    descEn: "Issues a single-use nonce for Sign-In With Solana (SIWS) login.",
  },
  {
    method: "POST",
    path: "/api/auth/verify",
    descEs: "Verifica firma Ed25519 de Phantom y emite un token JWT de sesión.",
    descEn: "Verifies Phantom Ed25519 signature and issues a scoped session JWT.",
  },
  {
    method: "POST",
    path: "/api/agent/execute",
    descEs: "Evalúa intención o prueba Red-Team, calcula SHA-256 y ejecuta AgentExecute.",
    descEn: "Evaluates prompt or Red-Team probe, computes SHA-256, and calls AgentExecute.",
  },
  {
    method: "GET",
    path: "/api/audit",
    descEs: "Devuelve el historial de decisiones autorizadas, bloqueadas y eventos Freeze.",
    descEn: "Returns vault audit ledger records: executed payouts, blocks, and freezes.",
  },
  {
    method: "GET",
    path: "/api/audit/verify/{tx_signature}",
    descEs: "Comprueba públicamente la correspondencia entre decision_hash y Solana Devnet.",
    descEn: "Public endpoint matching off-chain decision_hash against Solana Devnet logs.",
  },
];

export function WelcomeScreen({
  onStartSetup,
  onViewDemo,
  onSkipAdvanced,
}: WelcomeScreenProps) {
  const [lang, setLang] = useState<LandingLang>("es");
  const isEs = lang === "es";

  // Interactive hero simulator state
  const [simAmount, setSimAmount] = useState<number>(5);
  const [simToAttacker, setSimToAttacker] = useState<boolean>(false);
  const [simFrozen, setSimFrozen] = useState<boolean>(false);

  // Developer Experience tab state & clipboard feedback
  const [devTab, setDevTab] = useState<"anchor" | "client" | "api">("anchor");
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // FAQ accordion state
  const [openFaq, setOpenFaq] = useState<number>(0);

  const txCap = 10;
  const dailyCap = 50;
  const simBlockedReason = simFrozen
    ? isEs
      ? "Bóveda congelada (EmergencyFreeze)"
      : "Vault frozen (EmergencyFreeze)"
    : simToAttacker
      ? isEs
        ? "RecipientNotAllowed (Err 6008)"
        : "RecipientNotAllowed (Err 6008)"
      : simAmount > txCap
        ? isEs
          ? `ExceedsTransactionLimit (${simAmount} > ${txCap} Mock USDC)`
          : `ExceedsTransactionLimit (${simAmount} > ${txCap} Mock USDC)`
        : null;

  const simStatus = simFrozen ? "freeze" : simBlockedReason ? "blocked" : "allowed";

  const activeProof =
    simStatus === "freeze"
      ? VERIFIED_DEVNET_PROOFS[3]
      : simToAttacker
        ? VERIFIED_DEVNET_PROOFS[2]
        : simBlockedReason
          ? VERIFIED_DEVNET_PROOFS[1]
          : VERIFIED_DEVNET_PROOFS[0];

  const handleCopySnippet = async () => {
    const payload = devTab === "anchor" ? ANCHOR_SNIPPET : CLIENT_SNIPPET;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
      } else {
        const ta = document.createElement("textarea");
        ta.value = payload;
        ta.setAttribute("readonly", "");
        ta.style.position = "absolute";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      setCopiedCode(false);
    }
  };

  const navItems = [
    { href: "#problem", label: isEs ? "Problema" : "Problem" },
    { href: "#how-it-works", label: isEs ? "Cómo funciona" : "How it works" },
    { href: "#security-architecture", label: isEs ? "Arquitectura" : "Architecture" },
    { href: "#use-cases", label: isEs ? "Casos" : "Use cases" },
    { href: "#audit-preview", label: isEs ? "Auditoría" : "Audit" },
    { href: "#developers", label: "Developers" },
    { href: "#limits-faq", label: "FAQ" },
  ];

  const architectureLayers = [
    {
      num: "01",
      title: isEs ? "Límites on-chain" : "On-chain spending caps",
      metric: isEs ? "Tope/tx ≤ 10 · 24h ≤ 50 Mock USDC" : "Per-tx ≤ 10 · 24h ≤ 50 Mock USDC",
      desc: isEs
        ? "Cada instrucción AgentExecute valida el monto por transacción y el acumulado de ventana 24h directamente en Anchor antes de autorizar tokens."
        : "Every AgentExecute instruction validates per-tx amount and 24h rolling volume directly in Anchor before any token CPI.",
      icon: Coins,
      tone: "text-kipu-gold border-kipu-gold/30 bg-kipu-gold/10",
    },
    {
      num: "02",
      title: "Strict Allowlist",
      metric: isEs ? "Hasta 8 destinos aprobados" : "Up to 8 approved wallets",
      desc: isEs
        ? "La cuenta PDA almacena los destinatarios permitidos por el dueño. Cualquier intento hacia una dirección externa falla con Err 6008."
        : "The PDA stores owner-approved destination accounts. Transfers to any unlisted address revert with Err 6008.",
      icon: ListChecks,
      tone: "text-kipu-emerald border-kipu-emerald/30 bg-kipu-emerald/10",
    },
    {
      num: "03",
      title: "Emergency Freeze",
      metric: isEs ? "Bloqueo instantáneo del dueño" : "1-click owner kill switch",
      desc: isEs
        ? "Solo la wallet dueña puede ejecutar EmergencyFreeze para suspender al agente al instante sin perder acceso a sus retiros."
        : "Only the owner wallet can call EmergencyFreeze to halt all agent spending immediately while keeping owner withdrawal open.",
      icon: Snowflake,
      tone: "text-sky-400 border-sky-400/30 bg-sky-400/10",
    },
    {
      num: "04",
      title: isEs ? "Auditoría SHA-256 (Quipu)" : "SHA-256 Audit Trail (Quipu)",
      metric: isEs ? "Hash público + firma Devnet" : "Public hash + Devnet tx",
      desc: isEs
        ? "Inspirado en los quipus andinos para registrar cuentas exactas: cada decisión genera un SHA-256 verificable frente a la tx en Solana."
        : "Inspired by Andean quipu knotted ledgers: every agent intent yields a SHA-256 hash verifiable against Solana Devnet.",
      icon: Fingerprint,
      tone: "text-kipu-gold border-kipu-gold/30 bg-kipu-gold/10",
    },
  ];

  const useCases = [
    {
      tag: "AI Agents",
      title: isEs ? "Agentes que pagan APIs y cómputo" : "Autonomous API & compute spenders",
      desc: isEs
        ? "Permite que tu agente compre créditos, RPC o datos por demanda con un techo estricto de gasto por llamada y por día."
        : "Let your agent pay for SaaS APIs, RPC nodes, or data feeds on demand with strict per-call and daily budgets.",
      guard: isEs ? "Tope/tx + Allowlist de proveedores" : "Per-tx cap + provider allowlist",
      icon: Bot,
    },
    {
      tag: "Trading Bots",
      title: isEs ? "Bots de ejecución con riesgo acotado" : "Risk-bounded execution bots",
      desc: isEs
        ? "Aísla capital operativo en una bóveda PDA para evitar que un bug de sizing o slippage drene la tesorería completa."
        : "Isolate bot capital inside a PDA vault so sizing bugs or sudden anomalies can never drain the main treasury.",
      guard: isEs ? "Ventana 24h + Freeze inmediato" : "24h quota + instant Freeze",
      icon: TrendingUp,
    },
    {
      tag: "DeFi",
      title: isEs ? "Operaciones y rebalanceos autorizados" : "Allowlisted DeFi automation",
      desc: isEs
        ? "Restringe las interacciones automáticas únicamente a direcciones o vaults registrados previamente por el dueño."
        : "Restrict automated capital routing strictly to pre-approved protocol endpoints or settlement addresses.",
      guard: isEs ? "Allowlist estricta (Err 6008)" : "Strict allowlist (Err 6008)",
      icon: Layers,
    },
    {
      tag: "Web3 Applications",
      title: isEs ? "Payouts y recompensas programáticas" : "Programmatic SaaS payouts",
      desc: isEs
        ? "Emite reembolsos o incentivos en SPL Tokens desde un backend sin exponer la llave privada principal de tu empresa."
        : "Run automated SPL Token rewards or micro-payouts from a backend without exposing core multisig/treasury keys.",
      guard: isEs ? "Custodia PDA + auditoría SHA-256" : "PDA custody + SHA-256 ledger",
      icon: Activity,
    },
  ];

  const comparisonRows = [
    {
      aspect: isEs ? "¿Quién guarda los fondos?" : "Who holds custody?",
      eoa: isEs ? "La misma wallet del agente" : "Agent server key directly",
      multisig: isEs ? "Multisig N-of-M (Squads)" : "N-of-M Multisig (Squads)",
      kipu: isEs ? "Bóveda PDA (programa Anchor)" : "PDA Vault (Anchor program)",
    },
    {
      aspect: isEs ? "Si filtran la key del agente" : "If agent hot key leaks",
      eoa: isEs ? "Se vacía el 100% al instante" : "100% drained immediately",
      multisig: isEs ? "Requiere firmas humanas por tx" : "Requires human signatures per tx",
      kipu: isEs
        ? "Acotado por tope/tx, cuota 24h y allowlist"
        : "Capped by per-tx, 24h limit & allowlist",
    },
    {
      aspect: isEs ? "Ejecución autónoma sin clic humano" : "Autonomous execution",
      eoa: isEs ? "Sí, pero sin límites reales" : "Yes, without guardrails",
      multisig: isEs ? "No pensado para micro-pagos 24/7" : "Designed for human sign-offs",
      kipu: isEs ? "Sí, dentro de reglas on-chain" : "Yes, inside on-chain rules",
    },
    {
      aspect: isEs ? "Freno de emergencia del dueño" : "Owner emergency stop",
      eoa: isEs ? "Carrera contra el atacante" : "Race against attacker",
      multisig: isEs ? "Votación de firmantes" : "Multisig rotation vote",
      kipu: isEs ? "EmergencyFreeze en 1 clic" : "1-click EmergencyFreeze",
    },
  ];

  const faqs = [
    {
      q: isEs ? "¿KipuVault es custodial?" : "Is KipuVault custodial?",
      a: isEs
        ? "No. El código del smart contract en Solana Devnet mantiene los fondos en una PDA cuya autoridad administrativa y de retiro es únicamente tu wallet (Phantom). Nuestro backend no puede retirar fondos ni alterar la allowlist."
        : "No. Your funds live inside a Solana PDA vault where only your connected owner wallet holds withdrawal, allowlist, and policy update rights. Our backend cannot withdraw tokens or change rules.",
    },
    {
      q: isEs ? "¿Quién puede congelar la bóveda?" : "Who can trigger Emergency Freeze?",
      a: isEs
        ? "Únicamente la wallet dueña configurada en la PDA puede llamar a EmergencyFreeze o descongelar la bóveda. El agente delegado jamás tiene permisos para cambiar su propio límite o descongelarse."
        : "Only the owner wallet stored on the PDA can invoke EmergencyFreeze or unfreeze. The delegated agent can never raise its own limits or unfreeze the vault.",
    },
    {
      q: isEs
        ? "¿Qué pasa si se compromete el servidor del agente vs la wallet del dueño?"
        : "What happens if the agent key vs owner wallet is compromised?",
      a: isEs
        ? "Si se compromete el agente, el daño queda acotado por el tope por operación, el límite de 24h y las direcciones en la allowlist, además de poder congelar en 1 clic. Si se compromete la llave del dueño (Phantom), el atacante tiene control administrativo — exactamente igual que en cualquier protocolo Web3."
        : "If the agent key leaks, blast radius is strictly bounded by per-tx cap, 24h limit, and the allowlist, plus 1-click EmergencyFreeze. If the owner's Phantom wallet itself is compromised, administrative control is lost — just like with any non-custodial protocol.",
    },
    {
      q: isEs ? "¿Qué tokens soporta y está en mainnet?" : "Which tokens are supported & what about mainnet?",
      a: isEs
        ? "Actualmente la demo opera en Solana Devnet con Mock USDC (SPL Token clásico de 6 decimales) para que cualquiera pruebe sin riesgo real. El contrato aún no cuenta con auditoría externa ni despliegue en Mainnet."
        : "Currently live on Solana Devnet using Mock USDC (6-decimal SPL Token) for risk-free testing. The program has not undergone an external security audit and is not deployed to Mainnet yet.",
    },
  ];

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-kipu-bg text-kipu-text">
      {/* Top Bar — intentionally non-sticky so anchor navigation and controls are unobstructed */}
      <header className="border-b border-kipu-border bg-kipu-bg/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-kipu-gold/40 bg-kipu-gold/10 text-kipu-gold">
              <Lock className="h-4 w-4" />
            </span>
            <div>
              <span className="font-display text-sm font-bold tracking-tight text-kipu-text">
                KipuVault
              </span>
              <span className="ml-2 rounded-full border border-kipu-gold/30 bg-kipu-gold/10 px-2 py-0.5 font-mono text-[10px] font-medium text-kipu-gold">
                Solana Devnet
              </span>
            </div>
          </div>

          <nav
            aria-label={isEs ? "Navegación principal" : "Primary navigation"}
            className="hidden items-center gap-5 text-xs font-medium text-zinc-400 lg:flex"
          >
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="transition-colors hover:text-kipu-text"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub repository"
              className="hidden items-center gap-1.5 rounded-lg border border-kipu-border bg-kipu-card px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-700 hover:text-kipu-text sm:inline-flex"
            >
              <GitRepoIcon className="h-3.5 w-3.5" />
              <span>GitHub</span>
            </a>

            <div
              className="inline-flex rounded-lg border border-kipu-border bg-kipu-card p-0.5 text-[11px] font-semibold"
              role="group"
              aria-label={isEs ? "Idioma" : "Language"}
            >
              <button
                type="button"
                onClick={() => setLang("es")}
                className={`rounded-md px-2 py-1 transition-colors ${
                  isEs ? "bg-kipu-gold text-zinc-950" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                ES
              </button>
              <button
                type="button"
                onClick={() => setLang("en")}
                className={`rounded-md px-2 py-1 transition-colors ${
                  !isEs ? "bg-kipu-gold text-zinc-950" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                EN
              </button>
            </div>

            <button
              type="button"
              onClick={onSkipAdvanced}
              className="inline-flex items-center gap-1.5 rounded-lg border border-kipu-border bg-kipu-card px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-kipu-gold/50 hover:text-kipu-gold"
            >
              <span>{isEs ? "Ir al Panel" : "Open App"}</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* HERO + INTERACTIVE SIMULATOR (Preserved Core Experience) */}
      <section className="relative overflow-hidden border-b border-kipu-border">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.12),transparent_68%)]"
        />

        <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-12 lg:items-center lg:py-16">
          {/* Left Copy & CTAs */}
          <div className="min-w-0 space-y-6 lg:col-span-6">
            <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-kipu-gold/30 bg-kipu-gold/10 px-3 py-1 text-[11px] font-medium text-kipu-gold">
              <Sparkles className="h-3.5 w-3.5" />
              <span>
                {isEs
                  ? "Bóveda Anchor en Solana · Guardrails determinísticos para Agentes IA"
                  : "Solana Anchor Vault · Deterministic Guardrails for AI Agents"}
              </span>
            </div>

            <div className="space-y-3">
              <h1 className="font-display text-3xl font-bold leading-[1.08] tracking-tight text-kipu-text sm:text-5xl">
                {isEs ? (
                  <>
                    Dale autonomía a tu agente IA.{" "}
                    <span className="text-kipu-gold">Sin darle las llaves.</span>
                  </>
                ) : (
                  <>
                    Give your AI agent autonomy.{" "}
                    <span className="text-kipu-gold">Without giving up custody.</span>
                  </>
                )}
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-zinc-300 sm:text-base">
                {isEs
                  ? "KipuVault encierra los fondos en una bóveda PDA con topes por transacción, cuota diaria, allowlist estricta y freno de emergencia en 1 clic. Incluso si el LLM sufre prompt injection, el contrato rechaza cualquier desvío."
                  : "KipuVault locks funds inside a Solana PDA vault enforced by per-transaction limits, daily budgets, a strict allowlist, and a 1-click emergency freeze. Even under prompt injection, the smart contract rejects unauthorized payouts."}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <button
                type="button"
                onClick={onStartSetup}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-kipu-gold px-5 py-3 text-sm font-semibold text-zinc-950 shadow-[0_8px_24px_-6px_rgba(245,158,11,0.45)] transition-all hover:bg-amber-400"
              >
                <span>{isEs ? "Configurar mi bóveda" : "Configure Vault"}</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={onViewDemo}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-kipu-border bg-kipu-card px-5 py-3 text-sm font-medium text-kipu-text transition-colors hover:border-zinc-600 hover:bg-zinc-800/80"
              >
                <Play className="h-4 w-4 text-kipu-emerald" />
                <span>{isEs ? "Probar Sandbox sin wallet" : "Try Sandbox (no wallet)"}</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-kipu-border/80 pt-4 text-xs text-zinc-400">
              <a
                href={explorerAddressUrl(FRONTEND_CONFIG.programId)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-mono text-zinc-300 transition-colors hover:text-kipu-gold"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-kipu-emerald" />
                <span>Program {truncateMiddle(FRONTEND_CONFIG.programId, 6, 5)}</span>
                <ExternalLink className="h-3 w-3" />
              </a>
              <span className="text-zinc-600">•</span>
              <span>
                {isEs
                  ? "Devnet · Token de prueba Mock USDC · No auditado en Mainnet"
                  : "Devnet · Test token Mock USDC · Unaudited (Not on Mainnet)"}
              </span>
            </div>
          </div>

          {/* Right Interactive Simulator ("Intenta romper la bóveda") */}
          <div className="min-w-0 lg:col-span-6">
            <div className="kipu-card-glow rounded-2xl border border-kipu-border p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-kipu-border pb-3.5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-kipu-gold">
                    {isEs ? "Simulador interactivo local" : "Interactive local simulator"}
                  </p>
                  <h2 className="mt-0.5 text-base font-semibold text-kipu-text">
                    {isEs ? "Intenta romper la bóveda" : "Try to break the vault"}
                  </h2>
                </div>

                {/* Preset scenario buttons */}
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setSimFrozen(false);
                      setSimToAttacker(false);
                      setSimAmount(5);
                    }}
                    className={`rounded-lg border px-2.5 py-1 transition-colors ${
                      simStatus === "allowed"
                        ? "border-kipu-emerald/60 bg-kipu-emerald/15 text-kipu-emerald"
                        : "border-kipu-border bg-kipu-bg text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {isEs ? "Permitida" : "Allowed"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSimFrozen(false);
                      setSimToAttacker(false);
                      setSimAmount(150);
                    }}
                    className={`rounded-lg border px-2.5 py-1 transition-colors ${
                      simStatus === "blocked" && !simToAttacker
                        ? "border-kipu-crimson/60 bg-kipu-crimson/15 text-kipu-crimson"
                        : "border-kipu-border bg-kipu-bg text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {isEs ? "Bloqueada" : "Blocked"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimFrozen((prev) => !prev)}
                    className={`rounded-lg border px-2.5 py-1 transition-colors ${
                      simFrozen
                        ? "border-sky-400/60 bg-sky-400/15 text-sky-400"
                        : "border-kipu-border bg-kipu-bg text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {simFrozen
                      ? isEs
                        ? "Recuperar control"
                        : "Restore control"
                      : "Freeze"}
                  </button>
                </div>
              </div>

              {/* Active policy strip */}
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border border-kipu-border bg-kipu-bg/80 p-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                    {isEs ? "Tope / tx" : "Cap / tx"}
                  </p>
                  <p className="mt-0.5 font-mono text-xs font-semibold text-kipu-text">
                    {txCap} Mock USDC
                  </p>
                </div>
                <div className="rounded-xl border border-kipu-border bg-kipu-bg/80 p-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                    {isEs ? "Límite 24h" : "24h limit"}
                  </p>
                  <p className="mt-0.5 font-mono text-xs font-semibold text-kipu-text">
                    {dailyCap} Mock USDC
                  </p>
                </div>
                <div className="rounded-xl border border-kipu-border bg-kipu-bg/80 p-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">Allowlist</p>
                  <p className="mt-0.5 font-mono text-xs font-semibold text-kipu-emerald">
                    {isEs ? "1/8 activa" : "1/8 active"}
                  </p>
                </div>
              </div>

              {/* Amount slider & presets */}
              <div className="mt-4 space-y-3 rounded-xl border border-kipu-border bg-kipu-bg/70 p-3.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-zinc-300">
                    {isEs ? "Monto solicitado por el agente:" : "Amount requested by agent:"}
                  </span>
                  <span className="font-mono font-bold text-kipu-gold">
                    {simAmount} Mock USDC
                  </span>
                </div>

                <input
                  type="range"
                  min={1}
                  max={200}
                  value={simAmount}
                  onChange={(e) => setSimAmount(Number(e.target.value))}
                  aria-label={isEs ? "Monto en Mock USDC" : "Amount in Mock USDC"}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-amber-500"
                />

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1.5 text-[11px]">
                    {[5, 15, 150].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setSimFrozen(false);
                          setSimAmount(preset);
                        }}
                        className={`rounded-md border px-2 py-0.5 font-mono transition-colors ${
                          simAmount === preset
                            ? "border-kipu-gold/50 bg-kipu-gold/15 text-kipu-gold"
                            : "border-kipu-border bg-kipu-card text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        {preset} Mock USDC
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSimFrozen(false);
                      setSimToAttacker((v) => !v);
                    }}
                    className={`rounded-md border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                      simToAttacker
                        ? "border-kipu-crimson/60 bg-kipu-crimson/15 text-kipu-crimson"
                        : "border-kipu-border bg-kipu-card text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {simToAttacker
                      ? isEs
                        ? "Destino: Wallet atacante"
                        : "Target: Attacker wallet"
                      : isEs
                        ? "Destino: Allowlist segura"
                        : "Target: Safe allowlist"}
                  </button>
                </div>
              </div>

              {/* Outcome verdict card + real Devnet proof link */}
              <div
                className={`mt-4 rounded-xl border p-4 transition-colors ${
                  simStatus === "allowed"
                    ? "border-kipu-emerald/45 bg-kipu-emerald/[0.08]"
                    : simStatus === "freeze"
                      ? "border-sky-400/45 bg-sky-400/[0.08]"
                      : "border-kipu-crimson/45 bg-kipu-crimson/[0.08]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    {simStatus === "allowed" ? (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-kipu-emerald" />
                    ) : simStatus === "freeze" ? (
                      <Snowflake className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" />
                    ) : (
                      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-kipu-crimson" />
                    )}
                    <div>
                      <p className="text-xs font-semibold text-kipu-text">
                        {simStatus === "allowed"
                          ? isEs
                            ? `Autorizada: ${simAmount} Mock USDC dentro de límites y allowlist`
                            : `Authorized: ${simAmount} Mock USDC within cap and allowlist`
                          : simStatus === "freeze"
                            ? isEs
                              ? "Bóveda congelada: agente suspendido hasta recuperar control"
                              : "Vault frozen: agent halted until owner restores control"
                            : isEs
                              ? `Bloqueada on-chain: ${simBlockedReason}`
                              : `Blocked on-chain: ${simBlockedReason}`}
                      </p>
                      <p className="mt-1 text-[11px] text-zinc-300">
                        {simStatus === "allowed"
                          ? isEs
                            ? "Simulación local. Abajo tienes una firma real ejecutada bajo la misma regla en Solana Devnet."
                            : "Local simulation. Below is a real signature executed under this exact rule on Solana Devnet."
                          : isEs
                            ? "Resultado: 0 Mock USDC transferidos. Verifica una transacción real rechazada/congelada en Devnet:"
                            : "Outcome: 0 Mock USDC transferred. Inspect a real Devnet tx under this rule:"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2.5 text-[11px]">
                  <span className="font-mono text-zinc-400">
                    {isEs ? "Prueba verificada en Devnet:" : "Verified Devnet proof:"}{" "}
                    <strong className="text-zinc-200">{activeProof.instruction}</strong>
                  </span>
                  <a
                    href={explorerTxUrl(activeProof.signature)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-kipu-gold hover:underline"
                  >
                    <span>{truncateMiddle(activeProof.signature, 6, 5)}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 1: PROBLEM STATEMENT */}
      <ProblemStatementSection lang={lang} />

      {/* SECTION 2: HOW IT WORKS (ANIMATED PIPELINE + CUSTODY BOUNDARIES) */}
      <HowItWorksAnimatedSection lang={lang} />

      {/* SECTION 3: SECURITY ARCHITECTURE (4 PROTECTION LAYERS + QUIPU HERITAGE) */}
      <section
        id="security-architecture"
        className="mx-auto max-w-6xl border-b border-kipu-border px-4 py-14 sm:px-6 sm:py-16"
      >
        <Reveal>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-kipu-gold">
                {isEs ? "03 · Arquitectura de seguridad" : "03 · Security architecture"}
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-kipu-text sm:text-3xl">
                {isEs
                  ? "Cuatro capas de defensa sobre Anchor y SPL Token"
                  : "Four defense layers built on Anchor & SPL Token"}
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                {isEs
                  ? "Cada capa actúa de forma independiente dentro del smart contract: si el agente falla, la siguiente barrera detiene la salida."
                  : "Each layer operates independently inside the program: if one check is challenged, the contract halts the transfer."}
              </p>
            </div>
            <div className="rounded-xl border border-kipu-gold/25 bg-kipu-gold/[0.06] px-4 py-3 text-xs leading-relaxed text-zinc-300 lg:max-w-sm">
              <span className="font-semibold text-kipu-gold">
                {isEs ? "Origen del nombre Kipu: " : "Why Kipu: "}
              </span>
              {isEs
                ? "los quipus andinos registraban cada movimiento con nudos verificables. KipuVault lleva esa trazabilidad exacta a los agentes IA."
                : "Andean quipus recorded exact accounts with verifiable knots. KipuVault brings that auditable discipline to AI agents."}
            </div>
          </div>
        </Reveal>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {architectureLayers.map((layer, idx) => {
            const Icon = layer.icon;
            return (
              <Reveal key={layer.num} delayMs={idx * 60}>
                <article className="flex h-full flex-col justify-between rounded-2xl border border-kipu-border bg-kipu-card p-5 transition-colors hover:border-zinc-700">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border ${layer.tone}`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="font-mono text-xs font-semibold text-zinc-500">
                        {layer.num}
                      </span>
                    </div>
                    <h3 className="mt-3 text-sm font-semibold text-kipu-text">{layer.title}</h3>
                    <p className="mt-1 font-mono text-[11px] text-kipu-gold">{layer.metric}</p>
                    <p className="mt-2.5 text-xs leading-relaxed text-zinc-400">{layer.desc}</p>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* SECTION 4: USE CASES */}
      <section
        id="use-cases"
        className="mx-auto max-w-6xl border-b border-kipu-border px-4 py-14 sm:px-6 sm:py-16"
      >
        <Reveal>
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-kipu-gold">
              {isEs ? "04 · Casos de uso" : "04 · Use cases"}
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-kipu-text sm:text-3xl">
              {isEs
                ? "Diseñado para equipos que ejecutan valor on-chain sin supervisión manual constante"
                : "Built for teams shipping autonomous on-chain workflows"}
            </h2>
          </div>
        </Reveal>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {useCases.map((item, idx) => {
            const Icon = item.icon;
            return (
              <Reveal key={item.tag} delayMs={idx * 60}>
                <article className="flex h-full flex-col justify-between rounded-2xl border border-kipu-border bg-kipu-card p-5 transition-colors hover:border-zinc-700">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-kipu-border bg-kipu-bg px-2.5 py-0.5 font-mono text-[11px] text-kipu-gold">
                        <Icon className="h-3.5 w-3.5" />
                        <span>{item.tag}</span>
                      </span>
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-kipu-text">{item.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-400">{item.desc}</p>
                  </div>
                  <div className="mt-4 flex items-center gap-2 border-t border-kipu-border/80 pt-3 text-[11px] text-zinc-300">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-kipu-emerald" />
                    <span>{item.guard}</span>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* SECTION 5: AUDIT CENTER PREVIEW (REAL VERIFIED DEVNET RECORDS) */}
      <AuditCenterPreviewSection lang={lang} onOpenDashboard={onViewDemo} />

      {/* SECTION 6: DEVELOPER EXPERIENCE (SDK / QUICK START / API REFERENCE / GITHUB) */}
      <section
        id="developers"
        className="mx-auto max-w-6xl border-b border-kipu-border px-4 py-14 sm:px-6 sm:py-16"
      >
        <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
          <div className="min-w-0 space-y-4 lg:col-span-5">
            <Reveal>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-kipu-gold">
                {isEs ? "06 · Developer Experience" : "06 · Developer Experience"}
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-kipu-text sm:text-3xl">
                {isEs
                  ? "Integra guardrails on-chain en minutos"
                  : "Integrate on-chain guardrails in minutes"}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                {isEs
                  ? "El agente conserva su flujo normal, pero las instrucciones pasan por la PDA de KipuVault y el endpoint público de verificación SHA-256."
                  : "Keep your agent orchestration stack while routing payouts through KipuVault's Anchor PDA and public SHA-256 verification endpoints."}
              </p>

              <div className="mt-5 flex flex-wrap gap-2.5">
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-kipu-border bg-kipu-card px-4 py-2 text-xs font-medium text-kipu-text transition-colors hover:border-kipu-gold/50"
                >
                  <GitRepoIcon className="h-3.5 w-3.5 text-kipu-gold" />
                  <span>{isEs ? "Código en GitHub" : "View on GitHub"}</span>
                  <ExternalLink className="h-3 w-3 text-zinc-400" />
                </a>
                <a
                  href={explorerAddressUrl(FRONTEND_CONFIG.programId)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-kipu-border bg-kipu-card px-4 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-700"
                >
                  <Code2 className="h-3.5 w-3.5 text-kipu-emerald" />
                  <span>IDL &amp; Program Devnet</span>
                  <ExternalLink className="h-3 w-3 text-zinc-400" />
                </a>
              </div>
            </Reveal>
          </div>

          <div className="min-w-0 lg:col-span-7">
            <Reveal delayMs={70}>
              <div className="overflow-hidden rounded-2xl border border-kipu-border bg-kipu-card">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-kipu-border bg-kipu-bg/80 px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    {[
                      { id: "anchor" as const, label: "Quick Start (Anchor)" },
                      { id: "client" as const, label: "Client & Verify" },
                      { id: "api" as const, label: "API Reference" },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setDevTab(t.id)}
                        className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                          devTab === t.id
                            ? "bg-kipu-gold/15 text-kipu-gold"
                            : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {devTab !== "api" && (
                    <button
                      type="button"
                      onClick={handleCopySnippet}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-kipu-border bg-kipu-card px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:border-zinc-600"
                    >
                      {copiedCode ? (
                        <>
                          <Check className="h-3 w-3 text-kipu-emerald" />
                          <span className="text-kipu-emerald">
                            {isEs ? "Copiado" : "Copied"}
                          </span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>{isEs ? "Copiar" : "Copy"}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {devTab === "api" ? (
                  <div className="divide-y divide-kipu-border">
                    {API_ENDPOINTS.map((ep) => (
                      <div
                        key={ep.path}
                        className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                      >
                        <div className="flex min-w-0 items-center gap-2.5 font-mono text-xs">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              ep.method === "GET"
                                ? "bg-kipu-emerald/15 text-kipu-emerald"
                                : "bg-kipu-gold/15 text-kipu-gold"
                            }`}
                          >
                            {ep.method}
                          </span>
                          <span className="truncate text-kipu-text">{ep.path}</span>
                        </div>
                        <p className="text-xs text-zinc-400 sm:text-right">
                          {isEs ? ep.descEs : ep.descEn}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <pre className="w-full max-w-full overflow-x-auto p-4 font-mono text-xs leading-relaxed text-zinc-200 sm:p-5">
                    <code>{devTab === "anchor" ? ANCHOR_SNIPPET : CLIENT_SNIPPET}</code>
                  </pre>
                )}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* SECTION 7: HONEST LIMITS, MULTISIG COMPARISON, FAQ & ROADMAP */}
      <section
        id="limits-faq"
        className="mx-auto max-w-6xl border-b border-kipu-border px-4 py-14 sm:px-6 sm:py-16"
      >
        {/* Honest scope + Multisig comparison */}
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-5">
            <Reveal>
              <div className="h-full rounded-2xl border border-kipu-border bg-kipu-card p-5 sm:p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-kipu-gold">
                  {isEs ? "07 · Límites honestos" : "07 · Honest boundaries"}
                </p>
                <h2 className="mt-2 font-display text-xl font-bold text-kipu-text">
                  {isEs ? "Qué protege y qué no" : "What it protects vs what it doesn't"}
                </h2>

                <div className="mt-4 space-y-3 text-xs">
                  <div className="rounded-xl border border-kipu-emerald/30 bg-kipu-emerald/[0.06] p-3.5">
                    <p className="flex items-center gap-1.5 font-semibold text-kipu-emerald">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>{isEs ? "Protegido por el programa" : "Protected by the program"}</span>
                    </p>
                    <p className="mt-1.5 leading-relaxed text-zinc-300">
                      {isEs
                        ? "Topes por transacción, cuotas cada 24h, allowlist fija, EmergencyFreeze y separación entre agente y dueño."
                        : "Per-transaction caps, 24h rolling limits, strict allowlist, EmergencyFreeze, and agent vs owner separation."}
                    </p>
                  </div>

                  <div className="rounded-xl border border-kipu-crimson/30 bg-kipu-crimson/[0.06] p-3.5">
                    <p className="flex items-center gap-1.5 font-semibold text-kipu-crimson">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>{isEs ? "Fuera del alcance" : "Out of scope"}</span>
                    </p>
                    <p className="mt-1.5 leading-relaxed text-zinc-300">
                      {isEs
                        ? "Compromiso directo de la wallet del dueño (Phantom), pagos legítimos debajo del tope hacia una wallet maliciosa ya aprobada, y despliegue en Mainnet (actualmente solo Devnet sin auditoría externa)."
                        : "Direct owner wallet compromise, authorized transfers below cap to an already allowlisted destination, and Mainnet production use (currently unaudited Solana Devnet only)."}
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>

          <div className="min-w-0 lg:col-span-7">
            <Reveal delayMs={70}>
              <div className="h-full overflow-hidden rounded-2xl border border-kipu-border bg-kipu-card">
                <div className="border-b border-kipu-border px-5 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-kipu-gold">
                    {isEs ? "Comparativa arquitectónica" : "Architecture comparison"}
                  </p>
                  <h3 className="mt-1 font-display text-lg font-bold text-kipu-text">
                    {isEs
                      ? "¿Por qué no una wallet directa o un multisig tradicional?"
                      : "Why not a direct wallet or a human multisig?"}
                  </h3>
                </div>
                <div className="w-full overflow-x-auto">
                  <table className="w-full min-w-[540px] text-left text-xs">
                    <thead className="border-b border-kipu-border bg-kipu-bg/70 text-[11px] uppercase tracking-wider text-zinc-400">
                      <tr>
                        <th className="px-4 py-3 font-medium">
                          {isEs ? "Criterio" : "Criteria"}
                        </th>
                        <th className="px-4 py-3 font-medium">Wallet EOA</th>
                        <th className="px-4 py-3 font-medium">Multisig (Squads)</th>
                        <th className="px-4 py-3 font-semibold text-kipu-gold">KipuVault PDA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-kipu-border text-zinc-300">
                      {comparisonRows.map((row) => (
                        <tr key={row.aspect}>
                          <td className="px-4 py-3 font-medium text-kipu-text">{row.aspect}</td>
                          <td className="px-4 py-3 text-zinc-400">{row.eoa}</td>
                          <td className="px-4 py-3 text-zinc-400">{row.multisig}</td>
                          <td className="px-4 py-3 font-medium text-kipu-emerald">{row.kipu}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Reveal>
          </div>
        </div>

        {/* FAQ + Roadmap */}
        <div className="mt-8 grid gap-6 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-7">
            <Reveal>
              <div className="rounded-2xl border border-kipu-border bg-kipu-card p-5 sm:p-6">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-kipu-gold" />
                  <h3 className="font-display text-lg font-bold text-kipu-text">
                    {isEs ? "Preguntas frecuentes" : "Frequently asked questions"}
                  </h3>
                </div>

                <div className="mt-4 divide-y divide-kipu-border">
                  {faqs.map((item, index) => {
                    const open = openFaq === index;
                    return (
                      <div key={item.q} className="py-3 first:pt-1 last:pb-0">
                        <button
                          type="button"
                          onClick={() => setOpenFaq(open ? -1 : index)}
                          aria-expanded={open}
                          className="flex w-full items-center justify-between gap-3 text-left text-sm font-medium text-kipu-text transition-colors hover:text-kipu-gold"
                        >
                          <span>{item.q}</span>
                          <ChevronRight
                            className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${
                              open ? "rotate-90 text-kipu-gold" : ""
                            }`}
                          />
                        </button>
                        {open && (
                          <p className="mt-2 text-xs leading-relaxed text-zinc-400">{item.a}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </Reveal>
          </div>

          <div className="min-w-0 lg:col-span-5">
            <Reveal delayMs={70}>
              <div className="h-full rounded-2xl border border-kipu-border bg-kipu-card p-5 sm:p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-kipu-gold">
                  Roadmap
                </p>
                <h3 className="mt-1 font-display text-lg font-bold text-kipu-text">
                  {isEs ? "Evolución hacia Mainnet" : "Path to Mainnet"}
                </h3>
                <ol className="mt-4 space-y-3.5 text-xs">
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-kipu-emerald/40 bg-kipu-emerald/15 text-[10px] font-bold text-kipu-emerald">
                      ✓
                    </span>
                    <div>
                      <p className="font-semibold text-kipu-text">
                        {isEs ? "Solana Devnet operativo" : "Live on Solana Devnet"}
                      </p>
                      <p className="mt-0.5 text-zinc-400">
                        {isEs
                          ? "Bóveda PDA, Copilot con Red-Team, EmergencyFreeze y verificación SHA-256."
                          : "PDA vault, Red-Team Copilot, EmergencyFreeze, and SHA-256 verification."}
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-kipu-gold/40 bg-kipu-gold/15 text-[10px] font-bold text-kipu-gold">
                      2
                    </span>
                    <div>
                      <p className="font-semibold text-kipu-text">
                        {isEs
                          ? "Multi-agente por bóveda y alertas"
                          : "Multi-agent roles & real-time alerts"}
                      </p>
                      <p className="mt-0.5 text-zinc-400">
                        {isEs
                          ? "Cuotas independientes por agente y webhooks instantáneos ante bloqueos."
                          : "Per-agent sub-budgets and instant webhook alerts on blocked attempts."}
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-kipu-border bg-kipu-bg text-[10px] font-bold text-zinc-400">
                      3
                    </span>
                    <div>
                      <p className="font-semibold text-kipu-text">
                        {isEs ? "Auditoría externa y Mainnet Beta" : "External audit & Mainnet Beta"}
                      </p>
                      <p className="mt-0.5 text-zinc-400">
                        {isEs
                          ? "Revisión de seguridad independiente previa al soporte de USDC real."
                          : "Independent security review prior to supporting real USDC on Mainnet."}
                      </p>
                    </div>
                  </li>
                </ol>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* SECTION 8: FINAL CTA */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <Reveal>
          <div className="kipu-card-glow relative overflow-hidden rounded-3xl border border-kipu-gold/30 p-6 sm:p-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl space-y-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-kipu-gold">
                  {isEs ? "08 · Empieza ahora" : "08 · Get started"}
                </p>
                <h2 className="font-display text-2xl font-bold tracking-tight text-kipu-text sm:text-3xl">
                  {isEs
                    ? "Protege tu próximo agente IA con reglas verificables en Solana"
                    : "Protect your next AI agent with verifiable Solana rules"}
                </h2>
                <p className="text-sm text-zinc-300">
                  {isEs
                    ? "Despliega tu bóveda en Devnet con Phantom o explora todos los escenarios de bloqueo al instante en el Sandbox sin firmar nada."
                    : "Create your Devnet vault with Phantom or test every block scenario right away in the no-wallet Sandbox."}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={onStartSetup}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-kipu-gold px-5 py-3 text-sm font-semibold text-zinc-950 shadow-[0_8px_24px_-6px_rgba(245,158,11,0.45)] transition-all hover:bg-amber-400"
                >
                  <Wallet className="h-4 w-4" />
                  <span>{isEs ? "Configurar bóveda en Devnet" : "Launch Vault Setup"}</span>
                </button>
                <button
                  type="button"
                  onClick={onViewDemo}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-kipu-border bg-kipu-bg px-5 py-3 text-sm font-medium text-kipu-text transition-colors hover:border-zinc-600"
                >
                  <UserCheck className="h-4 w-4 text-kipu-emerald" />
                  <span>{isEs ? "Abrir Sandbox interactivo" : "Open Sandbox"}</span>
                </button>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-kipu-border bg-kipu-bg/95">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-zinc-300">KipuVault</span>
            <span>·</span>
            <span>
              {isEs
                ? "Solana Devnet · Demo educativa y de hackathon (no auditada en mainnet)"
                : "Solana Devnet · Hackathon & research prototype (unaudited, Devnet only)"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <a
              href={explorerAddressUrl(FRONTEND_CONFIG.programId)}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-zinc-400 hover:text-kipu-gold"
            >
              {truncateMiddle(FRONTEND_CONFIG.programId, 8, 6)}
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-kipu-text"
            >
              <GitRepoIcon className="h-3.5 w-3.5" />
              <span>GitHub</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
