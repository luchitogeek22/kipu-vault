import { FRONTEND_CONFIG } from "./config";

export type AuditStatus =
  | "PENDING"
  | "EXECUTED"
  | "BLOCKED_ONCHAIN"
  | "BLOCKED_PREFLIGHT"
  | "REJECTED_BY_AI"
  | "NEEDS_RECIPIENT_APPROVAL"
  | "FAILED_INFRA";

export interface HealthResponse {
  status: string;
  agent_pubkey: string | null;
  agent_sol_balance: string | null;
  low_sol_warning: boolean;
  demo_mode: boolean;
  idl_loaded: boolean;
}

export interface NonceResponse {
  nonce: string;
  message: string;
  expires_at: string;
}

export interface VerifyResponse {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  wallet: string;
  vault_address: string;
}

export interface ExecuteIntentRequest {
  vault_address: string;
  prompt: string;
  mode: "standard" | "red_team";
  forced_intent?: {
    recipient_address: string;
    amount_usdc: string;
  };
}

export interface ExecuteIntentResponse {
  status: AuditStatus;
  audit_id: string;
  decision_hash: string;
  tx_signature: string | null;
  error_code: number | null;
  error_name: string | null;
  guardrail_triggered: boolean;
  explanation_es: string;
  risk_score: number;
  risk_flags: string[];
  recipient_address: string | null;
  amount_usdc: string | null;
}

export interface AuditLogEntry {
  id: string;
  nonce: string;
  vault_address: string;
  owner_wallet: string;
  mode: "standard" | "red_team";
  status: AuditStatus;
  canonical_json: string;
  decision_hash: string;
  recipient_address: string | null;
  amount_base_units: string | null;
  tx_signature: string | null;
  error_code: number | null;
  error_name: string | null;
  sim_logs: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface AuditListResponse {
  items: AuditLogEntry[];
  total: number;
}

export interface AuditVerifyResponse {
  verified: boolean;
  offchain_hash: string;
  onchain_hash: string | null;
  amount_match: boolean;
  vault_match: boolean;
  tx_succeeded: boolean;
  tx_error_name: string | null;
  checked_at: string;
  canonical_shape_valid: boolean;
  details?: Record<string, unknown> | null;
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit & { token?: string }
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (init?.token) {
    headers.set("Authorization", `Bearer ${init.token}`);
  }
  const resp = await fetch(`${FRONTEND_CONFIG.apiUrl}${path}`, {
    ...init,
    headers,
  });
  if (!resp.ok) {
    let detail = `HTTP ${resp.status}`;
    try {
      const errBody = (await resp.json()) as { detail?: string };
      if (errBody.detail) {
        detail = errBody.detail;
      }
    } catch {
      // keep default HTTP status message
    }
    throw new Error(detail);
  }
  return (await resp.json()) as T;
}

export function fetchHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/api/health");
}

export function requestSiwsNonce(wallet: string): Promise<NonceResponse> {
  return apiFetch<NonceResponse>(
    `/api/auth/nonce?wallet=${encodeURIComponent(wallet)}`
  );
}

export function verifySiwsSignature(payload: {
  wallet: string;
  vault_address: string;
  nonce: string;
  signature: string;
}): Promise<VerifyResponse> {
  return apiFetch<VerifyResponse>("/api/auth/verify", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function executeAgentIntent(
  payload: ExecuteIntentRequest,
  token: string
): Promise<ExecuteIntentResponse> {
  return apiFetch<ExecuteIntentResponse>("/api/agent/execute-intent", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export function listAuditLogs(
  vaultAddress: string,
  token: string
): Promise<AuditListResponse> {
  return apiFetch<AuditListResponse>(
    `/api/audit/list?vault_address=${encodeURIComponent(vaultAddress)}&limit=50`,
    { token }
  );
}

export function verifyAuditTx(
  txSignature: string
): Promise<AuditVerifyResponse> {
  return apiFetch<AuditVerifyResponse>(
    `/api/audit/verify/${encodeURIComponent(txSignature)}`
  );
}
