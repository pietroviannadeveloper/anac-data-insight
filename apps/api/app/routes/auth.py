from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.core.security import create_access_token, get_password_hash, verify_password
from app.db.database import get_db
from app.models.user import AccessLog, User
from app.schemas.auth import LoginRequest, Token

router = APIRouter()

_COOKIE_NAME = "anac_token"
_ROLE_COOKIE = "anac_role"
_COOKIE_MAX_AGE = 8 * 3600  # 8 horas


def _set_auth_cookies(response: Response, token: str, role: str, secure: bool = False) -> None:
    response.set_cookie(
        key=_COOKIE_NAME,
        value=token,
        max_age=_COOKIE_MAX_AGE,
        path="/",
        httponly=True,
        samesite="lax",
        secure=secure,
    )
    # Non-httpOnly cookie so frontend JS can read the role for UI rendering
    response.set_cookie(
        key=_ROLE_COOKIE,
        value=role,
        max_age=_COOKIE_MAX_AGE,
        path="/",
        httponly=False,
        samesite="lax",
        secure=secure,
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(_COOKIE_NAME, path="/", samesite="lax")
    response.delete_cookie(_ROLE_COOKIE, path="/", samesite="lax")


def _log_access(db: Session, username: str, action: str, request: Request) -> None:
    ip = request.client.host if request.client else None
    db.add(AccessLog(username=username, action=action, ip_address=ip))
    db.commit()


@router.post("/auth/token", response_model=Token, tags=["Auth"])
async def login(body: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    """Autentica com usuário e senha, retorna JWT e seta cookie httpOnly."""
    from app.core.config import settings
    from datetime import datetime, timezone

    user = db.query(User).filter(User.username == body.username).first()

    if not user or not user.is_active or not verify_password(body.password, user.password_hash):
        _log_access(db, body.username, "login_failed", request)
        raise HTTPException(status_code=401, detail="Usuário ou senha incorretos.")

    user.last_login = datetime.now(timezone.utc)
    db.commit()
    _log_access(db, body.username, "login_success", request)

    token = create_access_token(body.username, role=user.role)
    secure = settings.environment == "production"
    _set_auth_cookies(response, token, user.role, secure=secure)

    return Token(access_token=token, role=user.role)


@router.post("/auth/logout", tags=["Auth"])
async def logout(response: Response):
    """Remove os cookies de autenticação."""
    _clear_auth_cookies(response)
    return {"ok": True}


@router.get("/auth/me", tags=["Auth"])
async def me(current_user: str = Depends(get_current_user), db: Session = Depends(get_db)):
    """Retorna o perfil do usuário autenticado."""
    user = db.query(User).filter(User.username == current_user).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    return {"username": user.username, "role": user.role, "is_active": user.is_active}
