"""SIWS authentication endpoints (/api/auth/nonce and /api/auth/verify)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.api.deps import get_repository, get_solana_client
from app.core.config import Settings, get_settings
from app.core.security import (
    build_siws_message,
    create_access_token,
    limiter,
    validate_solana_pubkey,
    verify_ed25519_signature,
)
from app.schemas.auth import NonceResponse, VerifyRequest, VerifyResponse
from app.services.solana_vault import SolanaVaultClient
from app.services.supabase_repo import AuditRepository

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/nonce", response_model=NonceResponse)
async def get_nonce(
    wallet: str = Query(..., min_length=32, max_length=64),
    settings: Settings = Depends(get_settings),
    repo: AuditRepository = Depends(get_repository),
) -> NonceResponse:
    """Generate a single-use SIWS challenge (5-minute TTL) for the given Solana wallet."""
    validate_solana_pubkey(wallet)
    nonce = uuid4().hex
    now = datetime.now(UTC).replace(microsecond=0)
    expires_at = now + timedelta(minutes=settings.nonce_ttl_minutes)
    expires_iso = expires_at.strftime("%Y-%m-%dT%H:%M:%SZ")

    await repo.create_nonce(nonce=nonce, wallet=wallet, expires_at=expires_at)
    message = build_siws_message(
        frontend_origin=settings.frontend_origin,
        wallet=wallet,
        nonce=nonce,
        expires_at_iso=expires_iso,
    )
    return NonceResponse(nonce=nonce, message=message, expires_at=expires_iso)


@router.post("/verify", response_model=VerifyResponse)
@limiter.limit("30/minute")
async def verify_siws(
    request: Request,
    body: VerifyRequest,
    settings: Settings = Depends(get_settings),
    repo: AuditRepository = Depends(get_repository),
    solana: SolanaVaultClient = Depends(get_solana_client),
) -> VerifyResponse:
    """Verify Ed25519 SIWS signature, single-use nonce, and on-chain vault ownership."""
    validate_solana_pubkey(body.wallet)
    validate_solana_pubkey(body.vault_address)

    now = datetime.now(UTC)
    expires_at = await repo.get_nonce_expiry(nonce=body.nonce, wallet=body.wallet)
    if expires_at is None or expires_at <= now:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nonce inválido, expirado o ya utilizado",
        )

    expires_iso = expires_at.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    expected_message = build_siws_message(
        frontend_origin=settings.frontend_origin,
        wallet=body.wallet,
        nonce=body.nonce,
        expires_at_iso=expires_iso,
    )

    if not verify_ed25519_signature(body.wallet, expected_message, body.signature):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firma Ed25519 inválida para el desafío SIWS",
        )

    consumed = await repo.consume_nonce(nonce=body.nonce, wallet=body.wallet, now=now)
    if not consumed:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="El nonce ya fue utilizado o expiró",
        )

    try:
        vault_state = await solana.fetch_vault_state(body.vault_address)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Bóveda no encontrada on-chain: {exc}",
        ) from exc

    if vault_state.owner != body.wallet:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="La wallet firmante no coincide con vault.owner on-chain",
        )

    token, expires_in = create_access_token(
        wallet=body.wallet,
        vault_address=body.vault_address,
        settings=settings,
    )
    return VerifyResponse(
        access_token=token,
        expires_in=expires_in,
        wallet=body.wallet,
        vault_address=body.vault_address,
    )
