"""Agent intent parsing, request, and execution response schemas."""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.audit import AuditStatus
from app.services.canonical import parse_usdc_amount


def _validate_usdc_decimal_value(value: Any) -> Decimal | None:
    if value is None:
        return None
    quantized, _ = parse_usdc_amount(value)
    return quantized


class ParsedIntent(BaseModel):
    """Structured output returned by LLMClient.parse_intent."""

    action: Literal["transfer", "none"]
    recipient_address: str | None = None
    amount_usdc: Decimal | None = None
    reasoning: str = Field(min_length=1, max_length=1000)
    risk_score: int = Field(ge=0, le=100)
    risk_flags: list[str] = Field(default_factory=list)

    @field_validator("amount_usdc", mode="before")
    @classmethod
    def reject_float_amount(cls, value: Any) -> Decimal | None:
        return _validate_usdc_decimal_value(value)

    @model_validator(mode="after")
    def validate_transfer_fields(self) -> ParsedIntent:
        if self.action == "transfer":
            if not self.recipient_address:
                raise ValueError("recipient_address is required when action is 'transfer'")
            if self.amount_usdc is None:
                raise ValueError("amount_usdc is required when action is 'transfer'")
        return self


class ForcedIntent(BaseModel):
    """Simulated compromised intent allowed only when KIPU_DEMO_MODE=true."""

    recipient_address: str = Field(min_length=32, max_length=64)
    amount_usdc: Decimal

    @field_validator("amount_usdc", mode="before")
    @classmethod
    def reject_float_amount(cls, value: Any) -> Decimal:
        parsed = _validate_usdc_decimal_value(value)
        if parsed is None:
            raise ValueError("amount_usdc is required")
        return parsed


class ExecuteIntentRequest(BaseModel):
    """Request body for POST /api/agent/execute-intent."""

    vault_address: str = Field(min_length=32, max_length=64)
    prompt: str = Field(min_length=1, max_length=2000)
    mode: Literal["standard", "red_team"] = "standard"
    forced_intent: ForcedIntent | None = None


class ExecuteIntentResponse(BaseModel):
    """Structured response returned by POST /api/agent/execute-intent."""

    status: AuditStatus
    audit_id: str
    decision_hash: str
    tx_signature: str | None = None
    error_code: int | None = None
    error_name: str | None = None
    guardrail_triggered: bool
    explanation_es: str
    risk_score: int
    risk_flags: list[str]
    recipient_address: str | None = None
    amount_usdc: str | None = None
