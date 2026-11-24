"""Supabase PostgREST repository and audit_logs state machine."""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import UTC, datetime
from typing import Any, Literal
from uuid import uuid4

import httpx

from app.schemas.audit import AuditLogEntry, AuditStatus

VALID_STATUS_TRANSITIONS: dict[AuditStatus, set[AuditStatus]] = {
    "PENDING": {"EXECUTED", "BLOCKED_ONCHAIN", "BLOCKED_PREFLIGHT", "FAILED_INFRA"},
    "EXECUTED": set(),
    "BLOCKED_ONCHAIN": set(),
    "BLOCKED_PREFLIGHT": set(),
    "REJECTED_BY_AI": set(),
    "NEEDS_RECIPIENT_APPROVAL": set(),
    "FAILED_INFRA": set(),
}


class InvalidStatusTransitionError(ValueError):
    """Raised when attempting an illegal audit_logs status transition."""


def validate_status_transition(current: AuditStatus, target: AuditStatus) -> None:
    """Enforce allowed audit_logs status transitions."""
    allowed = VALID_STATUS_TRANSITIONS.get(current, set())
    if target not in allowed:
        raise InvalidStatusTransitionError(
            f"Transición de estado inválida: {current} -> {target}"
        )


class AuditRepository(ABC):
    """Persistence interface for auth_nonces and append-only audit_logs."""

    @abstractmethod
    async def create_nonce(self, *, nonce: str, wallet: str, expires_at: datetime) -> None:
        """Store a newly issued single-use SIWS nonce."""

    @abstractmethod
    async def get_nonce_expiry(self, *, nonce: str, wallet: str) -> datetime | None:
        """Return stored expires_at if nonce exists for wallet and is unused, else None."""

    @abstractmethod
    async def consume_nonce(self, *, nonce: str, wallet: str, now: datetime) -> bool:
        """Atomically mark a valid, unexpired, unused nonce as used; return False otherwise."""

    @abstractmethod
    async def insert_audit_log(
        self,
        *,
        nonce: str,
        vault_address: str,
        owner_wallet: str,
        mode: Literal["standard", "red_team"],
        status: AuditStatus,
        canonical_json: str,
        decision_hash: str,
        recipient_address: str | None,
        amount_base_units: str | None,
        tx_signature: str | None = None,
        error_code: int | None = None,
        error_name: str | None = None,
        sim_logs: list[str] | None = None,
    ) -> AuditLogEntry:
        """Insert a new audit_logs record."""

    @abstractmethod
    async def update_audit_status(
        self,
        *,
        audit_id: str,
        from_status: AuditStatus,
        to_status: AuditStatus,
        tx_signature: str | None = None,
        error_code: int | None = None,
        error_name: str | None = None,
        sim_logs: list[str] | None = None,
    ) -> AuditLogEntry:
        """Transition an existing PENDING audit row without mutating evidence fields."""

    @abstractmethod
    async def list_audit_logs(
        self,
        *,
        vault_address: str,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[AuditLogEntry], int]:
        """List audit logs for a vault ordered newest first."""

    @abstractmethod
    async def get_audit_by_tx_signature(self, tx_signature: str) -> AuditLogEntry | None:
        """Fetch an audit row by its transaction signature."""


class SupabaseRepository(AuditRepository):
    """Async Supabase PostgREST repository authenticated via service role key."""

    def __init__(
        self,
        *,
        supabase_url: str,
        service_role_key: str,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self.base_url = supabase_url.rstrip("/")
        self.service_role_key = service_role_key
        self._http_client = http_client

    def _headers(self, *, prefer: str | None = None) -> dict[str, str]:
        if not self.base_url or not self.service_role_key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured")
        headers = {
            "apikey": self.service_role_key,
            "Authorization": f"Bearer {self.service_role_key}",
            "Content-Type": "application/json",
        }
        if prefer:
            headers["Prefer"] = prefer
        return headers

    async def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, str] | None = None,
        json_body: dict[str, Any] | None = None,
        prefer: str | None = None,
    ) -> httpx.Response:
        url = f"{self.base_url}/rest/v1/{path}"
        headers = self._headers(prefer=prefer)
        if self._http_client is not None:
            resp = await self._http_client.request(
                method, url, params=params, json=json_body, headers=headers, timeout=15.0
            )
            resp.raise_for_status()
            return resp

        async with httpx.AsyncClient() as client:
            resp = await client.request(
                method, url, params=params, json=json_body, headers=headers, timeout=15.0
            )
            resp.raise_for_status()
            return resp

    @staticmethod
    def _row_to_entry(row: dict[str, Any]) -> AuditLogEntry:
        raw_amount = row.get("amount_base_units")
        amount_str = str(raw_amount) if raw_amount is not None else None
        raw_logs = row.get("sim_logs")
        sim_logs = [str(x) for x in raw_logs] if isinstance(raw_logs, list) else None
        return AuditLogEntry(
            id=str(row["id"]),
            nonce=str(row["nonce"]),
            vault_address=str(row["vault_address"]),
            owner_wallet=str(row["owner_wallet"]),
            mode="red_team" if row.get("mode") == "red_team" else "standard",
            status=row["status"],
            canonical_json=str(row["canonical_json"]),
            decision_hash=str(row["decision_hash"]),
            recipient_address=(
                str(row["recipient_address"]) if row.get("recipient_address") else None
            ),
            amount_base_units=amount_str,
            tx_signature=str(row["tx_signature"]) if row.get("tx_signature") else None,
            error_code=int(row["error_code"]) if row.get("error_code") is not None else None,
            error_name=str(row["error_name"]) if row.get("error_name") else None,
            sim_logs=sim_logs,
            created_at=str(row["created_at"]),
            updated_at=str(row["updated_at"]),
        )

    async def create_nonce(self, *, nonce: str, wallet: str, expires_at: datetime) -> None:
        await self._request(
            "POST",
            "auth_nonces",
            json_body={
                "nonce": nonce,
                "wallet": wallet,
                "expires_at": expires_at.astimezone(UTC).isoformat(),
            },
            prefer="return=minimal",
        )

    async def get_nonce_expiry(self, *, nonce: str, wallet: str) -> datetime | None:
        resp = await self._request(
            "GET",
            "auth_nonces",
            params={
                "nonce": f"eq.{nonce}",
                "wallet": f"eq.{wallet}",
                "used_at": "is.null",
                "limit": "1",
            },
        )
        rows = resp.json()
        if not isinstance(rows, list) or not rows:
            return None
        raw_exp = rows[0].get("expires_at")
        if not isinstance(raw_exp, str):
            return None
        return datetime.fromisoformat(raw_exp.replace("Z", "+00:00")).astimezone(UTC)

    async def consume_nonce(self, *, nonce: str, wallet: str, now: datetime) -> bool:
        now_iso = now.astimezone(UTC).isoformat()
        resp = await self._request(
            "PATCH",
            "auth_nonces",
            params={
                "nonce": f"eq.{nonce}",
                "wallet": f"eq.{wallet}",
                "used_at": "is.null",
                "expires_at": f"gt.{now_iso}",
            },
            json_body={"used_at": now_iso},
            prefer="return=representation",
        )
        rows = resp.json()
        return isinstance(rows, list) and len(rows) == 1

    async def insert_audit_log(
        self,
        *,
        nonce: str,
        vault_address: str,
        owner_wallet: str,
        mode: Literal["standard", "red_team"],
        status: AuditStatus,
        canonical_json: str,
        decision_hash: str,
        recipient_address: str | None,
        amount_base_units: str | None,
        tx_signature: str | None = None,
        error_code: int | None = None,
        error_name: str | None = None,
        sim_logs: list[str] | None = None,
    ) -> AuditLogEntry:
        body: dict[str, Any] = {
            "nonce": nonce,
            "vault_address": vault_address,
            "owner_wallet": owner_wallet,
            "mode": mode,
            "status": status,
            "canonical_json": canonical_json,
            "decision_hash": decision_hash,
            "recipient_address": recipient_address,
            "amount_base_units": amount_base_units,
            "tx_signature": tx_signature,
            "error_code": error_code,
            "error_name": error_name,
            "sim_logs": sim_logs,
        }
        resp = await self._request(
            "POST",
            "audit_logs",
            json_body=body,
            prefer="return=representation",
        )
        rows = resp.json()
        if not isinstance(rows, list) or not rows:
            raise RuntimeError("Supabase insert_audit_log returned no rows")
        return self._row_to_entry(rows[0])

    async def update_audit_status(
        self,
        *,
        audit_id: str,
        from_status: AuditStatus,
        to_status: AuditStatus,
        tx_signature: str | None = None,
        error_code: int | None = None,
        error_name: str | None = None,
        sim_logs: list[str] | None = None,
    ) -> AuditLogEntry:
        validate_status_transition(from_status, to_status)
        patch_body: dict[str, Any] = {"status": to_status}
        if tx_signature is not None:
            patch_body["tx_signature"] = tx_signature
        if error_code is not None:
            patch_body["error_code"] = error_code
        if error_name is not None:
            patch_body["error_name"] = error_name
        if sim_logs is not None:
            patch_body["sim_logs"] = sim_logs

        resp = await self._request(
            "PATCH",
            "audit_logs",
            params={"id": f"eq.{audit_id}", "status": f"eq.{from_status}"},
            json_body=patch_body,
            prefer="return=representation",
        )
        rows = resp.json()
        if not isinstance(rows, list) or not rows:
            raise InvalidStatusTransitionError(
                f"No se pudo actualizar audit_id={audit_id} desde status={from_status}"
            )
        return self._row_to_entry(rows[0])

    async def list_audit_logs(
        self,
        *,
        vault_address: str,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[AuditLogEntry], int]:
        resp = await self._request(
            "GET",
            "audit_logs",
            params={
                "vault_address": f"eq.{vault_address}",
                "order": "created_at.desc",
                "limit": str(limit),
                "offset": str(offset),
            },
            prefer="count=exact",
        )
        rows = resp.json()
        entries = [self._row_to_entry(r) for r in rows] if isinstance(rows, list) else []
        total = len(entries)
        content_range = resp.headers.get("content-range", "")
        if "/" in content_range:
            tail = content_range.split("/")[-1]
            if tail.isdigit():
                total = int(tail)
        return entries, total

    async def get_audit_by_tx_signature(self, tx_signature: str) -> AuditLogEntry | None:
        resp = await self._request(
            "GET",
            "audit_logs",
            params={"tx_signature": f"eq.{tx_signature}", "limit": "1"},
        )
        rows = resp.json()
        if isinstance(rows, list) and rows:
            return self._row_to_entry(rows[0])
        return None


class InMemoryAuditRepository(AuditRepository):
    """In-memory repository enforcing identical constraints for unit tests."""

    def __init__(self) -> None:
        self.nonces: dict[str, dict[str, Any]] = {}
        self.audits: dict[str, AuditLogEntry] = {}

    async def create_nonce(self, *, nonce: str, wallet: str, expires_at: datetime) -> None:
        self.nonces[nonce] = {
            "wallet": wallet,
            "expires_at": expires_at.astimezone(UTC),
            "used_at": None,
        }

    async def get_nonce_expiry(self, *, nonce: str, wallet: str) -> datetime | None:
        entry = self.nonces.get(nonce)
        if not entry or entry["wallet"] != wallet or entry["used_at"] is not None:
            return None
        exp = entry["expires_at"]
        return exp if isinstance(exp, datetime) else None

    async def consume_nonce(self, *, nonce: str, wallet: str, now: datetime) -> bool:
        entry = self.nonces.get(nonce)
        if not entry:
            return False
        if entry["wallet"] != wallet:
            return False
        if entry["used_at"] is not None:
            return False
        if entry["expires_at"] <= now.astimezone(UTC):
            return False
        entry["used_at"] = now.astimezone(UTC)
        return True

    async def insert_audit_log(
        self,
        *,
        nonce: str,
        vault_address: str,
        owner_wallet: str,
        mode: Literal["standard", "red_team"],
        status: AuditStatus,
        canonical_json: str,
        decision_hash: str,
        recipient_address: str | None,
        amount_base_units: str | None,
        tx_signature: str | None = None,
        error_code: int | None = None,
        error_name: str | None = None,
        sim_logs: list[str] | None = None,
    ) -> AuditLogEntry:
        now_iso = datetime.now(UTC).isoformat()
        audit_id = str(uuid4())
        entry = AuditLogEntry(
            id=audit_id,
            nonce=nonce,
            vault_address=vault_address,
            owner_wallet=owner_wallet,
            mode=mode,
            status=status,
            canonical_json=canonical_json,
            decision_hash=decision_hash,
            recipient_address=recipient_address,
            amount_base_units=amount_base_units,
            tx_signature=tx_signature,
            error_code=error_code,
            error_name=error_name,
            sim_logs=sim_logs,
            created_at=now_iso,
            updated_at=now_iso,
        )
        self.audits[audit_id] = entry
        return entry

    async def update_audit_status(
        self,
        *,
        audit_id: str,
        from_status: AuditStatus,
        to_status: AuditStatus,
        tx_signature: str | None = None,
        error_code: int | None = None,
        error_name: str | None = None,
        sim_logs: list[str] | None = None,
    ) -> AuditLogEntry:
        existing = self.audits.get(audit_id)
        if existing is None or existing.status != from_status:
            raise InvalidStatusTransitionError(
                f"Audit row {audit_id} not in state {from_status}"
            )
        validate_status_transition(existing.status, to_status)
        updated = existing.model_copy(
            update={
                "status": to_status,
                "tx_signature": tx_signature if tx_signature is not None else existing.tx_signature,
                "error_code": error_code if error_code is not None else existing.error_code,
                "error_name": error_name if error_name is not None else existing.error_name,
                "sim_logs": sim_logs if sim_logs is not None else existing.sim_logs,
                "updated_at": datetime.now(UTC).isoformat(),
            }
        )
        self.audits[audit_id] = updated
        return updated

    async def list_audit_logs(
        self,
        *,
        vault_address: str,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[AuditLogEntry], int]:
        matching = [
            entry for entry in self.audits.values() if entry.vault_address == vault_address
        ]
        matching.sort(key=lambda e: e.created_at, reverse=True)
        return matching[offset : offset + limit], len(matching)

    async def get_audit_by_tx_signature(self, tx_signature: str) -> AuditLogEntry | None:
        for entry in self.audits.values():
            if entry.tx_signature == tx_signature:
                return entry
        return None
