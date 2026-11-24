"""Application settings loaded from environment variables."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Typed runtime configuration for KipuVault FastAPI backend."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    solana_rpc_url: str = Field(default="https://api.devnet.solana.com")
    kipu_program_id: str = Field(default="KipuVau1t1111111111111111111111111111111111")
    kipu_idl_path: str = Field(
        default=str(
            Path(__file__).resolve().parents[3] / "target" / "idl" / "kipu_vault.json"
        )
    )
    agent_keypair_b58: str = Field(default="")

    supabase_url: str = Field(default="")
    supabase_service_role_key: str = Field(default="")

    jwt_secret: str = Field(default="dev-insecure-change-me-at-least-32-chars")
    jwt_ttl_minutes: int = Field(default=15)
    nonce_ttl_minutes: int = Field(default=5)
    frontend_origin: str = Field(default="http://localhost:3000")

    llm_provider: Literal["anthropic", "google", "fake"] = Field(default="anthropic")
    llm_model: str = Field(default="claude-sonnet-4-20250514")
    anthropic_api_key: str = Field(default="")
    google_api_key: str = Field(default="")

    risk_block_threshold: int = Field(default=70, ge=0, le=100)
    kipu_demo_mode: bool = Field(default=False)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached Settings instance."""
    return Settings()
