"""KipuVault FastAPI application entrypoint."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.agent import router as agent_router
from app.api.audit import router as audit_router
from app.api.auth import router as auth_router
from app.api.health import router as health_router
from app.core.config import Settings, get_settings
from app.core.security import limiter


def create_app(settings: Settings | None = None) -> FastAPI:
    """Create and configure the FastAPI application."""
    cfg = settings or get_settings()

    app = FastAPI(
        title="KipuVault API",
        version="0.1.0",
        description="Backend SIWS + AI Copilot + On-Chain Guardrail Audit API for KipuVault",
    )
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[cfg.frontend_origin],
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(agent_router)
    app.include_router(audit_router)
    return app


app = create_app()
