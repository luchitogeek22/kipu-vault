"""FastAPI dependency wiring for KipuVault services."""

from __future__ import annotations

from functools import lru_cache

from fastapi import Depends

from app.core.config import Settings, get_settings
from app.core.idl import KipuIdlRegistry
from app.services.llm import LLMClient, build_llm_client
from app.services.solana_vault import SolanaVaultClient
from app.services.supabase_repo import AuditRepository, SupabaseRepository


@lru_cache(maxsize=1)
def _cached_idl_registry(idl_path: str) -> KipuIdlRegistry:
    return KipuIdlRegistry(idl_path)


def get_idl_registry(settings: Settings = Depends(get_settings)) -> KipuIdlRegistry:
    """Return IDL registry (reloads if IDL file appeared after startup)."""
    reg = _cached_idl_registry(settings.kipu_idl_path)
    if not reg.is_loaded and reg.idl_path.exists():
        reg.reload()
    return reg


def get_repository(settings: Settings = Depends(get_settings)) -> AuditRepository:
    """Return Supabase PostgREST repository."""
    return SupabaseRepository(
        supabase_url=settings.supabase_url,
        service_role_key=settings.supabase_service_role_key,
    )


def get_solana_client(
    settings: Settings = Depends(get_settings),
    idl_registry: KipuIdlRegistry = Depends(get_idl_registry),
) -> SolanaVaultClient:
    """Return configured Solana RPC client."""
    return SolanaVaultClient(
        rpc_url=settings.solana_rpc_url,
        program_id=settings.kipu_program_id,
        idl_registry=idl_registry,
        agent_keypair_b58=settings.agent_keypair_b58,
    )


def get_llm_client(settings: Settings = Depends(get_settings)) -> LLMClient:
    """Return configured LLMClient."""
    return build_llm_client(settings)
