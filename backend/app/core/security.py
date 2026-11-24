"""SIWS Ed25519 verification, HS256 JWT management, and SlowAPI rate-limit helpers."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from urllib.parse import urlparse

import base58
import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from nacl.exceptions import BadSignatureError
from nacl.signing import VerifyKey
from slowapi import Limiter
from slowapi.util import get_remote_address
from solders.pubkey import Pubkey

from app.core.config import Settings, get_settings

_bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True, slots=True)
class AuthenticatedUser:
    """Identity extracted from a verified HS256 JWT."""

    wallet: str
    vault_address: str


def build_siws_message(
    *,
    frontend_origin: str,
    wallet: str,
    nonce: str,
    expires_at_iso: str,
) -> str:
    """Construct the deterministic SIWS message signed by the owner's wallet."""
    parsed = urlparse(frontend_origin)
    domain = parsed.netloc or frontend_origin
    return (
        f"{domain} quiere iniciar sesión con tu cuenta de Solana:\n"
        f"{wallet}\n\n"
        f"Propósito: Autenticación de propietario en KipuVault\n"
        f"Nonce: {nonce}\n"
        f"Expira: {expires_at_iso}"
    )


def validate_solana_pubkey(address: str) -> Pubkey:
    """Parse a base58 Solana public key or raise HTTP 422."""
    try:
        return Pubkey.from_string(address)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Dirección Solana inválida: {address}",
        ) from exc


def verify_ed25519_signature(wallet: str, message: str, signature_b58: str) -> bool:
    """Verify an Ed25519 signature produced by a Solana wallet using PyNaCl."""
    try:
        pubkey_bytes = bytes(Pubkey.from_string(wallet))
        sig_bytes = base58.b58decode(signature_b58)
        if len(sig_bytes) != 64:
            return False
        verify_key = VerifyKey(pubkey_bytes)
        verify_key.verify(message.encode("utf-8"), sig_bytes)
        return True
    except (BadSignatureError, ValueError):
        return False


def create_access_token(
    *,
    wallet: str,
    vault_address: str,
    settings: Settings,
) -> tuple[str, int]:
    """Issue a short-lived HS256 JWT (15 minutes by default)."""
    now = datetime.now(UTC)
    ttl_seconds = settings.jwt_ttl_minutes * 60
    exp = now + timedelta(seconds=ttl_seconds)
    payload = {
        "sub": wallet,
        "vault_address": vault_address,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm="HS256")
    return token, ttl_seconds


def decode_access_token(token: str, settings: Settings) -> AuthenticatedUser:
    """Decode and validate HS256 JWT; raise HTTP 401 on any invalid or expired token."""
    try:
        decoded = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        sub = decoded.get("sub")
        vault_address = decoded.get("vault_address")
        if not isinstance(sub, str) or not isinstance(vault_address, str):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token JWT malformado",
            )
        return AuthenticatedUser(wallet=sub, vault_address=vault_address)
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión expirada; vuelve a firmar con tu wallet",
        ) from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token JWT inválido",
        ) from exc


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    settings: Settings = Depends(get_settings),
) -> AuthenticatedUser:
    """FastAPI dependency enforcing Bearer JWT authentication."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticación Bearer requerida",
        )
    return decode_access_token(credentials.credentials, settings)


def ip_and_wallet_rate_key(request: Request) -> str:
    """Rate limit key combining client IP and wallet identity (JWT sub or query param)."""
    ip = get_remote_address(request) or "unknown"
    wallet = "anon"

    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
        try:
            unverified = jwt.decode(token, options={"verify_signature": False})
            sub = unverified.get("sub")
            if isinstance(sub, str) and sub:
                wallet = sub
        except jwt.PyJWTError:
            wallet = "invalid_jwt"
    elif "wallet" in request.query_params:
        wallet = request.query_params["wallet"]

    return f"{ip}:{wallet}"


limiter = Limiter(key_func=ip_and_wallet_rate_key)
