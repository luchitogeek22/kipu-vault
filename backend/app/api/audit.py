"""Audit ledger listing (JWT) and public on-chain verification (/api/audit/verify/{tx})."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_repository, get_solana_client
from app.core.security import AuthenticatedUser, get_current_user, validate_solana_pubkey
from app.schemas.audit import AuditListResponse, AuditVerifyResponse
from app.services.canonical import verify_canonical_text
from app.services.solana_vault import SolanaVaultClient
from app.services.supabase_repo import AuditRepository

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("/list", response_model=AuditListResponse)
async def list_audit_logs(
    vault_address: str = Query(..., min_length=32, max_length=64),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: AuthenticatedUser = Depends(get_current_user),
    repo: AuditRepository = Depends(get_repository),
    solana: SolanaVaultClient = Depends(get_solana_client),
) -> AuditListResponse:
    """List audit_logs for a vault owned by the authenticated JWT wallet."""
    validate_solana_pubkey(vault_address)
    try:
        vault_state = await solana.fetch_vault_state(vault_address)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Bóveda no encontrada on-chain: {exc}",
        ) from exc

    if vault_state.owner != user.wallet:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No autorizado para consultar los registros de esta bóveda",
        )

    items, total = await repo.list_audit_logs(
        vault_address=vault_address, limit=limit, offset=offset
    )
    return AuditListResponse(items=items, total=total)


@router.get("/verify/{tx_signature}", response_model=AuditVerifyResponse)
async def verify_audit_transaction(
    tx_signature: str,
    repo: AuditRepository = Depends(get_repository),
    solana: SolanaVaultClient = Depends(get_solana_client),
) -> AuditVerifyResponse:
    """Public read-only verification comparing stored canonical_json against on-chain tx data."""
    row = await repo.get_audit_by_tx_signature(tx_signature)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No existe registro de auditoría con esa firma de transacción",
        )

    canonical_valid, offchain_hash, parsed_payload = verify_canonical_text(row.canonical_json)

    inspection = await solana.fetch_agent_execute_from_tx(tx_signature)
    if inspection is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontró la instrucción agent_execute en la transacción on-chain",
        )

    expected_amount: int | None = None
    if parsed_payload is not None and "amount_base_units" in parsed_payload:
        try:
            expected_amount = int(str(parsed_payload["amount_base_units"]))
        except ValueError:
            expected_amount = None
    elif row.amount_base_units is not None:
        expected_amount = int(row.amount_base_units)

    hash_match = offchain_hash == inspection.onchain_hash and offchain_hash == row.decision_hash
    amount_match = expected_amount is not None and expected_amount == inspection.amount_base_units
    vault_match = row.vault_address == inspection.vault_address

    event_match = True
    if inspection.tx_succeeded and inspection.event_hash is not None:
        event_match = (
            inspection.event_hash == offchain_hash
            and inspection.event_amount == inspection.amount_base_units
        )

    verified = canonical_valid and hash_match and amount_match and vault_match and event_match

    return AuditVerifyResponse(
        verified=verified,
        offchain_hash=offchain_hash,
        onchain_hash=inspection.onchain_hash,
        amount_match=amount_match,
        vault_match=vault_match,
        tx_succeeded=inspection.tx_succeeded,
        tx_error_name=inspection.tx_error_name,
        checked_at=datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        canonical_shape_valid=canonical_valid,
        details={
            "status": row.status,
            "onchain_amount_base_units": str(inspection.amount_base_units),
            "onchain_vault": inspection.vault_address,
            "event_verified": inspection.event_hash is not None,
        },
    )
