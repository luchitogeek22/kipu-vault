"""Tests for public GET /api/audit/verify/{tx_signature} tamper detection."""

from __future__ import annotations

from app.services.canonical import build_canonical_evidence
from app.services.solana_vault import OnChainTxInspection


async def test_verify_detects_tampered_canonical_json(make_test_app, keypairs) -> None:
    client, repo, fake_solana, _ = make_test_app()
    vault_pub = str(keypairs["vault"].pubkey())
    owner_pub = str(keypairs["owner"].pubkey())
    agent_pub = str(keypairs["agent"].pubkey())
    mint_pub = str(keypairs["mint"].pubkey())
    recipient_pub = str(keypairs["recipient"].pubkey())

    ev = build_canonical_evidence(
        vault_address=vault_pub,
        owner=owner_pub,
        agent=agent_pub,
        mint=mint_pub,
        prompt="Paga 5 USDC",
        recipient_address=recipient_pub,
        amount_base_units=5_000_000,
        amount_usdc="5.000000",
        reasoning="ok",
        risk_score=10,
        risk_flags=[],
        mode="standard",
        nonce="00000000-0000-4000-8000-000000000010",
        timestamp_utc="2026-11-24T05:00:00Z",
    )

    sig_valid = "5ValidTxSig1111111111111111111111111111111111111111111111111"
    await repo.insert_audit_log(
        nonce="00000000-0000-4000-8000-000000000010",
        vault_address=vault_pub,
        owner_wallet=owner_pub,
        mode="standard",
        status="EXECUTED",
        canonical_json=ev.canonical_json,
        decision_hash=ev.decision_hash_hex,
        recipient_address=recipient_pub,
        amount_base_units="5000000",
        tx_signature=sig_valid,
    )

    sig_tampered = "5TamperedSig111111111111111111111111111111111111111111111111"
    tampered_json = ev.canonical_json.replace('"5000000"', '"9000000"')
    await repo.insert_audit_log(
        nonce="00000000-0000-4000-8000-000000000011",
        vault_address=vault_pub,
        owner_wallet=owner_pub,
        mode="standard",
        status="EXECUTED",
        canonical_json=tampered_json,
        decision_hash=ev.decision_hash_hex,
        recipient_address=recipient_pub,
        amount_base_units="5000000",
        tx_signature=sig_tampered,
    )

    fake_solana.inspections = {
        sig_valid: OnChainTxInspection(
            onchain_hash=ev.decision_hash_hex,
            amount_base_units=5_000_000,
            vault_address=vault_pub,
            tx_succeeded=True,
            tx_error_name=None,
            event_hash=ev.decision_hash_hex,
            event_amount=5_000_000,
        ),
        sig_tampered: OnChainTxInspection(
            onchain_hash=ev.decision_hash_hex,
            amount_base_units=5_000_000,
            vault_address=vault_pub,
            tx_succeeded=True,
            tx_error_name=None,
        ),
    }

    ok_resp = client.get(f"/api/audit/verify/{sig_valid}")
    assert ok_resp.status_code == 200
    assert ok_resp.json()["verified"] is True

    bad_resp = client.get(f"/api/audit/verify/{sig_tampered}")
    assert bad_resp.status_code == 200
    bad_body = bad_resp.json()
    assert bad_body["verified"] is False
    assert bad_body["offchain_hash"] != bad_body["onchain_hash"]


async def test_verify_blocked_onchain_returns_verified_true_and_tx_succeeded_false(
    make_test_app, keypairs
) -> None:
    client, repo, fake_solana, _ = make_test_app()
    vault_pub = str(keypairs["vault"].pubkey())
    owner_pub = str(keypairs["owner"].pubkey())
    agent_pub = str(keypairs["agent"].pubkey())
    mint_pub = str(keypairs["mint"].pubkey())
    recipient_pub = str(keypairs["recipient"].pubkey())

    ev = build_canonical_evidence(
        vault_address=vault_pub,
        owner=owner_pub,
        agent=agent_pub,
        mint=mint_pub,
        prompt="Red team 150",
        recipient_address=recipient_pub,
        amount_base_units=150_000_000,
        amount_usdc="150.000000",
        reasoning="red team",
        risk_score=100,
        risk_flags=["instruction_override"],
        mode="red_team",
        nonce="00000000-0000-4000-8000-000000000012",
        timestamp_utc="2026-11-24T05:00:00Z",
    )
    sig_blocked = "5BlockedOnchain1111111111111111111111111111111111111111111"
    await repo.insert_audit_log(
        nonce="00000000-0000-4000-8000-000000000012",
        vault_address=vault_pub,
        owner_wallet=owner_pub,
        mode="red_team",
        status="BLOCKED_ONCHAIN",
        canonical_json=ev.canonical_json,
        decision_hash=ev.decision_hash_hex,
        recipient_address=recipient_pub,
        amount_base_units="150000000",
        tx_signature=sig_blocked,
        error_code=6003,
        error_name="ExceedsTransactionLimit",
    )

    fake_solana.inspections = {
        sig_blocked: OnChainTxInspection(
            onchain_hash=ev.decision_hash_hex,
            amount_base_units=150_000_000,
            vault_address=vault_pub,
            tx_succeeded=False,
            tx_error_name="ExceedsTransactionLimit",
        )
    }

    resp = client.get(f"/api/audit/verify/{sig_blocked}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["verified"] is True
    assert body["tx_succeeded"] is False
    assert body["tx_error_name"] == "ExceedsTransactionLimit"
