"""Canonical evidence serialization, Decimal conversion, and SHA-256 verification."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Literal

TOKEN_SCALE = Decimal("1000000")
USDC_QUANT = Decimal("0.000001")
U64_MAX = (1 << 64) - 1


def parse_usdc_amount(raw: Any) -> tuple[Decimal, int]:
    """Validate and convert a USDC amount to exact 6-decimal Decimal and u64 base units.

    Explicitly rejects Python ``float`` and ``bool`` values to avoid binary rounding drift.
    """
    if isinstance(raw, float | bool):
        raise ValueError("float values are forbidden for monetary amounts; use string or Decimal")

    if isinstance(raw, Decimal):
        val = raw
    elif isinstance(raw, int | str):
        text = str(raw).strip()
        if not text:
            raise ValueError("amount_usdc cannot be empty")
        try:
            val = Decimal(text)
        except InvalidOperation as exc:
            raise ValueError(f"invalid decimal amount: {raw!r}") from exc
    else:
        raise ValueError(f"unsupported monetary type: {type(raw).__name__}")

    if not val.is_finite():
        raise ValueError("amount_usdc must be finite")
    if val <= 0:
        raise ValueError("amount_usdc must be strictly positive")

    exponent = val.as_tuple().exponent
    if not isinstance(exponent, int) or exponent < -6:
        raise ValueError("amount_usdc supports at most 6 decimal places")

    quantized = val.quantize(USDC_QUANT)
    base_units = int(quantized * TOKEN_SCALE)
    if base_units <= 0 or base_units > U64_MAX:
        raise ValueError("amount_base_units out of u64 range")
    return quantized, base_units


def format_base_units_as_usdc(base_units: int) -> str:
    """Format integer base units (u64) as a 6-decimal USDC string."""
    if base_units < 0:
        raise ValueError("base_units cannot be negative")
    return f"{(Decimal(base_units) / TOKEN_SCALE).quantize(USDC_QUANT):.6f}"


def serialize_canonical_json(payload: dict[str, Any]) -> str:
    """Serialize payload into exact deterministic UTF-8 canonical JSON."""
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha256_hex_from_text(text: str) -> str:
    """Compute lowercase SHA-256 hex digest from UTF-8 text without re-serializing."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


@dataclass(frozen=True, slots=True)
class CanonicalEvidence:
    """Canonical decision payload plus serialized JSON and SHA-256 digests."""

    payload: dict[str, Any]
    canonical_json: str
    decision_hash_hex: str
    decision_hash_bytes: bytes


def build_canonical_evidence(
    *,
    vault_address: str,
    owner: str,
    agent: str,
    mint: str,
    prompt: str,
    recipient_address: str,
    amount_base_units: int,
    amount_usdc: str,
    reasoning: str,
    risk_score: int,
    risk_flags: list[str],
    mode: Literal["standard", "red_team"],
    nonce: str,
    timestamp_utc: str | None = None,
) -> CanonicalEvidence:
    """Construct canonical audit evidence and compute its SHA-256 decision_hash."""
    ts = timestamp_utc or datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    payload: dict[str, Any] = {
        "schema_version": 1,
        "vault_address": vault_address,
        "owner": owner,
        "agent": agent,
        "mint": mint,
        "prompt": prompt,
        "recipient_address": recipient_address,
        "amount_base_units": str(amount_base_units),
        "amount_usdc": amount_usdc,
        "reasoning": reasoning,
        "risk_score": int(risk_score),
        "risk_flags": list(risk_flags),
        "mode": mode,
        "nonce": nonce,
        "timestamp_utc": ts,
    }
    canonical_json = serialize_canonical_json(payload)
    digest_hex = sha256_hex_from_text(canonical_json)
    return CanonicalEvidence(
        payload=payload,
        canonical_json=canonical_json,
        decision_hash_hex=digest_hex,
        decision_hash_bytes=bytes.fromhex(digest_hex),
    )


def verify_canonical_text(canonical_json: str) -> tuple[bool, str, dict[str, Any] | None]:
    """Hash stored canonical_json directly and verify canonical shape has not been altered."""
    offchain_hash = sha256_hex_from_text(canonical_json)
    try:
        parsed = json.loads(canonical_json)
    except json.JSONDecodeError:
        return False, offchain_hash, None
    if not isinstance(parsed, dict):
        return False, offchain_hash, None
    re_serialized = serialize_canonical_json(parsed)
    if re_serialized != canonical_json:
        return False, offchain_hash, None
    return True, offchain_hash, parsed
