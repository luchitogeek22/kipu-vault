"""Health endpoint exposing agent SOL balance and warning threshold."""

from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.deps import get_idl_registry, get_solana_client
from app.core.config import Settings, get_settings
from app.core.idl import KipuIdlRegistry
from app.services.solana_vault import SolanaVaultClient

router = APIRouter(prefix="/api", tags=["health"])

LOW_SOL_THRESHOLD = Decimal("0.05")


class HealthResponse(BaseModel):
    """Runtime health status including agent Devnet SOL balance check."""

    status: str
    agent_pubkey: str | None
    agent_sol_balance: str | None
    low_sol_warning: bool
    demo_mode: bool
    idl_loaded: bool


@router.get("/health", response_model=HealthResponse)
async def health_check(
    settings: Settings = Depends(get_settings),
    solana: SolanaVaultClient = Depends(get_solana_client),
    idl_registry: KipuIdlRegistry = Depends(get_idl_registry),
) -> HealthResponse:
    """Return service readiness and warn if agent SOL balance < 0.05 SOL."""
    agent_pub = solana.agent_pubkey()
    sol_bal: Decimal | None = None
    if agent_pub:
        try:
            sol_bal = await solana.get_agent_sol_balance()
        except Exception:
            sol_bal = None

    low_warning = sol_bal is not None and sol_bal < LOW_SOL_THRESHOLD
    return HealthResponse(
        status="ok",
        agent_pubkey=agent_pub,
        agent_sol_balance=f"{sol_bal:.6f}" if sol_bal is not None else None,
        low_sol_warning=low_warning,
        demo_mode=settings.kipu_demo_mode,
        idl_loaded=idl_registry.is_loaded,
    )
