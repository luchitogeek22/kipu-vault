"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  Code2,
  Copy,
  ExternalLink,
  FileSearch,
  Globe,
  HelpCircle,
  KeyRound,
  Lock,
  Milestone,
  PlayCircle,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Snowflake,
  Terminal,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { FRONTEND_CONFIG } from "@/lib/config";
import {
  explorerAddressUrl,
  explorerTxUrl,
  truncateMiddle,
} from "@/lib/format";

interface WelcomeScreenProps {
  onStartSetup: () => void;
  onViewDemo: () => void;
  onSkipAdvanced: () => void;
}

function GitRepoIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.11.78-.25.78-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.05 11.05 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.24 2.76.12 3.05.74.8 1.19 1.83 1.19 3.08 0 4.41-2.69 5.39-5.26 5.67.41.36.78 1.06.78 2.14 0 1.54-.01 2.79-.01 3.17 0 .31.21.67.79.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

type Lang = "es" | "en";
type RecipientKind = "allowlist" | "attacker";
type SimTab = "allowed" | "blocked" | "freeze";
type FlowPhase = "idle" | "proposing" | "validating" | "resolved";

const MAX_PER_TX = 10;
const DAILY_LIMIT = 50;
const GITHUB_URL = "https://github.com/luchitogeek22/kipu-vault";

// Real verified blocked & executed transactions observed on Solana Devnet for EVPQDCiHnR47n7PKGw1nUD4dRm3ALN4AZrxgxj2kUfSx
const DEVNET_PROOF_TXS = {
  exceedsLimit:
    "Gs6rkU8BYGvJkz69KPdZVdmcJamNiohzujVejEYeR7MBDxiaEzmBiFi7qaYw4tdqU9mND7Y8z1zNeivBnVt2zXW",
  notAllowlisted:
    "34GvjgQLNENKSimYLt7DmQwgdKXdH3S3CLpstiqUWnhtqpRf4QdTCrxgRNzB4fNfZ4L2aFJNyk3VaXmv5Cq1baUx",
  executedFreeze:
    "4BqtaonLWhqu3ej592qU1eJ8aFcRpuP2fN5kCGuK5tdKzipyY5ysAKk9APyHncwbcquVUdZFdDNWL48mHR8w64vK",
};

const CODE_SNIPPET = `import { Program } from "@coral-xyz/anchor";

// El agente nunca posee tus fondos: firma una autoridad delegada acotada por VaultState (PDA)
const tx = await program.methods
  .agentExecute(new BN(5_000_000), decisionHashBytes) // 5.00 Mock USDC (SPL)
  .accounts({ vault: vaultPda, agent: agentKeypair.publicKey, recipientOwner, ... })
  .signers([agentKeypair])
  .rpc();
// Si excede tope/tx, límite 24h, allowlist o is_frozen == true => Solana revierte la tx.`;

const COPY = {
  es: {
    navHow: "Cómo funciona",
    navLimits: "Límites y FAQ",
    navPanel: "Ir al Panel",
    heroBadge: "Solana Devnet · DEV3PACK Hackathon · Token de prueba (Mock USDC)",
    h1Line1: "Tu agente es IA.",
    h1Line2: "El control sigue",
    h1Accent: "siendo tuyo.",
    heroSub:
      "Tú fijas en un contrato Anchor cuánto puede gastar tu agente, a qué wallets y cuándo congelarlo. Si sufre prompt injection, Solana revierte el exceso antes de mover un solo token.",
    ctaPrimary: "Probar demo en Sandbox",
    ctaSecondary: "Conectar wallet y crear bóveda",
    ctaDiffNote:
      "«Probar demo en Sandbox» abre el Copilot interactivo sin wallet · «Conectar wallet» inicia la configuración real en Solana Devnet.",
    proofTitle: "Prueba real verificable del bloqueo en Devnet",
    proofSub:
      "No es solo promesa: inspecciona transacciones reales revertidas por nuestro contrato en Solana Explorer (0 Mock USDC perdidos).",
    proofLimitLabel: "Bloqueo por tope (ExceedsTransactionLimit · 6003)",
    proofAllowLabel: "Bloqueo por destino (RecipientNotAllowed · 6008)",
    proofProgramLabel: "Programa Anchor",
    simTitle: "Intenta romper la bóveda",
    simSub:
      "Simulación local con reglas de Devnet (Mock USDC). Ajusta monto, destino o lanza un ataque.",
    tabAllowed: "Permitida",
    tabBlocked: "Bloqueada",
    tabFreeze: "Freeze",
    attackBtn: "Simular agente comprometido (150 Mock USDC → atacante)",
    amountLabel: "Monto que intenta el agente (Mock USDC):",
    destAllowedTitle: "Destino en Allowlist",
    destAttackTitle: "Wallet desconocida",
    destAttackSub: "Fuera de Allowlist",
    step1: "01 · Solicitud del agente de IA",
    step2: "02 · Reglas evaluadas (simulación local · Mock USDC)",
    step3Prefix: "03 · ",
    unfreezeBtn: "Recuperar control",
    simFooterA: "El agente propone.",
    simFooterB: "Tus reglas en Solana deciden.",
    howTitle: "Cómo funciona bajo el capó",
    howSub:
      "El agente nunca controla tus llaves de dueño: solo opera mediante autoridad delegada sobre una PDA con reglas inmutables.",
    howNodes: [
      {
        num: "01",
        title: "Dueño (Owner Wallet)",
        desc: "Tu Phantom/Solflare firma reglas, deposita Mock USDC y mantiene retiro libre o Freeze instantáneo.",
      },
      {
        num: "02",
        title: "Bóveda PDA (Anchor)",
        desc: 'Cuenta derivada [b"kipu_vault", owner, mint] que custodia el saldo y verifica límites 100% on-chain.',
      },
      {
        num: "03",
        title: "Agente IA (Delegado)",
        desc: "Solo puede proponer pagos vía agent_execute con huella SHA-256. No puede cambiar reglas ni retirar.",
      },
      {
        num: "04",
        title: "Destino (Allowlist)",
        desc: "Si el monto cabe en tope/tx + ventana 24h y la cuenta está en las 8 autorizadas, la tx se ejecuta.",
      },
    ],
    quipuTitle: "Del Quipu andino a Solana",
    quipuBody:
      "En los Andes incas, el quipu registraba la contabilidad oficial del imperio mediante nudos auditables por cualquiera. KipuVault toma esa idea para agentes autónomos: cada decisión de la IA genera un hash SHA-256 canónico grabado dentro de la propia transacción en Solana.",
    devTitle: "Integración directa para desarrolladores",
    devSub:
      "Un agente no necesita custodia: invoca agent_execute con su keypair operativo y el contrato hace cumplir las políticas.",
    copyBtn: "Copiar",
    copiedBtn: "Copiado",
    compareTitle: "¿Por qué no una wallet normal o un multisig?",
    compareCols: ["Criterio", "Wallet directa", "Multisig (ej. Squads)", "KipuVault"],
    compareRows: [
      ["Autonomía de IA", "Riesgo total si filtran clave", "Frena cada pago con firmas humanas", "Autónoma dentro de topes on-chain"],
      ["Tope por pago + 24h", "Ninguno", "Políticas generales de gasto", "Nativo en PDA + Emergency Freeze 1-clic"],
      ["Allowlist + Auditoría IA", "No", "Sin hash de intención del LLM", "Allowlist (8) + SHA-256 canónico on-chain"],
    ],
    useCasesTitle: "Casos de uso reales",
    useCases: [
      {
        title: "Bot de trading acotado",
        desc: "Opera estrategias con un tope por operación y límite diario para evitar drenajes ante errores de señal.",
      },
      {
        title: "Agente que paga APIs y cómputo",
        desc: "Paga únicamente a proveedores en Allowlist en lenguaje natural sin exponer la tesorería principal.",
      },
      {
        title: "Tesorería operativa DAO",
        desc: "Asigna presupuestos semanales de recompensas o servicios con auditoría verificable por cada pago.",
      },
    ],
    honestTitle: "Transparencia técnica: qué protege y qué no",
    honestWarning:
      "Aviso: KipuVault opera actualmente en Solana Devnet con token de prueba Mock USDC y aún no cuenta con auditoría externa de seguridad.",
    protectsTitle: "Qué sí garantiza el contrato",
    protectsList: [
      "Ningún pago supera el tope por transacción ni el límite de 24h aunque el LLM o el servidor sean comprometidos.",
      "Cero transferencias fuera de la Allowlist aprobada por el propietario.",
      "Con Freeze activo el agente queda detenido, pero el propietario siempre puede retirar sus fondos.",
    ],
    limitsTitle: "Limitaciones actuales conocidas",
    limitsList: [
      "Si se compromete la llave privada del Dueño (owner), el atacante controla la bóveda.",
      "Ventana fija de 24h (en el borde exacto de reinicio permite gastar hasta 2× límite diario).",
      "Soporta SPL Token clásico (hasta 8 destinos en Allowlist); Token-2022 y múltiples agentes están en roadmap.",
    ],
    faqTitle: "Preguntas frecuentes",
    faqs: [
      {
        q: "¿Es custodial?",
        a: "No. Tu wallet de Solana es la única propietaria (owner) de la bóveda PDA; solo tú puedes depositar, retirar o actualizar reglas.",
      },
      {
        q: "¿Quién puede congelar la bóveda?",
        a: "Únicamente la firma del propietario mediante Emergency Freeze. Ni el agente ni el backend pueden descongelarla.",
      },
      {
        q: "¿Qué tokens soporta?",
        a: "Actualmente SPL Token clásico (en esta demo de Devnet usa Mock USDC como token de prueba).",
      },
      {
        q: "¿Cuándo llega a mainnet?",
        a: "Tras auditoría formal de seguridad del programa Anchor, soporte Token-2022 y pruebas prolongadas en Devnet.",
      },
    ],
    roadmapTitle: "Roadmap",
    roadmap: [
      { phase: "Fase 1 · Hoy", items: "Devnet vivo, Anchor + 20 tests LiteSVM, Sandbox & Copilot" },
      { phase: "Fase 2", items: "Auditoría externa, Token-2022 y ventana deslizante de 24h" },
      { phase: "Fase 3", items: "Mainnet Beta, múltiples agentes por bóveda y alertas webhook/Telegram" },
    ],
    footerLeft: "Construido en Perú · Inspirado en el Quipu andino.",
    footerRight: "SOLANA DEVNET · DEV3PACK HACKATHON · MOCK USDC",
  },
  en: {
    navHow: "How it works",
    navLimits: "Limits & FAQ",
    navPanel: "Open App",
    heroBadge: "Solana Devnet · DEV3PACK Hackathon · Test token (Mock USDC)",
    h1Line1: "Your agent is AI.",
    h1Line2: "Control stays",
    h1Accent: "with you.",
    heroSub:
      "You enforce per-transaction caps, 24h daily limits, destination allowlists, and an instant Emergency Freeze inside an Anchor contract. Even under prompt injection, Solana blocks excess transfers.",
    ctaPrimary: "Try interactive Sandbox",
    ctaSecondary: "Connect wallet & setup vault",
    ctaDiffNote:
      "“Try interactive Sandbox” opens the AI Copilot without a wallet · “Connect wallet” starts real Solana Devnet setup.",
    proofTitle: "Verifiable on-chain block proofs on Devnet",
    proofSub:
      "Not just a promise: inspect real transactions reverted by our Anchor program on Solana Explorer (0 Mock USDC lost).",
    proofLimitLabel: "Per-tx cap block (ExceedsTransactionLimit · 6003)",
    proofAllowLabel: "Allowlist block (RecipientNotAllowed · 6008)",
    proofProgramLabel: "Anchor Program",
    simTitle: "Try to break the vault",
    simSub:
      "Local simulation mirroring Devnet rules (Mock USDC). Adjust amount, destination, or trigger an attack.",
    tabAllowed: "Allowed",
    tabBlocked: "Blocked",
    tabFreeze: "Freeze",
    attackBtn: "Simulate compromised agent (150 Mock USDC → attacker)",
    amountLabel: "Attempted transfer amount (Mock USDC):",
    destAllowedTitle: "Allowlisted destination",
    destAttackTitle: "Unknown wallet",
    destAttackSub: "Not in Allowlist",
    step1: "01 · AI agent transfer request",
    step2: "02 · Rules evaluated (local simulation · Mock USDC)",
    step3Prefix: "03 · ",
    unfreezeBtn: "Recover control",
    simFooterA: "The agent proposes.",
    simFooterB: "Your Solana rules decide.",
    howTitle: "How it works under the hood",
    howSub:
      "The agent never holds owner custody keys — it only calls agent_execute under a delegated authority bound by a PDA.",
    howNodes: [
      {
        num: "01",
        title: "Owner Wallet",
        desc: "Your Phantom/Solflare sets limits, deposits Mock USDC, keeps unrestricted withdraw & instant Freeze.",
      },
      {
        num: "02",
        title: "Vault PDA (Anchor)",
        desc: 'Derived account [b"kipu_vault", owner, mint] custodying funds and enforcing rules 100% on-chain.',
      },
      {
        num: "03",
        title: "AI Agent (Delegated)",
        desc: "Can only invoke agent_execute with a SHA-256 decision hash. Cannot edit policies or withdraw.",
      },
      {
        num: "04",
        title: "Allowlist Target",
        desc: "If amount fits per-tx + 24h cap and target is in up to 8 approved wallets, the tx settles.",
      },
    ],
    quipuTitle: "From the Andean Quipu to Solana",
    quipuBody:
      "In the Inca Andes, the quipu recorded official treasury ledgers using verifiable knotted cords. KipuVault brings that heritage to autonomous agents: every AI decision produces a canonical SHA-256 hash committed inside the Solana instruction itself.",
    devTitle: "Built for developers to integrate fast",
    devSub:
      "An agent stays non-custodial: call agent_execute with its operational keypair and let Anchor enforce guardrails.",
    copyBtn: "Copy",
    copiedBtn: "Copied",
    compareTitle: "Why not a standard wallet or a multisig?",
    compareCols: ["Criteria", "Direct Wallet", "Multisig (e.g. Squads)", "KipuVault"],
    compareRows: [
      ["AI Autonomy", "Total loss if key leaks", "Requires human sign-offs per tx", "Autonomous within on-chain caps"],
      ["Per-tx + 24h Cap", "None", "General spending limits", "Native PDA rules + 1-click Freeze"],
      ["Allowlist + AI Audit", "No", "No LLM intent hash anchor", "Strict 8-slot allowlist + SHA-256"],
    ],
    useCasesTitle: "Real-world use cases",
    useCases: [
      {
        title: "Bounded trading bot",
        desc: "Executes trades under strict per-tx and daily loss caps to contain strategy bugs.",
      },
      {
        title: "API & compute payment agent",
        desc: "Pays pre-approved vendor wallets from natural language without risking main treasury.",
      },
      {
        title: "DAO operational treasury",
        desc: "Allocates recurring bounty or service budgets with verifiable decision hashes per payout.",
      },
    ],
    honestTitle: "Honest scope: what it protects and what it does not",
    honestWarning:
      "Notice: KipuVault currently runs on Solana Devnet using test Mock USDC and has not undergone an external security audit.",
    protectsTitle: "What the contract guarantees",
    protectsList: [
      "No transfer can exceed max/tx or 24h daily cap even if the LLM and backend server are compromised.",
      "Zero outflows outside the owner-approved Allowlist.",
      "Emergency Freeze halts the agent immediately while the owner can always withdraw funds.",
    ],
    limitsTitle: "Current known limitations",
    limitsList: [
      "If the Owner wallet private key is compromised, the attacker controls the vault.",
      "Fixed 24h window reset (allows up to 2× daily limit across the exact window boundary).",
      "Supports classic SPL Token (up to 8 allowlist targets); Token-2022 and multi-agent are on the roadmap.",
    ],
    faqTitle: "Frequently asked questions",
    faqs: [
      {
        q: "Is it custodial?",
        a: "No. Your Solana wallet is the sole owner of the Vault PDA; only you can deposit, withdraw, or change limits.",
      },
      {
        q: "Who can freeze the vault?",
        a: "Only the owner signature via Emergency Freeze. Neither the agent nor the backend can unfreeze it.",
      },
      {
        q: "Which tokens are supported?",
        a: "Classic SPL Token today (this Devnet demo uses Mock USDC as a test token).",
      },
      {
        q: "When is Mainnet?",
        a: "After an external Anchor security audit, Token-2022 support, and extended Devnet soak testing.",
      },
    ],
    roadmapTitle: "Roadmap",
    roadmap: [
      { phase: "Phase 1 · Live", items: "Devnet deploy, Anchor + 20 LiteSVM tests, Sandbox & Copilot" },
      { phase: "Phase 2", items: "External security audit, Token-2022, rolling 24h window" },
      { phase: "Phase 3", items: "Mainnet Beta, multiple agents per vault, webhook/Telegram alerts" },
    ],
    footerLeft: "Built in Peru · Inspired by the Andean Quipu.",
    footerRight: "SOLANA DEVNET · DEV3PACK HACKATHON · MOCK USDC",
  },
} as const;

export function WelcomeScreen({
  onStartSetup,
  onViewDemo,
  onSkipAdvanced,
}: WelcomeScreenProps) {
  const [lang, setLang] = useState<Lang>("es");
  const [amount, setAmount] = useState<number>(150);
  const [recipientKind, setRecipientKind] =
    useState<RecipientKind>("attacker");
  const [frozen, setFrozen] = useState<boolean>(false);
  const [phase, setPhase] = useState<FlowPhase>("idle");
  const [copied, setCopied] = useState<boolean>(false);
  const timersRef = useRef<number[]>([]);

  const t = COPY[lang];

  const clearTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  };

  useEffect(() => clearTimers, []);

  const triggerBriefFlow = () => {
    clearTimers();
    setPhase("proposing");
    const t1 = window.setTimeout(() => setPhase("validating"), 170);
    const t2 = window.setTimeout(() => setPhase("resolved"), 360);
    timersRef.current = [t1, t2];
  };

  const passLimit = !frozen && amount <= MAX_PER_TX;
  const passDaily = !frozen && amount <= DAILY_LIMIT;
  const passAllowlist = !frozen && recipientKind === "allowlist";
  const isAllowed = passLimit && passDaily && passAllowlist;

  const activeTab: SimTab = frozen
    ? "freeze"
    : isAllowed
      ? "allowed"
      : "blocked";

  const applyTab = (tab: SimTab) => {
    if (tab === "allowed") {
      setFrozen(false);
      setAmount(5);
      setRecipientKind("allowlist");
      triggerBriefFlow();
    } else if (tab === "blocked") {
      setFrozen(false);
      setAmount(150);
      setRecipientKind("attacker");
      triggerBriefFlow();
    } else {
      clearTimers();
      setPhase("idle");
      setFrozen(true);
    }
  };

  const launchCompromisedAttack = () => {
    setFrozen(false);
    setAmount(150);
    setRecipientKind("attacker");
    triggerBriefFlow();
  };

  const handleAmountChange = (val: number) => {
    const clamped = Number.isFinite(val)
      ? Math.max(1, Math.min(200, Math.round(val)))
      : 1;
    setAmount(clamped);
    if (!frozen) triggerBriefFlow();
  };

  const handleRecipientChange = (kind: RecipientKind) => {
    setRecipientKind(kind);
    if (!frozen) triggerBriefFlow();
  };

  const handleCopySnippet = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(CODE_SNIPPET);
      } else {
        throw new Error("Clipboard API unavailable");
      }
      setCopied(true);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = CODE_SNIPPET;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
      } catch {
        setCopied(false);
      }
    }
    window.setTimeout(() => setCopied(false), 1800);
  };

  const destinationAddress =
    recipientKind === "allowlist"
      ? truncateMiddle(FRONTEND_CONFIG.demoRecipient, 5, 4)
      : truncateMiddle(FRONTEND_CONFIG.demoAttacker, 5, 4);

  let outcomeTitle =
    lang === "es" ? "TRANSFERENCIA PERMITIDA" : "TRANSFER ALLOWED";
  let outcomeReason =
    lang === "es"
      ? "Dentro del tope por operación, límite diario y Allowlist verificada."
      : "Within per-tx cap, 24h daily limit, and verified Allowlist.";

  if (frozen) {
    outcomeTitle =
      lang === "es"
        ? "AGENTE DETENIDO · FREEZE ACTIVO"
        : "AGENT HALTED · FREEZE ACTIVE";
    outcomeReason =
      lang === "es"
        ? "Emergency Freeze bloquea toda salida al instante sin perder tus Mock USDC."
        : "Emergency Freeze halts all outflows immediately with 0 Mock USDC lost.";
  } else if (!passLimit && !passAllowlist) {
    outcomeTitle =
      lang === "es" ? "TRANSFERENCIA BLOQUEADA" : "TRANSFER BLOCKED";
    outcomeReason =
      lang === "es"
        ? `${amount.toFixed(2)} Mock USDC supera el tope (${MAX_PER_TX} Mock USDC) y el destino está fuera de Allowlist. 0 Mock USDC perdidos.`
        : `${amount.toFixed(2)} Mock USDC exceeds ${MAX_PER_TX} Mock USDC cap and target is not allowlisted. 0 Mock USDC lost.`;
  } else if (!passLimit) {
    outcomeTitle =
      lang === "es"
        ? "TRANSFERENCIA BLOQUEADA · EXCEDE TOPE"
        : "TRANSFER BLOCKED · EXCEEDS CAP";
    outcomeReason =
      lang === "es"
        ? `${amount.toFixed(2)} Mock USDC supera el máximo de ${MAX_PER_TX.toFixed(2)} Mock USDC por transacción.`
        : `${amount.toFixed(2)} Mock USDC exceeds the ${MAX_PER_TX.toFixed(2)} Mock USDC per-transaction cap.`;
  } else if (!passAllowlist) {
    outcomeTitle =
      lang === "es"
        ? "TRANSFERENCIA BLOQUEADA · ALLOWLIST"
        : "TRANSFER BLOCKED · ALLOWLIST";
    outcomeReason =
      lang === "es"
        ? "Tu agente no puede enviar Mock USDC a direcciones no autorizadas."
        : "Your agent cannot send Mock USDC to unapproved addresses.";
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-kipu-bg text-zinc-100">
      {/* Top minimal landing bar */}
      <header className="border-b border-kipu-border bg-kipu-bg/95">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-kipu-gold/50 bg-kipu-gold/15 text-kipu-gold">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-white">
              kipuvault<span className="text-kipu-gold">.</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <a
              href="#how-it-works"
              className="hidden text-xs font-medium text-zinc-200 transition hover:text-white md:inline"
            >
              {t.navHow}
            </a>
            <a
              href="#limits-faq"
              className="hidden text-xs font-medium text-zinc-200 transition hover:text-white md:inline"
            >
              {t.navLimits}
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-kipu-border bg-kipu-card px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white"
            >
              <GitRepoIcon className="h-3.5 w-3.5" />
              <span>GitHub</span>
            </a>

            {/* ES / EN Toggle */}
            <div
              role="group"
              aria-label="Selector de idioma"
              className="inline-flex items-center rounded-lg border border-kipu-border bg-kipu-card p-0.5 text-xs"
            >
              <Globe className="mx-1.5 h-3.5 w-3.5 text-zinc-300" />
              {(["es", "en"] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  className={`rounded-md px-2 py-1 font-mono text-xs font-semibold uppercase transition ${
                    lang === code
                      ? "bg-kipu-gold text-zinc-950"
                      : "text-zinc-300 hover:text-white"
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onSkipAdvanced}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-600 bg-kipu-card px-3 py-1.5 text-xs font-semibold text-white transition hover:border-kipu-gold hover:text-kipu-gold"
            >
              {t.navPanel}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-14 px-4 py-8 sm:px-6 lg:py-12">
        {/* Hero + Interactive Sim + Real On-Chain Block Proof */}
        <section className="grid items-start gap-8 lg:grid-cols-12 lg:gap-10">
          {/* Left Hero */}
          <div className="min-w-0 space-y-5 lg:col-span-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-kipu-gold/45 bg-kipu-gold/10 px-3 py-1 text-xs font-semibold text-amber-200">
              <span className="h-1.5 w-1.5 rounded-full bg-kipu-gold" />
              {t.heroBadge}
            </div>

            <h1 className="font-display text-4xl font-bold leading-[1.06] tracking-[-0.03em] text-white sm:text-5xl lg:text-[52px]">
              {t.h1Line1}
              <br />
              {t.h1Line2}
              <br />
              <span className="text-kipu-gold">{t.h1Accent}</span>
            </h1>

            <p className="max-w-lg text-sm leading-relaxed text-zinc-200 sm:text-base">
              {t.heroSub}
            </p>

            <div className="space-y-2 pt-1">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onViewDemo}
                  className="inline-flex items-center gap-2 rounded-lg bg-kipu-gold px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-kipu-gold"
                >
                  <PlayCircle className="h-4 w-4" />
                  {t.ctaPrimary}
                  <ArrowRight className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={onStartSetup}
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-600 bg-kipu-card px-5 py-2.5 text-sm font-medium text-white transition hover:border-kipu-gold hover:text-kipu-gold focus:outline-none focus:ring-2 focus:ring-kipu-gold/50"
                >
                  <Wallet className="h-4 w-4 text-kipu-gold" />
                  {t.ctaSecondary}
                </button>
              </div>
              <p className="text-xs leading-relaxed text-zinc-300">
                {t.ctaDiffNote}
              </p>
            </div>

            {/* Real On-Chain Block Proof Box (Devnet Transactions) */}
            <div className="kipu-card-glow rounded-xl border border-kipu-emerald/40 p-4">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                  <ShieldCheck className="h-4 w-4" />
                  {t.proofTitle}
                </span>
                <span className="rounded border border-kipu-emerald/40 bg-kipu-emerald/15 px-2 py-0.5 font-mono text-xs font-medium text-emerald-200">
                  Solana Devnet
                </span>
              </div>
              <p className="text-xs leading-relaxed text-zinc-200">
                {t.proofSub}
              </p>

              <div className="mt-3 space-y-2">
                <a
                  href={explorerTxUrl(DEVNET_PROOF_TXS.exceedsLimit)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-2 rounded-lg border border-kipu-crimson/45 bg-kipu-crimson/10 px-3 py-2 text-xs transition hover:border-kipu-crimson"
                >
                  <span className="font-medium text-red-100">
                    {t.proofLimitLabel}
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 font-mono text-kipu-gold">
                    {truncateMiddle(DEVNET_PROOF_TXS.exceedsLimit, 5, 5)}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </span>
                </a>

                <a
                  href={explorerTxUrl(DEVNET_PROOF_TXS.notAllowlisted)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-2 rounded-lg border border-kipu-crimson/45 bg-kipu-crimson/10 px-3 py-2 text-xs transition hover:border-kipu-crimson"
                >
                  <span className="font-medium text-red-100">
                    {t.proofAllowLabel}
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 font-mono text-kipu-gold">
                    {truncateMiddle(DEVNET_PROOF_TXS.notAllowlisted, 5, 5)}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </span>
                </a>

                <a
                  href={explorerAddressUrl(FRONTEND_CONFIG.programId)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-2 rounded-lg border border-kipu-border bg-kipu-bg px-3 py-2 text-xs transition hover:border-kipu-emerald"
                >
                  <span className="font-medium text-zinc-200">
                    {t.proofProgramLabel}
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 font-mono text-emerald-300">
                    {truncateMiddle(FRONTEND_CONFIG.programId, 8, 6)}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </span>
                </a>
              </div>
            </div>
          </div>

          {/* Right Interactive Card */}
          <div className="min-w-0 lg:col-span-6">
            <div
              aria-label={t.simTitle}
              className="kipu-card-glow rounded-2xl border border-kipu-border p-5"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-semibold text-white">
                    {t.simTitle}
                  </h2>
                  <p className="text-xs text-zinc-300">{t.simSub}</p>
                </div>
                <span className="rounded border border-zinc-700 bg-kipu-bg px-2 py-0.5 font-mono text-xs font-semibold text-zinc-200">
                  SANDBOX
                </span>
              </div>

              <div className="mb-3 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  aria-pressed={activeTab === "allowed"}
                  onClick={() => applyTab("allowed")}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold transition ${
                    activeTab === "allowed"
                      ? "border-kipu-emerald bg-kipu-emerald/20 text-emerald-100"
                      : "border-kipu-border bg-kipu-bg text-zinc-200 hover:border-zinc-500"
                  }`}
                >
                  <Check className="h-3.5 w-3.5" />
                  {t.tabAllowed}
                </button>
                <button
                  type="button"
                  aria-pressed={activeTab === "blocked"}
                  onClick={() => applyTab("blocked")}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold transition ${
                    activeTab === "blocked"
                      ? "border-kipu-crimson bg-kipu-crimson/20 text-red-100"
                      : "border-kipu-border bg-kipu-bg text-zinc-200 hover:border-zinc-500"
                  }`}
                >
                  <X className="h-3.5 w-3.5" />
                  {t.tabBlocked}
                </button>
                <button
                  type="button"
                  aria-pressed={activeTab === "freeze"}
                  onClick={() => applyTab("freeze")}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold transition ${
                    activeTab === "freeze"
                      ? "border-sky-400 bg-sky-500/20 text-sky-100"
                      : "border-kipu-border bg-kipu-bg text-zinc-200 hover:border-zinc-500"
                  }`}
                >
                  <Snowflake className="h-3.5 w-3.5 text-sky-300" />
                  {t.tabFreeze}
                </button>
              </div>

              <button
                type="button"
                onClick={launchCompromisedAttack}
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border border-kipu-crimson/70 bg-kipu-crimson/20 px-4 py-2 text-xs font-semibold text-red-100 transition hover:bg-kipu-crimson/30"
              >
                <Zap className="h-3.5 w-3.5 text-kipu-crimson" />
                {t.attackBtn}
              </button>

              <div className="mb-3 space-y-2.5 rounded-xl border border-kipu-border bg-kipu-bg p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-200">
                    {t.amountLabel}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {[5, 15, 150].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          if (frozen) setFrozen(false);
                          handleAmountChange(preset);
                        }}
                        className={`rounded border px-2 py-0.5 font-mono text-xs font-medium transition ${
                          amount === preset && !frozen
                            ? "border-kipu-gold bg-kipu-gold/20 text-amber-200"
                            : "border-zinc-700 bg-kipu-card text-zinc-200 hover:border-zinc-500"
                        }`}
                      >
                        {preset} Mock USDC
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={1}
                    max={200}
                    value={amount}
                    aria-label="Monto en Mock USDC"
                    onChange={(e) => {
                      if (frozen) setFrozen(false);
                      handleAmountChange(Number(e.target.value));
                    }}
                    className="h-1.5 flex-1 cursor-pointer accent-kipu-gold"
                  />
                  <span className="w-28 text-right font-mono text-xs font-semibold text-white">
                    {amount.toFixed(0)} Mock USDC
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (frozen) setFrozen(false);
                      handleRecipientChange("allowlist");
                    }}
                    className={`rounded-lg border px-2.5 py-2 text-left text-xs transition ${
                      recipientKind === "allowlist" && !frozen
                        ? "border-kipu-emerald/60 bg-kipu-emerald/15 text-emerald-100"
                        : "border-kipu-border bg-kipu-card text-zinc-200 hover:border-zinc-600"
                    }`}
                  >
                    <span className="block font-semibold">
                      {t.destAllowedTitle}
                    </span>
                    <span className="font-mono text-xs opacity-90">
                      {truncateMiddle(FRONTEND_CONFIG.demoRecipient, 4, 4)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (frozen) setFrozen(false);
                      handleRecipientChange("attacker");
                    }}
                    className={`rounded-lg border px-2.5 py-2 text-left text-xs transition ${
                      recipientKind === "attacker" && !frozen
                        ? "border-kipu-crimson/70 bg-kipu-crimson/15 text-red-100"
                        : "border-kipu-border bg-kipu-card text-zinc-200 hover:border-zinc-600"
                    }`}
                  >
                    <span className="block font-semibold">
                      {t.destAttackTitle}
                    </span>
                    <span className="font-mono text-xs opacity-90">
                      {t.destAttackSub}
                    </span>
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                <div
                  className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 transition-all duration-200 ${
                    phase === "proposing"
                      ? "border-kipu-gold bg-kipu-gold/10"
                      : "border-kipu-border bg-kipu-bg"
                  } ${frozen ? "opacity-60" : ""}`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-kipu-border bg-kipu-card text-kipu-gold">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-300">{t.step1}</p>
                      <p className="font-display text-lg font-bold tracking-tight text-white">
                        {amount.toFixed(2)}{" "}
                        <span className="font-mono text-xs font-medium text-zinc-200">
                          Mock USDC → {destinationAddress}
                        </span>
                      </p>
                    </div>
                  </div>
                  <ArrowRight
                    className={`h-4 w-4 shrink-0 ${
                      frozen
                        ? "text-sky-300"
                        : isAllowed
                          ? "kipu-travel-dot text-kipu-emerald"
                          : "kipu-travel-dot text-kipu-crimson"
                    }`}
                  />
                </div>

                <div
                  className={`rounded-xl border px-3.5 py-2.5 transition-all duration-200 ${
                    phase === "validating"
                      ? "border-kipu-gold bg-kipu-gold/15"
                      : "border-kipu-gold/40 bg-kipu-gold/[0.06]"
                  }`}
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-amber-200">
                    <span className="inline-flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 shrink-0 text-kipu-gold" />
                      {t.step2}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-zinc-200">
                      {frozen ? "FREEZE" : "ANCHOR LOGIC"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-xs font-medium">
                    <span
                      className={`rounded border px-1.5 py-1 text-center ${
                        passLimit
                          ? "border-kipu-emerald/50 bg-kipu-emerald/15 text-emerald-200"
                          : "border-kipu-crimson bg-kipu-crimson/20 text-red-200"
                      }`}
                    >
                      {passLimit ? "✓" : "✕"} ≤ {MAX_PER_TX} Mock USDC
                    </span>
                    <span
                      className={`rounded border px-1.5 py-1 text-center ${
                        passDaily
                          ? "border-kipu-emerald/50 bg-kipu-emerald/15 text-emerald-200"
                          : "border-kipu-crimson bg-kipu-crimson/20 text-red-200"
                      }`}
                    >
                      {passDaily ? "✓" : "✕"} 24h ≤ {DAILY_LIMIT}
                    </span>
                    <span
                      className={`rounded border px-1.5 py-1 text-center ${
                        passAllowlist
                          ? "border-kipu-emerald/50 bg-kipu-emerald/15 text-emerald-200"
                          : "border-kipu-crimson bg-kipu-crimson/20 text-red-200"
                      }`}
                    >
                      {passAllowlist ? "✓" : "✕"} Allowlist
                    </span>
                  </div>
                </div>

                <div
                  className={`rounded-xl border px-3.5 py-3 transition-all duration-200 ${
                    frozen
                      ? "border-sky-400/70 bg-sky-500/15 text-sky-100"
                      : isAllowed
                        ? "border-kipu-emerald/60 bg-kipu-emerald/15 text-emerald-100"
                        : "border-kipu-crimson bg-kipu-crimson/20 text-red-100"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      {frozen ? (
                        <Snowflake className="mt-0.5 h-5 w-5 shrink-0 text-sky-300" />
                      ) : isAllowed ? (
                        <Check className="mt-0.5 h-5 w-5 shrink-0 text-kipu-emerald" />
                      ) : (
                        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-kipu-crimson" />
                      )}
                      <div>
                        <p className="font-display text-xs font-bold tracking-wide text-white">
                          {t.step3Prefix}
                          {outcomeTitle}
                        </p>
                        <p className="mt-0.5 text-xs leading-snug text-zinc-100">
                          {outcomeReason}
                        </p>
                      </div>
                    </div>

                    {frozen && (
                      <button
                        type="button"
                        onClick={() => {
                          setFrozen(false);
                          triggerBriefFlow();
                        }}
                        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-kipu-emerald/60 bg-kipu-emerald/20 px-2.5 py-1 text-xs font-semibold text-emerald-200 hover:bg-kipu-emerald/30"
                      >
                        <RotateCcw className="h-3 w-3" />
                        {t.unfreezeBtn}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <p className="mt-3 text-center text-xs text-zinc-200">
                {t.simFooterA}{" "}
                <span className="font-semibold text-kipu-gold">
                  {t.simFooterB}
                </span>
              </p>
            </div>
          </div>
        </section>

        {/* Architecture Diagram: Dueño -> Bóveda (PDA) -> Agente -> Destino */}
        <section
          id="how-it-works"
          className="space-y-4 border-t border-kipu-border pt-8"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight text-white">
                {t.howTitle}
              </h2>
              <p className="mt-1 text-sm text-zinc-200">{t.howSub}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {t.howNodes.map((node, idx) => {
              const Icon =
                idx === 0
                  ? KeyRound
                  : idx === 1
                    ? Lock
                    : idx === 2
                      ? Bot
                      : Users;
              return (
                <div
                  key={node.num}
                  className="kipu-card-glow flex flex-col justify-between rounded-xl border border-kipu-border p-4"
                >
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-kipu-gold/35 bg-kipu-gold/10 text-kipu-gold">
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="font-mono text-xs font-semibold text-zinc-300">
                        {node.num}
                      </span>
                    </div>
                    <h3 className="font-display text-sm font-bold text-white">
                      {node.title}
                    </h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-zinc-200">
                      {node.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Brand story (Quipu) + Developer Integration Snippet */}
        <section className="grid gap-4 lg:grid-cols-12">
          <div className="kipu-card-glow flex min-w-0 flex-col justify-between rounded-xl border border-kipu-gold/35 p-5 lg:col-span-5">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-kipu-gold/40 bg-kipu-gold/10 px-2.5 py-0.5 text-xs font-semibold text-amber-200">
                <FileSearch className="h-3.5 w-3.5" />
                Quipu + SHA-256
              </span>
              <h2 className="mt-3 font-display text-xl font-bold text-white">
                {t.quipuTitle}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-200">
                {t.quipuBody}
              </p>
            </div>
            <div className="mt-4 border-t border-kipu-border pt-3 text-xs text-zinc-300">
              Audit Event: <code className="text-kipu-gold">KipuAuditEvent</code>{" "}
              · Anchor PDA + SHA-256
            </div>
          </div>

          <div className="kipu-card-glow min-w-0 rounded-xl border border-kipu-border p-5 lg:col-span-7">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-kipu-gold" />
                <h2 className="font-display text-base font-bold text-white">
                  {t.devTitle}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => void handleCopySnippet()}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-kipu-bg px-2.5 py-1 text-xs font-medium text-zinc-200 hover:border-kipu-gold hover:text-kipu-gold"
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? t.copiedBtn : t.copyBtn}
              </button>
            </div>
            <p className="mb-3 text-xs text-zinc-200">{t.devSub}</p>
            <pre className="w-full max-w-full overflow-x-auto rounded-lg border border-kipu-border bg-kipu-bg p-3 font-mono text-xs leading-relaxed text-emerald-200">
              <code>{CODE_SNIPPET}</code>
            </pre>
          </div>
        </section>

        {/* Why not multisig or normal wallet + Use Cases */}
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-bold text-white">
            {t.compareTitle}
          </h2>
          <div className="overflow-x-auto rounded-xl border border-kipu-border bg-kipu-card">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-kipu-border bg-kipu-bg/60 text-zinc-200">
                  {t.compareCols.map((col, i) => (
                    <th
                      key={col}
                      className={`px-4 py-3 font-semibold ${
                        i === 3 ? "text-kipu-gold" : ""
                      }`}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-kipu-border/70">
                {t.compareRows.map((row) => (
                  <tr key={row[0]}>
                    <td className="px-4 py-3 font-semibold text-white">
                      {row[0]}
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{row[1]}</td>
                    <td className="px-4 py-3 text-zinc-300">{row[2]}</td>
                    <td className="px-4 py-3 font-medium text-emerald-200">
                      {row[3]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="pt-2 font-display text-lg font-bold text-white">
            {t.useCasesTitle}
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {t.useCases.map((uc) => (
              <div
                key={uc.title}
                className="rounded-xl border border-kipu-border bg-kipu-card p-4"
              >
                <div className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-md bg-kipu-gold/15 text-kipu-gold">
                  <Terminal className="h-3.5 w-3.5" />
                </div>
                <h4 className="font-display text-sm font-bold text-white">
                  {uc.title}
                </h4>
                <p className="mt-1 text-xs leading-relaxed text-zinc-200">
                  {uc.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Honest Limits + FAQ + Roadmap */}
        <section
          id="limits-faq"
          className="space-y-6 border-t border-kipu-border pt-8"
        >
          <div className="rounded-xl border border-amber-500/45 bg-amber-500/10 px-4 py-3 text-xs text-amber-100 sm:text-sm">
            <span className="inline-flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0 text-kipu-gold" />
              {t.honestWarning}
            </span>
          </div>

          <div>
            <h2 className="mb-3 font-display text-2xl font-bold text-white">
              {t.honestTitle}
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-kipu-emerald/40 bg-kipu-card p-4">
                <h3 className="mb-2 font-display text-sm font-bold text-emerald-300">
                  {t.protectsTitle}
                </h3>
                <ul className="list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-zinc-200">
                  {t.protectsList.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-kipu-border bg-kipu-card p-4">
                <h3 className="mb-2 font-display text-sm font-bold text-amber-200">
                  {t.limitsTitle}
                </h3>
                <ul className="list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-zinc-200">
                  {t.limitsList.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* FAQ & Roadmap */}
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="space-y-3 lg:col-span-7">
              <h3 className="inline-flex items-center gap-2 font-display text-lg font-bold text-white">
                <HelpCircle className="h-4 w-4 text-kipu-gold" />
                {t.faqTitle}
              </h3>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {t.faqs.map((faq) => (
                  <div
                    key={faq.q}
                    className="rounded-xl border border-kipu-border bg-kipu-card p-3.5"
                  >
                    <p className="text-xs font-bold text-white">{faq.q}</p>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-200">
                      {faq.a}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 lg:col-span-5">
              <h3 className="inline-flex items-center gap-2 font-display text-lg font-bold text-white">
                <Milestone className="h-4 w-4 text-kipu-gold" />
                {t.roadmapTitle}
              </h3>
              <div className="space-y-2.5">
                {t.roadmap.map((r) => (
                  <div
                    key={r.phase}
                    className="rounded-xl border border-kipu-border bg-kipu-card p-3.5"
                  >
                    <p className="font-mono text-xs font-semibold text-kipu-gold">
                      {r.phase}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-200">
                      {r.items}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-kipu-border pt-6 text-xs text-zinc-200">
          <div className="flex flex-wrap items-center gap-3">
            <span>{t.footerLeft}</span>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-kipu-gold hover:underline"
            >
              <GitRepoIcon className="h-3.5 w-3.5" />
              luchitogeek22/kipu-vault
            </a>
          </div>
          <span className="font-mono text-xs text-zinc-300">
            {t.footerRight}
          </span>
        </footer>
      </main>
    </div>
  );
}
