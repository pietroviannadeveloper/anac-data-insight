from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.core.security import create_access_token, get_password_hash, verify_password
from app.schemas.auth import LoginRequest, Token

router = APIRouter()

# Hash the configured password once on first request (avoids storing plain text in memory)
_hashed_password: Optional[str] = None


def _get_hashed() -> str:
    global _hashed_password
    if _hashed_password is None:
        _hashed_password = get_password_hash(settings.auth_password)
    return _hashed_password


@router.post("/auth/token", response_model=Token, tags=["Auth"])
async def login(body: LoginRequest):
    """Autentica com usuário e senha e retorna um JWT."""
    if body.username != settings.auth_username or not verify_password(body.password, _get_hashed()):
        raise HTTPException(status_code=401, detail="Usuário ou senha incorretos.")
    return Token(access_token=create_access_token(body.username))
