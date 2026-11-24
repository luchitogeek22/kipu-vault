"""Tests for audit_logs status transition guards."""

from __future__ import annotations

import pytest

from app.schemas.audit import AuditStatus
from app.services.supabase_repo import (
    InvalidStatusTransitionError,
    validate_status_transition,
)


@pytest.mark.parametrize(
    "target",
    ["EXECUTED", "BLOCKED_ONCHAIN", "BLOCKED_PREFLIGHT", "FAILED_INFRA"],
)
def test_valid_transitions_from_pending(target: AuditStatus) -> None:
    validate_status_transition("PENDING", target)


@pytest.mark.parametrize(
    ("source", "target"),
    [
        ("PENDING", "REJECTED_BY_AI"),
        ("PENDING", "NEEDS_RECIPIENT_APPROVAL"),
        ("EXECUTED", "BLOCKED_ONCHAIN"),
        ("BLOCKED_PREFLIGHT", "EXECUTED"),
        ("REJECTED_BY_AI", "PENDING"),
        ("NEEDS_RECIPIENT_APPROVAL", "EXECUTED"),
        ("FAILED_INFRA", "EXECUTED"),
    ],
)
def test_invalid_status_transitions_raise(source: AuditStatus, target: AuditStatus) -> None:
    with pytest.raises(InvalidStatusTransitionError):
        validate_status_transition(source, target)
