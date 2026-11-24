"""Tests for dynamic Anchor IDL error loading and Custom(code) extraction."""

from __future__ import annotations

from pathlib import Path

import pytest

from app.core.config import REPO_ROOT, Settings
from app.core.idl import KipuIdlRegistry, explain_error_es, extract_custom_error_code


def test_idl_error_mapping_dynamic(idl_registry: KipuIdlRegistry) -> None:
    assert idl_registry.is_loaded is True

    e6003 = idl_registry.lookup_error(6003)
    assert e6003 is not None
    assert e6003.name == "ExceedsTransactionLimit"

    e6008 = idl_registry.lookup_error(6008)
    assert e6008 is not None
    assert e6008.name == "RecipientNotAllowed"

    assert idl_registry.lookup_error(9999) is None


def test_extract_custom_error_code_from_meta_and_logs() -> None:
    code_from_meta = extract_custom_error_code({"InstructionError": [1, {"Custom": 6003}]})
    assert code_from_meta == 6003

    code_from_hex_log = extract_custom_error_code(
        None,
        logs=["Program KipuVau1t failed: custom program error: 0x1778"],
    )
    assert code_from_hex_log == 6008

    msg = explain_error_es(
        "ExceedsTransactionLimit",
        amount_usdc="150.000000",
        max_per_tx_usdc="10.000000",
    )
    assert "150.000000 USDC" in msg
    assert "10.000000 USDC" in msg


def test_idl_missing_file_starts_unloaded(tmp_path: Path) -> None:
    missing = KipuIdlRegistry(tmp_path / "does_not_exist.json")
    assert missing.is_loaded is False
    assert missing.lookup_error(6000) is None


def test_idl_contains_all_14_spec_error_codes(idl_registry: KipuIdlRegistry) -> None:
    expected = {
        6000: "UnauthorizedOwner",
        6001: "UnauthorizedAgent",
        6002: "VaultFrozen",
        6003: "ExceedsTransactionLimit",
        6004: "ExceedsDailyLimit",
        6005: "InvalidPolicyConfig",
        6006: "InvalidAmount",
        6007: "MathOverflow",
        6008: "RecipientNotAllowed",
        6009: "RecipientListFull",
        6010: "RecipientAlreadyExists",
        6011: "RecipientNotFound",
        6012: "InvalidDecisionHash",
        6013: "InvalidMint",
    }
    repo_mirror = KipuIdlRegistry(REPO_ROOT / "frontend" / "src" / "idl" / "kipu_vault.json")
    assert repo_mirror.is_loaded is True

    for registry in (idl_registry, repo_mirror):
        for code, name in expected.items():
            entry = registry.lookup_error(code)
            assert entry is not None
            assert entry.name == name


def test_relative_idl_path_resolves_from_repo_root(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.chdir(REPO_ROOT / "backend")
    reg = KipuIdlRegistry("frontend/src/idl/kipu_vault.json")
    assert reg.is_loaded is True
    assert reg.idl_path == REPO_ROOT / "frontend" / "src" / "idl" / "kipu_vault.json"
    frozen = reg.lookup_error(6002)
    assert frozen is not None
    assert frozen.name == "VaultFrozen"


def test_settings_default_idl_path_points_to_target(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("KIPU_IDL_PATH", raising=False)
    settings = Settings()
    assert Path(settings.kipu_idl_path).as_posix().endswith("target/idl/kipu_vault.json")
