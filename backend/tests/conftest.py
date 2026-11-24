"""Shared pytest fixtures using InMemoryAuditRepository, FakeLLMClient, and mocked Solana RPC."""

from __future__ import annotations

import json
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from solders.keypair import Keypair

from app.api.deps import (
    get_idl_registry,
    get_llm_client,
    get_repository,
    get_solana_client,
)
from app.core.config import Settings, get_settings
from app.core.idl import KipuIdlRegistry
from app.main import create_app
from app.services.llm import FakeLLMClient
from app.services.solana_vault import (
    OnChainTxInspection,
    SimulationOutcome,
    TxSendOutcome,
    VaultStateOnChain,
)
from app.services.supabase_repo import InMemoryAuditRepository


@dataclass
class FakeSolanaClient:
    """Offline mock implementing the SolanaVaultClient surface used by FastAPI handlers."""

    vault_address: str
    vault_state: VaultStateOnChain
    idl_registry: KipuIdlRegistry
    recipient_has_history: bool = True
    sol_balance: Decimal = Decimal("1.500000")
    agent_pub: str = ""
    sim_outcome: SimulationOutcome | None = None
    send_outcome: TxSendOutcome | None = None
    inspections: dict[str, OnChainTxInspection] | None = None

    def agent_pubkey(self) -> str | None:
        return self.agent_pub or self.vault_state.agent

    async def fetch_vault_state(self, vault_address: str) -> VaultStateOnChain:
        if vault_address != self.vault_address:
            raise ValueError(f"Vault account {vault_address} not found on-chain")
        return self.vault_state

    async def has_recipient_history(self, recipient_address: str) -> bool:
        return self.recipient_has_history

    async def get_agent_sol_balance(self) -> Decimal | None:
        return self.sol_balance

    async def build_signed_agent_execute_tx(
        self,
        *,
        vault_address: str,
        vault_state: VaultStateOnChain,
        recipient_address: str,
        amount_base_units: int,
        decision_hash_bytes: bytes,
    ) -> str:
        return "ZmFrZS1zaWduZWQtdHg="

    async def simulate_transaction(self, tx_b64: str) -> SimulationOutcome:
        if self.sim_outcome is not None:
            return self.sim_outcome
        return SimulationOutcome(
            ok=True, error_code=None, error_name=None, logs=[], is_program_error=False
        )

    async def send_and_confirm_transaction(
        self, tx_b64: str, *, skip_preflight: bool
    ) -> TxSendOutcome:
        if self.send_outcome is not None:
            return self.send_outcome
        return TxSendOutcome(
            tx_signature="5MockSig1111111111111111111111111111111111111111111111111111",
            succeeded=True,
            error_code=None,
            error_name=None,
            logs=[],
        )

    async def fetch_agent_execute_from_tx(
        self, tx_signature: str
    ) -> OnChainTxInspection | None:
        if self.inspections and tx_signature in self.inspections:
            return self.inspections[tx_signature]
        return None


def write_sample_idl(path: Path) -> Path:
    """Create a realistic Anchor IDL fixture matching SPEC.md §4.4 error codes."""
    errors = [
        {"code": 6000, "name": "UnauthorizedOwner", "msg": "Unauthorized owner"},
        {"code": 6001, "name": "UnauthorizedAgent", "msg": "Unauthorized agent"},
        {"code": 6002, "name": "VaultFrozen", "msg": "Vault is frozen"},
        {"code": 6003, "name": "ExceedsTransactionLimit", "msg": "Exceeds max_per_tx"},
        {"code": 6004, "name": "ExceedsDailyLimit", "msg": "Exceeds daily_limit"},
        {"code": 6005, "name": "InvalidPolicyConfig", "msg": "Invalid policy config"},
        {"code": 6006, "name": "InvalidAmount", "msg": "Invalid amount"},
        {"code": 6007, "name": "MathOverflow", "msg": "Math overflow"},
        {"code": 6008, "name": "RecipientNotAllowed", "msg": "Recipient not allowed"},
        {"code": 6009, "name": "RecipientListFull", "msg": "Recipient list full"},
        {"code": 6010, "name": "RecipientAlreadyExists", "msg": "Recipient already exists"},
        {"code": 6011, "name": "RecipientNotFound", "msg": "Recipient not found"},
        {"code": 6012, "name": "InvalidDecisionHash", "msg": "Invalid decision hash"},
        {"code": 6013, "name": "InvalidMint", "msg": "Invalid mint"},
    ]
    idl: dict[str, Any] = {
        "address": "KipuVau1t1111111111111111111111111111111111",
        "metadata": {"name": "kipu_vault", "version": "0.1.0", "spec": "0.1.0"},
        "instructions": [],
        "errors": errors,
    }
    path.write_text(json.dumps(idl), encoding="utf-8")
    return path


@pytest.fixture()
def idl_registry(tmp_path: Path) -> KipuIdlRegistry:
    idl_file = write_sample_idl(tmp_path / "kipu_vault.json")
    return KipuIdlRegistry(idl_file)


@pytest.fixture()
def keypairs() -> dict[str, Keypair]:
    return {
        "owner": Keypair(),
        "agent": Keypair(),
        "recipient": Keypair(),
        "attacker": Keypair(),
        "mint": Keypair(),
        "vault": Keypair(),
    }


@pytest.fixture()
def make_test_app(idl_registry: KipuIdlRegistry, keypairs: dict[str, Keypair]):
    def _builder(
        *,
        demo_mode: bool = True,
        llm: FakeLLMClient | None = None,
        sim_outcome: SimulationOutcome | None = None,
        send_outcome: TxSendOutcome | None = None,
    ) -> tuple[TestClient, InMemoryAuditRepository, FakeSolanaClient, Settings]:
        owner_pub = str(keypairs["owner"].pubkey())
        agent_pub = str(keypairs["agent"].pubkey())
        recipient_pub = str(keypairs["recipient"].pubkey())
        mint_pub = str(keypairs["mint"].pubkey())
        vault_pub = str(keypairs["vault"].pubkey())

        settings = Settings(
            jwt_secret="test-secret-with-at-least-32-characters-1234",
            kipu_demo_mode=demo_mode,
            llm_provider="fake",
            frontend_origin="http://localhost:3000",
            kipu_idl_path=str(idl_registry.idl_path),
        )
        repo = InMemoryAuditRepository()
        vault_state = VaultStateOnChain(
            owner=owner_pub,
            agent=agent_pub,
            mint=mint_pub,
            max_per_tx=10_000_000,
            daily_limit=50_000_000,
            spent_today=0,
            window_start=1_700_000_000,
            is_frozen=False,
            total_executions=0,
            allowed_recipients=[recipient_pub],
            recipient_count=1,
            bump=255,
        )
        fake_solana = FakeSolanaClient(
            vault_address=vault_pub,
            vault_state=vault_state,
            idl_registry=idl_registry,
            sim_outcome=sim_outcome,
            send_outcome=send_outcome,
        )
        fake_llm = llm or FakeLLMClient()

        app = create_app(settings)
        app.dependency_overrides[get_settings] = lambda: settings
        app.dependency_overrides[get_repository] = lambda: repo
        app.dependency_overrides[get_solana_client] = lambda: fake_solana
        app.dependency_overrides[get_llm_client] = lambda: fake_llm
        app.dependency_overrides[get_idl_registry] = lambda: idl_registry

        return TestClient(app), repo, fake_solana, settings

    return _builder
