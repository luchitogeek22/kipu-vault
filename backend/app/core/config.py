"""Application settings loaded from environment variables."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_INSECURE_JWT_SECRET = "dev-insecure-change-me-at-least-32-chars"  # noqa: S105


class Settings(BaseSettings):
    """Typed runtime configuration for KipuVault FastAPI backend."""

    model_config = SettingsConfigDict(
        env_file=(str(REPO_ROOT / ".env"), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    kipu_env: Literal["development", "production", "test"] = Field(default="development")
    solana_rpc_url: str = Field(default="https://api.devnet.solana.com")
    kipu_program_id: str = Field(default="KipuVau1t1111111111111111111111111111111111")
    kipu_idl_path: str = Field(
        default=str(REPO_ROOT / "target" / "idl" / "kipu_vault.json")
    )
    agent_keypair_b58: str = Field(default="")

    supabase_url: str = Field(default="")
    supabase_service_role_key: str = Field(default="")

    jwt_secret: str = Field(default=DEFAULT_INSECURE_JWT_SECRET)
    jwt_ttl_minutes: int = Field(default=15)
    nonce_ttl_minutes: int = Field(default=5)
    frontend_origin: str = Field(default="http://localhost:3000")
    frontend_origins: str = Field(default="")

    llm_provider: Literal["anthropic", "google", "meta", "fake"] = Field(
        default="anthropic"
    )
    llm_model: str = Field(default="claude-sonnet-4-20250514")
    anthropic_api_key: str = Field(default="")
    google_api_key: str = Field(default="")
    meta_api_key: str = Field(default="")
    meta_api_base_url: str = Field(default="https://api.meta.ai/v1")

    risk_block_threshold: int = Field(default=70, ge=0, le=100)
    kipu_demo_mode: bool = Field(default=False)

    def get_cors_origins(self) -> list[str]:
        """Return deduplicated, normalized origins allowed by CORS."""
        raw_items = [self.frontend_origin, *self.frontend_origins.split(",")]
        seen: set[str] = set()
        origins: list[str] = []
        for item in raw_items:
            normalized = item.strip().rstrip("/")
            if normalized and normalized not in seen:
                seen.add(normalized)
                origins.append(normalized)
        return origins

    def validate_production_readiness(self) -> None:
        """Fail fast on insecure or missing config when running in production."""
        if self.kipu_env != "production":
            return
        if (
            not self.jwt_secret
            or self.jwt_secret == DEFAULT_INSECURE_JWT_SECRET
            or len(self.jwt_secret) < 32
        ):
            raise RuntimeError(
                "Production startup blocked: JWT_SECRET must be a random string (>= 32 chars)."
            )
        if not self.supabase_url.strip() or not self.supabase_service_role_key.strip():
            raise RuntimeError(
                "Production startup blocked: SUPABASE_URL and "
                "SUPABASE_SERVICE_ROLE_KEY are required."
            )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached Settings instance."""
    return Settings()
