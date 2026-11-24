"""Authentication schemas (SIWS)."""

from typing import Literal

from pydantic import BaseModel, Field


class NonceResponse(BaseModel):
    """Single-use SIWS challenge returned by GET /api/auth/nonce."""

    nonce: str
    message: str
    expires_at: str


class VerifyRequest(BaseModel):
    """Signed SIWS challenge submitted to POST /api/auth/verify."""

    wallet: str = Field(min_length=32, max_length=64)
    vault_address: str = Field(min_length=32, max_length=64)
    nonce: str = Field(min_length=8, max_length=128)
    signature: str = Field(min_length=16, max_length=256)


class VerifyResponse(BaseModel):
    """Short-lived HS256 JWT issued when SIWS signature and vault ownership verify."""

    access_token: str
    token_type: Literal["bearer"] = "bearer"  # noqa: S105
    expires_in: int
    wallet: str
    vault_address: str
