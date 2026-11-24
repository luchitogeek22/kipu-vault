"""Tests for golden hash vector parity (Python vs JS/TS), float rejection, and canonical shape."""

from __future__ import annotations

import shutil
import subprocess
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.schemas.agent import ForcedIntent, ParsedIntent
from app.services.canonical import (
    build_canonical_evidence,
    parse_usdc_amount,
    verify_canonical_text,
)


def test_golden_vector_canonical_hash_exact() -> None:
    """Golden hash vector must stay deterministic across versions and languages."""
    evidence = build_canonical_evidence(
        vault_address="Vault11111111111111111111111111111111111111",
        owner="Owner11111111111111111111111111111111111111",
        agent="Agent11111111111111111111111111111111111111",
        mint="Mint111111111111111111111111111111111111111",
        prompt="Paga 5 USDC por revisión de código",
        recipient_address="Recip11111111111111111111111111111111111111",
        amount_base_units=5_000_000,
        amount_usdc="5.000000",
        reasoning="Pago estándar dentro del tope",
        risk_score=12,
        risk_flags=[],
        mode="standard",
        nonce="00000000-0000-4000-8000-000000000001",
        timestamp_utc="2026-11-24T05:00:00Z",
    )

    expected_json = (
        '{"agent":"Agent11111111111111111111111111111111111111",'
        '"amount_base_units":"5000000",'
        '"amount_usdc":"5.000000",'
        '"mint":"Mint111111111111111111111111111111111111111",'
        '"mode":"standard",'
        '"nonce":"00000000-0000-4000-8000-000000000001",'
        '"owner":"Owner11111111111111111111111111111111111111",'
        '"prompt":"Paga 5 USDC por revisión de código",'
        '"reasoning":"Pago estándar dentro del tope",'
        '"recipient_address":"Recip11111111111111111111111111111111111111",'
        '"risk_flags":[],'
        '"risk_score":12,'
        '"schema_version":1,'
        '"timestamp_utc":"2026-11-24T05:00:00Z",'
        '"vault_address":"Vault11111111111111111111111111111111111111"}'
    )
    assert evidence.canonical_json == expected_json
    assert (
        evidence.decision_hash_hex
        == "e90fbdbdf6bcdaa748e5d0f9e65a2b1cdb6972da0c25d9284857638c79a6deaa"
    )

    node_bin = shutil.which("node")
    if node_bin is not None:
        js_script = (
            "const crypto=require('crypto');"
            "const p=JSON.parse(process.argv[1]);"
            "const sorted=Object.fromEntries(Object.keys(p).sort().map(k=>[k,p[k]]));"
            "const s=JSON.stringify(sorted);"
            "console.log(crypto.createHash('sha256').update(s,'utf8').digest('hex'));"
        )
        proc = subprocess.run(  # noqa: S603
            [node_bin, "-e", js_script, evidence.canonical_json],
            check=True,
            capture_output=True,
            text=True,
        )
        assert proc.stdout.strip() == evidence.decision_hash_hex


def test_reject_float_amounts() -> None:
    """Float values must be rejected everywhere in monetary parsing and schemas."""
    with pytest.raises(ValueError, match="float"):
        parse_usdc_amount(5.5)

    with pytest.raises(ValueError, match="float"):
        parse_usdc_amount(True)

    with pytest.raises(ValidationError):
        ForcedIntent(
            recipient_address="Recip11111111111111111111111111111111111111",
            amount_usdc=5.5,  # type: ignore[arg-type]
        )

    with pytest.raises(ValidationError):
        ParsedIntent(
            action="transfer",
            recipient_address="Recip11111111111111111111111111111111111111",
            amount_usdc=1.25,  # type: ignore[arg-type]
            reasoning="test",
            risk_score=10,
            risk_flags=[],
        )

    quantized, base_units = parse_usdc_amount("5.123456")
    assert quantized == Decimal("5.123456")
    assert base_units == 5_123_456


def test_verify_canonical_text_detects_manipulation() -> None:
    """Any whitespace/key reordering or value tamper fails canonical verification."""
    ev = build_canonical_evidence(
        vault_address="Vault11111111111111111111111111111111111111",
        owner="Owner11111111111111111111111111111111111111",
        agent="Agent11111111111111111111111111111111111111",
        mint="Mint111111111111111111111111111111111111111",
        prompt="Pay 5",
        recipient_address="Recip11111111111111111111111111111111111111",
        amount_base_units=5_000_000,
        amount_usdc="5.000000",
        reasoning="ok",
        risk_score=5,
        risk_flags=[],
        mode="standard",
        nonce="00000000-0000-4000-8000-000000000002",
        timestamp_utc="2026-11-24T05:00:00Z",
    )
    ok, digest, payload = verify_canonical_text(ev.canonical_json)
    assert ok is True
    assert digest == ev.decision_hash_hex
    assert payload is not None

    non_canonical = ev.canonical_json.replace('":"', '": "')
    ok_bad, _, _ = verify_canonical_text(non_canonical)
    assert ok_bad is False
