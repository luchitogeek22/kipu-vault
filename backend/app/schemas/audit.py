"""Audit log and public verification schemas."""

from typing import Any, Literal

from pydantic import BaseModel

AuditStatus = Literal[
    "PENDING",
    "EXECUTED",
    "BLOCKED_ONCHAIN",
    "BLOCKED_PREFLIGHT",
    "REJECTED_BY_AI",
    "NEEDS_RECIPIENT_APPROVAL",
    "FAILED_INFRA",
]


class AuditLogEntry(BaseModel):
    """Audit log row exposed via GET /api/audit/list."""

    id: str
    nonce: str
    vault_address: str
    owner_wallet: str
    mode: Literal["standard", "red_team"]
    status: AuditStatus
    canonical_json: str
    decision_hash: str
    recipient_address: str | None = None
    amount_base_units: str | None = None
    tx_signature: str | None = None
    error_code: int | None = None
    error_name: str | None = None
    sim_logs: list[str] | None = None
    created_at: str
    updated_at: str


class AuditListResponse(BaseModel):
    """Paginated list of audit records for a vault."""

    items: list[AuditLogEntry]
    total: int


class AuditVerifyResponse(BaseModel):
    """Public verification response for GET /api/audit/verify/{tx_signature}."""

    verified: bool
    offchain_hash: str
    onchain_hash: str | None
    amount_match: bool
    vault_match: bool
    tx_succeeded: bool
    tx_error_name: str | None = None
    checked_at: str
    canonical_shape_valid: bool = True
    details: dict[str, Any] | None = None
