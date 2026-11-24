"""Tests for SIWS Ed25519 authentication, single-use nonces, and owner checks."""

from __future__ import annotations

import base58
from solders.keypair import Keypair


def _sign_message(kp: Keypair, message: str) -> str:
    sig = kp.sign_message(message.encode("utf-8"))
    return base58.b58encode(bytes(sig)).decode("ascii")


def test_siws_valid_and_nonce_cannot_be_reused(make_test_app, keypairs) -> None:
    client, _, _, _ = make_test_app()
    owner_kp = keypairs["owner"]
    owner_pub = str(owner_kp.pubkey())
    vault_pub = str(keypairs["vault"].pubkey())

    nonce_resp = client.get(f"/api/auth/nonce?wallet={owner_pub}")
    assert nonce_resp.status_code == 200
    nonce_data = nonce_resp.json()

    signature = _sign_message(owner_kp, nonce_data["message"])
    verify_resp = client.post(
        "/api/auth/verify",
        json={
            "wallet": owner_pub,
            "vault_address": vault_pub,
            "nonce": nonce_data["nonce"],
            "signature": signature,
        },
    )
    assert verify_resp.status_code == 200
    body = verify_resp.json()
    assert body["token_type"] == "bearer"
    assert body["wallet"] == owner_pub
    assert body["access_token"]

    # Reusing the same nonce must fail with 401
    replay_resp = client.post(
        "/api/auth/verify",
        json={
            "wallet": owner_pub,
            "vault_address": vault_pub,
            "nonce": nonce_data["nonce"],
            "signature": signature,
        },
    )
    assert replay_resp.status_code == 401


def test_siws_invalid_signature_rejected(make_test_app, keypairs) -> None:
    client, _, _, _ = make_test_app()
    owner_pub = str(keypairs["owner"].pubkey())
    attacker_kp = keypairs["attacker"]
    vault_pub = str(keypairs["vault"].pubkey())

    nonce_resp = client.get(f"/api/auth/nonce?wallet={owner_pub}")
    assert nonce_resp.status_code == 200
    nonce_data = nonce_resp.json()

    bad_sig = _sign_message(attacker_kp, nonce_data["message"])
    verify_resp = client.post(
        "/api/auth/verify",
        json={
            "wallet": owner_pub,
            "vault_address": vault_pub,
            "nonce": nonce_data["nonce"],
            "signature": bad_sig,
        },
    )
    assert verify_resp.status_code == 401


def test_siws_non_owner_wallet_rejected_403(make_test_app, keypairs) -> None:
    client, _, _, _ = make_test_app()
    attacker_kp = keypairs["attacker"]
    attacker_pub = str(attacker_kp.pubkey())
    vault_pub = str(keypairs["vault"].pubkey())

    nonce_resp = client.get(f"/api/auth/nonce?wallet={attacker_pub}")
    assert nonce_resp.status_code == 200
    nonce_data = nonce_resp.json()

    sig = _sign_message(attacker_kp, nonce_data["message"])
    verify_resp = client.post(
        "/api/auth/verify",
        json={
            "wallet": attacker_pub,
            "vault_address": vault_pub,
            "nonce": nonce_data["nonce"],
            "signature": sig,
        },
    )
    assert verify_resp.status_code == 403
