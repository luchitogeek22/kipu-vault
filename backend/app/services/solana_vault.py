"""Solana RPC client for reading VaultState, executing agent_execute, and verifying txs."""

from __future__ import annotations

import asyncio
import base64
import binascii
import struct
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

import base58
import httpx
from solders.hash import Hash
from solders.instruction import AccountMeta, Instruction
from solders.keypair import Keypair
from solders.message import Message
from solders.pubkey import Pubkey
from solders.transaction import Transaction

from app.core.idl import KipuIdlRegistry, extract_custom_error_code

TOKEN_PROGRAM_ID = Pubkey.from_string("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
ASSOCIATED_TOKEN_PROGRAM_ID = Pubkey.from_string(
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
)
SYSTEM_PROGRAM_ID = Pubkey.from_string("11111111111111111111111111111111")
LAMPORTS_PER_SOL = Decimal("1000000000")

VAULT_STATE_DISCRIMINATOR = KipuIdlRegistry.account_discriminator("VaultState")
AGENT_EXECUTE_DISCRIMINATOR = KipuIdlRegistry.instruction_discriminator("agent_execute")
AUDIT_EVENT_DISCRIMINATOR = KipuIdlRegistry.event_discriminator("KipuAuditEvent")
VAULT_STATE_SIZE = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 8 + (32 * 8) + 1 + 1


@dataclass(frozen=True, slots=True)
class VaultStateOnChain:
    """Decoded on-chain KipuVault VaultState account."""

    owner: str
    agent: str
    mint: str
    max_per_tx: int
    daily_limit: int
    spent_today: int
    window_start: int
    is_frozen: bool
    total_executions: int
    allowed_recipients: list[str]
    recipient_count: int
    bump: int


@dataclass(frozen=True, slots=True)
class SimulationOutcome:
    """Result of simulateTransaction."""

    ok: bool
    error_code: int | None
    error_name: str | None
    logs: list[str]
    is_program_error: bool


@dataclass(frozen=True, slots=True)
class TxSendOutcome:
    """Result of sendTransaction + confirmation polling."""

    tx_signature: str | None
    succeeded: bool
    error_code: int | None
    error_name: str | None
    logs: list[str]
    infra_error: str | None = None


@dataclass(frozen=True, slots=True)
class OnChainTxInspection:
    """Decoded agent_execute instruction and status from getTransaction."""

    onchain_hash: str
    amount_base_units: int
    vault_address: str
    tx_succeeded: bool
    tx_error_name: str | None
    event_hash: str | None = None
    event_amount: int | None = None


def derive_associated_token_address(owner: Pubkey, mint: Pubkey) -> Pubkey:
    """Derive canonical classic SPL Associated Token Account address."""
    ata, _ = Pubkey.find_program_address(
        [bytes(owner), bytes(TOKEN_PROGRAM_ID), bytes(mint)],
        ASSOCIATED_TOKEN_PROGRAM_ID,
    )
    return ata


def decode_vault_state(raw_bytes: bytes) -> VaultStateOnChain:
    """Decode Anchor Borsh-serialized VaultState account bytes."""
    if len(raw_bytes) < VAULT_STATE_SIZE:
        raise ValueError(f"VaultState buffer too short: {len(raw_bytes)} < {VAULT_STATE_SIZE}")
    if raw_bytes[:8] != VAULT_STATE_DISCRIMINATOR:
        raise ValueError("Invalid VaultState account discriminator")

    offset = 8
    owner = str(Pubkey.from_bytes(raw_bytes[offset : offset + 32]))
    offset += 32
    agent = str(Pubkey.from_bytes(raw_bytes[offset : offset + 32]))
    offset += 32
    mint = str(Pubkey.from_bytes(raw_bytes[offset : offset + 32]))
    offset += 32

    max_per_tx, daily_limit, spent_today, window_start = struct.unpack_from(
        "<QQQq", raw_bytes, offset
    )
    offset += 32

    is_frozen = bool(raw_bytes[offset])
    offset += 1

    (total_executions,) = struct.unpack_from("<Q", raw_bytes, offset)
    offset += 8

    all_recipients: list[str] = []
    for _ in range(8):
        all_recipients.append(str(Pubkey.from_bytes(raw_bytes[offset : offset + 32])))
        offset += 32

    recipient_count = raw_bytes[offset]
    bump = raw_bytes[offset + 1]
    if recipient_count > 8:
        raise ValueError(f"Corrupt recipient_count in VaultState: {recipient_count}")

    return VaultStateOnChain(
        owner=owner,
        agent=agent,
        mint=mint,
        max_per_tx=int(max_per_tx),
        daily_limit=int(daily_limit),
        spent_today=int(spent_today),
        window_start=int(window_start),
        is_frozen=is_frozen,
        total_executions=int(total_executions),
        allowed_recipients=all_recipients[:recipient_count],
        recipient_count=int(recipient_count),
        bump=int(bump),
    )


def _decode_kipu_audit_event_from_logs(logs: list[str]) -> tuple[str, int] | None:
    """Best-effort decode of KipuAuditEvent (decision_hash hex, amount) from Program data logs."""
    prefix = "Program data: "
    for line in logs:
        if not line.startswith(prefix):
            continue
        b64_part = line[len(prefix) :].strip()
        try:
            raw = base64.b64decode(b64_part, validate=True)
        except (binascii.Error, ValueError):
            raw = b""
        # 8 disc + 32 vault + 32 agent + 32 dest + 8 amount + 32 hash + 8 ts = 152
        if len(raw) < 152 or raw[:8] != AUDIT_EVENT_DISCRIMINATOR:
            continue
        (amount,) = struct.unpack_from("<Q", raw, 8 + 32 + 32 + 32)
        decision_hash_hex = raw[8 + 32 + 32 + 32 + 8 : 8 + 32 + 32 + 32 + 8 + 32].hex()
        return decision_hash_hex, int(amount)
    return None


class SolanaVaultClient:
    """Async Solana JSON-RPC client for KipuVault operations."""

    def __init__(
        self,
        *,
        rpc_url: str,
        program_id: str,
        idl_registry: KipuIdlRegistry,
        agent_keypair_b58: str = "",
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self.rpc_url = rpc_url
        self.program_id = program_id
        self.idl_registry = idl_registry
        self._agent_keypair_b58 = agent_keypair_b58
        self._http_client = http_client

    def agent_pubkey(self) -> str | None:
        """Return agent public key without ever logging or exposing secret bytes."""
        if not self._agent_keypair_b58:
            return None
        kp = Keypair.from_base58_string(self._agent_keypair_b58)
        return str(kp.pubkey())

    async def _rpc_call(self, method: str, params: list[Any]) -> Any:
        payload = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
        if self._http_client is not None:
            resp = await self._http_client.post(self.rpc_url, json=payload, timeout=20.0)
            resp.raise_for_status()
            data = resp.json()
        else:
            async with httpx.AsyncClient() as client:
                resp = await client.post(self.rpc_url, json=payload, timeout=20.0)
                resp.raise_for_status()
                data = resp.json()

        if "error" in data and data["error"] is not None:
            raise RuntimeError(f"Solana RPC error ({method}): {data['error']}")
        return data.get("result")

    async def fetch_vault_state(self, vault_address: str) -> VaultStateOnChain:
        result = await self._rpc_call(
            "getAccountInfo",
            [vault_address, {"encoding": "base64", "commitment": "confirmed"}],
        )
        value = result.get("value") if isinstance(result, dict) else None
        if not isinstance(value, dict):
            raise ValueError(f"Vault account {vault_address} not found on-chain")
        if value.get("owner") != self.program_id:
            raise ValueError(f"Account {vault_address} is not owned by {self.program_id}")
        raw_data = base64.b64decode(value["data"][0])
        return decode_vault_state(raw_data)

    async def has_recipient_history(self, recipient_address: str) -> bool:
        try:
            result = await self._rpc_call(
                "getSignaturesForAddress",
                [recipient_address, {"limit": 1, "commitment": "confirmed"}],
            )
            return isinstance(result, list) and len(result) > 0
        except Exception:
            return False

    async def get_agent_sol_balance(self) -> Decimal | None:
        pub = self.agent_pubkey()
        if not pub:
            return None
        result = await self._rpc_call("getBalance", [pub, {"commitment": "confirmed"}])
        lamports = int(result["value"])
        return Decimal(lamports) / LAMPORTS_PER_SOL

    async def build_signed_agent_execute_tx(
        self,
        *,
        vault_address: str,
        vault_state: VaultStateOnChain,
        recipient_address: str,
        amount_base_units: int,
        decision_hash_bytes: bytes,
    ) -> str:
        if not self._agent_keypair_b58:
            raise RuntimeError("AGENT_KEYPAIR_B58 is not configured")
        if len(decision_hash_bytes) != 32:
            raise ValueError("decision_hash_bytes must be 32 bytes")

        agent_kp = Keypair.from_base58_string(self._agent_keypair_b58)
        program_pk = Pubkey.from_string(self.program_id)
        vault_pk = Pubkey.from_string(vault_address)
        mint_pk = Pubkey.from_string(vault_state.mint)
        recipient_pk = Pubkey.from_string(recipient_address)

        vault_ata = derive_associated_token_address(vault_pk, mint_pk)
        dest_ata = derive_associated_token_address(recipient_pk, mint_pk)

        create_ata_ix = Instruction(
            program_id=ASSOCIATED_TOKEN_PROGRAM_ID,
            accounts=[
                AccountMeta(pubkey=agent_kp.pubkey(), is_signer=True, is_writable=True),
                AccountMeta(pubkey=dest_ata, is_signer=False, is_writable=True),
                AccountMeta(pubkey=recipient_pk, is_signer=False, is_writable=False),
                AccountMeta(pubkey=mint_pk, is_signer=False, is_writable=False),
                AccountMeta(pubkey=SYSTEM_PROGRAM_ID, is_signer=False, is_writable=False),
                AccountMeta(pubkey=TOKEN_PROGRAM_ID, is_signer=False, is_writable=False),
            ],
            data=bytes([1]),  # CreateIdempotent
        )

        ix_data = AGENT_EXECUTE_DISCRIMINATOR + struct.pack(
            "<Q32s", amount_base_units, decision_hash_bytes
        )
        agent_exec_ix = Instruction(
            program_id=program_pk,
            accounts=[
                AccountMeta(pubkey=agent_kp.pubkey(), is_signer=True, is_writable=False),
                AccountMeta(pubkey=vault_pk, is_signer=False, is_writable=True),
                AccountMeta(pubkey=mint_pk, is_signer=False, is_writable=False),
                AccountMeta(pubkey=vault_ata, is_signer=False, is_writable=True),
                AccountMeta(pubkey=dest_ata, is_signer=False, is_writable=True),
                AccountMeta(pubkey=TOKEN_PROGRAM_ID, is_signer=False, is_writable=False),
            ],
            data=ix_data,
        )

        bh_res = await self._rpc_call("getLatestBlockhash", [{"commitment": "confirmed"}])
        recent_blockhash = Hash.from_string(bh_res["value"]["blockhash"])
        msg = Message([create_ata_ix, agent_exec_ix], agent_kp.pubkey())
        tx = Transaction([agent_kp], msg, recent_blockhash)
        return base64.b64encode(bytes(tx)).decode("ascii")

    async def simulate_transaction(self, tx_b64: str) -> SimulationOutcome:
        result = await self._rpc_call(
            "simulateTransaction",
            [tx_b64, {"encoding": "base64", "commitment": "confirmed"}],
        )
        value = result.get("value", {}) if isinstance(result, dict) else {}
        err = value.get("err")
        raw_logs = value.get("logs")
        logs = [str(x) for x in raw_logs] if isinstance(raw_logs, list) else []
        if err is None:
            return SimulationOutcome(
                ok=True, error_code=None, error_name=None, logs=logs, is_program_error=False
            )

        code = extract_custom_error_code(err, logs)
        idl_entry = self.idl_registry.lookup_error(code) if code is not None else None
        return SimulationOutcome(
            ok=False,
            error_code=code,
            error_name=idl_entry.name if idl_entry else None,
            logs=logs,
            is_program_error=code is not None,
        )

    async def send_and_confirm_transaction(
        self, tx_b64: str, *, skip_preflight: bool
    ) -> TxSendOutcome:
        try:
            sig = await self._rpc_call(
                "sendTransaction",
                [
                    tx_b64,
                    {
                        "encoding": "base64",
                        "skipPreflight": skip_preflight,
                        "preflightCommitment": "confirmed",
                    },
                ],
            )
        except Exception as exc:
            return TxSendOutcome(
                tx_signature=None,
                succeeded=False,
                error_code=None,
                error_name=None,
                logs=[],
                infra_error=str(exc),
            )

        tx_signature = str(sig)
        # Poll signature status until confirmed (even if tx failed on-chain)
        for _ in range(25):
            statuses = await self._rpc_call(
                "getSignatureStatuses",
                [[tx_signature], {"searchTransactionHistory": True}],
            )
            val_list = statuses.get("value", []) if isinstance(statuses, dict) else []
            status_obj = val_list[0] if val_list else None
            if isinstance(status_obj, dict) and status_obj.get("confirmationStatus") in (
                "confirmed",
                "finalized",
            ):
                tx_err = status_obj.get("err")
                if tx_err is None:
                    return TxSendOutcome(
                        tx_signature=tx_signature,
                        succeeded=True,
                        error_code=None,
                        error_name=None,
                        logs=[],
                    )
                # Fetch transaction meta to inspect exact InstructionError + logs
                tx_detail = await self._rpc_call(
                    "getTransaction",
                    [
                        tx_signature,
                        {
                            "encoding": "json",
                            "maxSupportedTransactionVersion": 0,
                            "commitment": "confirmed",
                        },
                    ],
                )
                meta = tx_detail.get("meta", {}) if isinstance(tx_detail, dict) else {}
                logs = (
                    [str(x) for x in meta.get("logMessages", [])]
                    if isinstance(meta.get("logMessages"), list)
                    else []
                )
                code = extract_custom_error_code(meta.get("err", tx_err), logs)
                idl_entry = self.idl_registry.lookup_error(code) if code is not None else None
                return TxSendOutcome(
                    tx_signature=tx_signature,
                    succeeded=False,
                    error_code=code,
                    error_name=idl_entry.name if idl_entry else None,
                    logs=logs,
                )
            await asyncio.sleep(0.8)

        return TxSendOutcome(
            tx_signature=tx_signature,
            succeeded=False,
            error_code=None,
            error_name=None,
            logs=[],
            infra_error="Tiempo de espera agotado confirmando la transacción en Solana",
        )

    async def fetch_agent_execute_from_tx(
        self, tx_signature: str
    ) -> OnChainTxInspection | None:
        tx = await self._rpc_call(
            "getTransaction",
            [
                tx_signature,
                {
                    "encoding": "json",
                    "maxSupportedTransactionVersion": 0,
                    "commitment": "confirmed",
                },
            ],
        )
        if not isinstance(tx, dict):
            return None

        meta = tx.get("meta", {}) or {}
        message = tx.get("transaction", {}).get("message", {}) or {}
        account_keys: list[str] = list(message.get("accountKeys", []))
        loaded = meta.get("loadedAddresses") or {}
        account_keys.extend(loaded.get("writable", []))
        account_keys.extend(loaded.get("readonly", []))

        instructions = message.get("instructions", []) or []
        logs = (
            [str(x) for x in meta.get("logMessages", [])]
            if isinstance(meta.get("logMessages"), list)
            else []
        )
        tx_err = meta.get("err")
        tx_succeeded = tx_err is None
        err_code = extract_custom_error_code(tx_err, logs) if not tx_succeeded else None
        idl_entry = self.idl_registry.lookup_error(err_code) if err_code is not None else None

        for ix in instructions:
            if not isinstance(ix, dict):
                continue
            prog_idx = ix.get("programIdIndex")
            if not isinstance(prog_idx, int) or prog_idx >= len(account_keys):
                continue
            if account_keys[prog_idx] != self.program_id:
                continue
            raw_data_b58 = ix.get("data")
            if not isinstance(raw_data_b58, str):
                continue
            try:
                raw_data = base58.b58decode(raw_data_b58)
            except ValueError:
                continue
            # 8-byte disc + 8-byte u64 LE amount + 32-byte decision_hash = 48 bytes
            if len(raw_data) < 48 or raw_data[:8] != AGENT_EXECUTE_DISCRIMINATOR:
                continue

            (amount,) = struct.unpack_from("<Q", raw_data, 8)
            onchain_hash = raw_data[16:48].hex()
            ix_accounts = ix.get("accounts", [])
            vault_addr = ""
            if isinstance(ix_accounts, list) and len(ix_accounts) >= 2:
                vault_idx = ix_accounts[1]
                if isinstance(vault_idx, int) and vault_idx < len(account_keys):
                    vault_addr = account_keys[vault_idx]

            ev_pair = _decode_kipu_audit_event_from_logs(logs) if tx_succeeded else None
            return OnChainTxInspection(
                onchain_hash=onchain_hash,
                amount_base_units=int(amount),
                vault_address=vault_addr,
                tx_succeeded=tx_succeeded,
                tx_error_name=idl_entry.name if idl_entry else None,
                event_hash=ev_pair[0] if ev_pair else None,
                event_amount=ev_pair[1] if ev_pair else None,
            )
        return None
