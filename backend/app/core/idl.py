"""Dynamic Anchor IDL loader and custom error mapper (never hardcoded)."""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

_REPO_ROOT = Path(__file__).resolve().parents[3]


def _resolve_idl_path(idl_path: str | Path) -> Path:
    """Resolve relative IDL paths against CWD first, falling back to REPO_ROOT."""
    candidate = Path(idl_path)
    if not candidate.is_absolute() and not candidate.exists():
        repo_candidate = _REPO_ROOT / candidate
        if repo_candidate.exists():
            return repo_candidate
    return candidate


@dataclass(frozen=True, slots=True)
class IdlErrorEntry:
    """Single custom error parsed from Anchor IDL."""

    code: int
    name: str
    msg: str


class KipuIdlRegistry:
    """Loads Anchor IDL errors and computes instruction discriminators dynamically."""

    def __init__(self, idl_path: str | Path) -> None:
        self.idl_path = _resolve_idl_path(idl_path)
        self._errors_by_code: dict[int, IdlErrorEntry] = {}
        self._program_address: str | None = None
        self._loaded = False
        if self.idl_path.exists():
            self.reload()

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    @property
    def program_address(self) -> str | None:
        return self._program_address

    def reload(self) -> None:
        """Load or reload the IDL JSON from disk."""
        raw = json.loads(self.idl_path.read_text(encoding="utf-8"))
        if not isinstance(raw, dict):
            raise ValueError(f"Invalid IDL JSON at {self.idl_path}")
        address = raw.get("address")
        self._program_address = str(address) if isinstance(address, str) else None

        errors_map: dict[int, IdlErrorEntry] = {}
        raw_errors = raw.get("errors", [])
        if isinstance(raw_errors, list):
            for entry in raw_errors:
                if not isinstance(entry, dict):
                    continue
                code = entry.get("code")
                name = entry.get("name")
                msg = entry.get("msg", "")
                if isinstance(code, int) and isinstance(name, str):
                    errors_map[code] = IdlErrorEntry(
                        code=code,
                        name=name,
                        msg=str(msg) if msg is not None else "",
                    )
        self._errors_by_code = errors_map
        self._loaded = True

    def lookup_error(self, code: int) -> IdlErrorEntry | None:
        """Translate a numeric Anchor custom error code using the loaded IDL."""
        return self._errors_by_code.get(code)

    @staticmethod
    def instruction_discriminator(ix_name: str) -> bytes:
        """Compute Anchor's 8-byte global instruction discriminator."""
        return hashlib.sha256(f"global:{ix_name}".encode()).digest()[:8]

    @staticmethod
    def account_discriminator(account_name: str) -> bytes:
        """Compute Anchor's 8-byte account discriminator."""
        return hashlib.sha256(f"account:{account_name}".encode()).digest()[:8]

    @staticmethod
    def event_discriminator(event_name: str) -> bytes:
        """Compute Anchor's 8-byte event discriminator."""
        return hashlib.sha256(f"event:{event_name}".encode()).digest()[:8]


_HEX_ERR_RE = re.compile(r"custom program error:\s*0x([0-9a-fA-F]+)")
_ANCHOR_NUM_RE = re.compile(r"Error Number:\s*(\d+)")


def extract_custom_error_code(
    err_obj: Any,
    logs: list[str] | None = None,
) -> int | None:
    """Extract Anchor Custom(code) from RPC meta.err / simulation err or logs."""
    if isinstance(err_obj, dict):
        ix_err = err_obj.get("InstructionError")
        if isinstance(ix_err, list) and len(ix_err) >= 2:
            detail = ix_err[1]
            if isinstance(detail, dict) and isinstance(detail.get("Custom"), int):
                return int(detail["Custom"])
    elif isinstance(err_obj, str):
        match = _HEX_ERR_RE.search(err_obj)
        if match:
            return int(match.group(1), 16)

    for line in logs or []:
        num_match = _ANCHOR_NUM_RE.search(line)
        if num_match:
            return int(num_match.group(1))
        hex_match = _HEX_ERR_RE.search(line)
        if hex_match:
            return int(hex_match.group(1), 16)
    return None


def explain_error_es(
    error_name: str | None,
    *,
    amount_usdc: str | None = None,
    max_per_tx_usdc: str | None = None,
    daily_limit_usdc: str | None = None,
    recipient_address: str | None = None,
    idl_msg: str | None = None,
) -> str:
    """Return a clear Spanish explanation for an Anchor/Solana rejection."""
    if error_name == "ExceedsTransactionLimit":
        amt = amount_usdc or "el monto solicitado"
        cap = max_per_tx_usdc or "el tope permitido"
        return (
            f"El programa rechazó el pago: {amt} USDC supera el tope por "
            f"transacción de {cap} USDC."
        )
    if error_name == "ExceedsDailyLimit":
        amt = amount_usdc or "el monto solicitado"
        daily = daily_limit_usdc or "el límite diario"
        return (
            f"El programa rechazó el pago: {amt} USDC excede el límite diario "
            f"acumulado de {daily} USDC en la ventana de 24 h."
        )
    if error_name == "RecipientNotAllowed":
        dest = recipient_address or "la wallet destino"
        return (
            f"El programa rechazó el pago: {dest} no pertenece a la allowlist "
            "aprobada por el owner."
        )
    if error_name == "VaultFrozen":
        return (
            "El programa rechazó el pago: la bóveda está en modo Emergency Freeze "
            "para el agente."
        )
    if error_name == "UnauthorizedAgent":
        return "El programa rechazó la instrucción: el firmante no coincide con el agente activo."
    if error_name == "InvalidDecisionHash":
        return "El programa rechazó la instrucción: decision_hash no puede ser todo ceros."
    if error_name == "InvalidMint":
        return "El programa rechazó la instrucción: la cuenta destino pertenece a otro mint SPL."
    if error_name == "InvalidAmount":
        return "El programa rechazó la instrucción: el monto debe ser mayor que cero."
    if error_name == "MathOverflow":
        return "El programa rechazó la instrucción por desbordamiento aritmético controlado."
    if error_name and idl_msg:
        return f"El programa rechazó la operación ({error_name}): {idl_msg}."
    if error_name:
        return f"El programa rechazó la operación con el error {error_name}."
    return "La transacción fue rechazada por la red o el programa on-chain."
