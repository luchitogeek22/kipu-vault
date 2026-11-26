"""Tests for production config hardening (CORS origins and fail-fast secrets)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core.config import DEFAULT_INSECURE_JWT_SECRET, Settings
from app.main import create_app


def test_cors_origins_normalized_and_deduplicated() -> None:
    cfg = Settings(
        frontend_origin="https://kipuvault.vercel.app/",
        frontend_origins=(
            "https://kipuvault.vercel.app, https://preview.vercel.app/ , "
            "http://localhost:3000 "
        ),
    )
    assert cfg.get_cors_origins() == [
        "https://kipuvault.vercel.app",
        "https://preview.vercel.app",
        "http://localhost:3000",
    ]


def test_production_blocks_default_jwt_secret() -> None:
    cfg = Settings(
        kipu_env="production",
        jwt_secret=DEFAULT_INSECURE_JWT_SECRET,
        supabase_url="https://example.supabase.co",
        supabase_service_role_key="service-role",
    )
    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        cfg.validate_production_readiness()


def test_production_blocks_missing_supabase() -> None:
    cfg = Settings(
        kipu_env="production",
        jwt_secret="a-strong-random-jwt-secret-with-at-least-32-chars",
        supabase_url="",
        supabase_service_role_key="",
    )
    with pytest.raises(RuntimeError, match="SUPABASE_URL"):
        cfg.validate_production_readiness()


def test_production_allows_valid_config_and_multi_cors_preflight() -> None:
    cfg = Settings(
        kipu_env="production",
        jwt_secret="a-strong-random-jwt-secret-with-at-least-32-chars",
        supabase_url="https://example.supabase.co",
        supabase_service_role_key="service-role",
        frontend_origin="https://kipuvault.vercel.app/",
        frontend_origins="https://preview.vercel.app",
    )
    app = create_app(cfg)
    with TestClient(app) as client:
        resp = client.options(
            "/api/health",
            headers={
                "Origin": "https://preview.vercel.app",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert resp.status_code == 200
        assert resp.headers.get("access-control-allow-origin") == "https://preview.vercel.app"
