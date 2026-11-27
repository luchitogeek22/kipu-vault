"use client";

export type ExperienceLevel = "beginner" | "intermediate" | "advanced";

export const UX_STORAGE_KEYS = {
  welcomeDismissed: "kipu_ux_welcome_dismissed_v1",
  wizardDismissed: "kipu_ux_wizard_dismissed_v1",
  tourCompleted: "kipu_ux_tour_completed_v1",
  tourNeverAuto: "kipu_ux_tour_never_auto_v1",
  experienceLevel: "kipu_ux_experience_level_v1",
} as const;

export function readStorageFlag(key: string, fallback = false): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const val = window.localStorage.getItem(key);
    if (val === "true") return true;
    if (val === "false") return false;
    return fallback;
  } catch {
    return fallback;
  }
}

export function writeStorageFlag(key: string, value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value ? "true" : "false");
  } catch {
    // ignore storage quota / privacy mode failures
  }
}

export function readExperienceLevel(): ExperienceLevel {
  if (typeof window === "undefined") return "beginner";
  try {
    const raw = window.localStorage.getItem(UX_STORAGE_KEYS.experienceLevel);
    if (raw === "beginner" || raw === "intermediate" || raw === "advanced") {
      return raw;
    }
    return "beginner";
  } catch {
    return "beginner";
  }
}

export function writeExperienceLevel(level: ExperienceLevel): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(UX_STORAGE_KEYS.experienceLevel, level);
  } catch {
    // ignore
  }
}

export const EXPERIENCE_LEVEL_META: Record<
  ExperienceLevel,
  { label: string; shortDesc: string }
> = {
  beginner: {
    label: "Principiante",
    shortDesc: "Explicaciones sencillas, ejemplos guiados y tutorial.",
  },
  intermediate: {
    label: "Intermedio",
    shortDesc: "Acceso directo a políticas, copiloto y simulaciones.",
  },
  advanced: {
    label: "Avanzado",
    shortDesc: "Vista técnica compacta: hashes, firmas y logs sin guías.",
  },
};

export interface TourStepDef {
  id: string;
  target: string;
  title: string;
  description: string;
}

export const PRODUCT_TOUR_STEPS: TourStepDef[] = [
  {
    id: "copilot-examples",
    target: "copilot-examples",
    title: "1. VERIFICACIÓN ANTES DE EJECUTAR",
    description:
      "Tu agente de IA propone pagos. KipuVault los verifica en Solana antes de ejecutarlos.",
  },
  {
    id: "demo-safe",
    target: "demo-safe",
    title: "2. PRUEBA SEGURA",
    description:
      "Prueba una operación válida: 5 USDC a una wallet autorizada.",
  },
  {
    id: "demo-redteam",
    target: "demo-redteam",
    title: "3. SIMULA UN AGENTE HACKEADO",
    description:
      "Ahora simula un agente hackeado: 150 USDC o una wallet desconocida. Mira cómo se bloquea.",
  },
  {
    id: "demo-freeze",
    target: "demo-freeze",
    title: "4. EMERGENCY FREEZE",
    description:
      "Si algo sale mal, un clic congela al agente on-chain.",
  },
];

export interface GlossaryItem {
  id: string;
  question: string;
  answer: string;
  example: string;
}

export const HELP_GLOSSARY: GlossaryItem[] = [
  {
    id: "what-is-kipuvault",
    question: "¿Qué es KipuVault?",
    answer:
      "Es una capa de seguridad en Solana que permite a un agente de IA hacer pagos automáticos solo dentro de las reglas que tú fijas.",
    example:
      "Ejemplo: tu agente puede pagar 5 USDC por revisiones, pero nunca vaciar tus 100 USDC ni enviarlos a desconocidos.",
  },
  {
    id: "what-is-vault",
    question: "¿Qué es una bóveda?",
    answer:
      "Es una cuenta inteligente controlada por el programa KipuVault donde depositas fondos separados de tu wallet principal.",
    example:
      "Ejemplo: guardas 80 Mock USDC en tu bóveda; tú sigues siendo el único propietario con permiso para retirar todo cuando quieras.",
  },
  {
    id: "what-is-agent",
    question: "¿Qué es un agente autónomo?",
    answer:
      "Es un asistente de software con una llave operativa que propone y firma pagos dentro de tus topes, sin poder cambiar tus reglas ni retirar tus fondos.",
    example:
      "Ejemplo: el agente solo paga comisiones de red (SOL) y ejecuta pagos aprobados por el contrato inteligente.",
  },
  {
    id: "what-is-allowlist",
    question: "¿Qué es una allowlist?",
    answer:
      "Es una lista blanca de hasta 8 direcciones autorizadas por ti en la blockchain. Ningún pago puede salir hacia una dirección fuera de esa lista.",
    example:
      "Ejemplo: si agregas a tu proveedor (3kx3s1...), un ataque que intente desviar dinero a otra wallet será rechazado en Solana.",
  },
  {
    id: "what-is-daily-limit",
    question: "¿Qué significa límite diario?",
    answer:
      "Es el monto máximo acumulado que el agente puede gastar dentro de una ventana fija de 24 horas en reloj de Solana.",
    example:
      "Ejemplo: con límite diario de 50 USDC y tope de 10 USDC por operación, aunque el agente intente hacer 10 pagos de 10 USDC, al sexto se bloquea.",
  },
  {
    id: "what-is-blocked-tx",
    question: "¿Qué significa transacción bloqueada?",
    answer:
      "Significa que KipuVault detuvo un pago porque rompía una política (tope, allowlist o bóveda congelada). Tus fondos permanecieron intactos.",
    example:
      "Ejemplo: BLOCKED_ONCHAIN indica que el contrato en Solana rechazó la orden; BLOCKED_PREFLIGHT que se detuvo antes de enviarse.",
  },
  {
    id: "what-is-signature",
    question: "¿Qué es una firma de transacción?",
    answer:
      "Es tu aprobación criptográfica desde Phantom (o el hash único tx signature que identifica una operación registrada en Solana).",
    example:
      "Ejemplo: cuando pulsas Confirmar en Phantom autorizas cambiar límites; cuando el agente ejecuta un pago, Solana genera un ID verificable.",
  },
  {
    id: "what-is-onchain",
    question: "¿Qué significa On-Chain?",
    answer:
      "Significa que las reglas viven y se hacen cumplir directamente dentro del contrato inteligente en Solana, no solo en una base de datos web.",
    example:
      "Ejemplo: incluso si alguien atacara el servidor web, no podría saltarse tu allowlist ni tu límite diario en Solana.",
  },
  {
    id: "how-to-verify",
    question: "¿Cómo verificar una operación?",
    answer:
      "En el Audit Ledger pulsa «Verificar integridad». KipuVault compara el registro SHA-256 guardado contra los datos reales almacenados en Solana.",
    example:
      "Ejemplo: verás ambos hashes en verde y el enlace directo a Solana Explorer para inspeccionar la transacción pública.",
  },
];

export function humanizeUiError(rawMessage: string): string {
  const lower = rawMessage.toLowerCase();
  if (lower.includes("rejected") || lower.includes("cancel")) {
    return "Operación cancelada en tu wallet Phantom. No se realizó ningún cambio.";
  }
  if (lower.includes("expirada") || lower.includes("401")) {
    return "Tu sesión de seguridad (SIWS) expiró. Pulsa «Iniciar sesión» arriba y firma nuevamente para continuar.";
  }
  if (lower.includes("429")) {
    return "La red de pruebas (Solana Devnet) recibió demasiadas solicitudes. Espera unos segundos e inténtalo otra vez.";
  }
  if (lower.includes("insufficient") && lower.includes("sol")) {
    return "No hay suficiente SOL de Devnet para pagar la comisión de red. Recarga desde faucet.solana.com.";
  }
  return rawMessage;
}
