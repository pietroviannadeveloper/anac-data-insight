from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.rate_limit import rate_limit

from app.core.dependencies import get_current_user
from app.core.security import create_access_token, get_password_hash, verify_password
from app.db.database import get_db
from app.models.user import AccessLog, User
from app.schemas.auth import GoogleLoginRequest, LoginRequest, Token

router = APIRouter()

_COOKIE_NAME     = "anac_token"
_ROLE_COOKIE     = "anac_role"
_USER_COOKIE     = "anac_username"
_COOKIE_MAX_AGE  = 8 * 3600  # 8 horas


def _set_auth_cookies(response: Response, token: str, role: str, username: str, secure: bool = False) -> None:
    response.set_cookie(
        key=_COOKIE_NAME,
        value=token,
        max_age=_COOKIE_MAX_AGE,
        path="/",
        httponly=True,
        samesite="lax",
        secure=secure,
    )
    # Non-httpOnly: frontend lê para renderização condicional
    for key, value in ((_ROLE_COOKIE, role), (_USER_COOKIE, username)):
        response.set_cookie(
            key=key,
            value=value,
            max_age=_COOKIE_MAX_AGE,
            path="/",
            httponly=False,
            samesite="lax",
            secure=secure,
        )


def _clear_auth_cookies(response: Response) -> None:
    for key in (_COOKIE_NAME, _ROLE_COOKIE, _USER_COOKIE):
        response.delete_cookie(key, path="/", samesite="lax")


def _log_access(db: Session, username: str, action: str, request: Request) -> None:
    ip = request.client.host if request.client else None
    db.add(AccessLog(username=username, action=action, ip_address=ip))
    db.commit()


@router.post("/auth/token", response_model=Token, tags=["Auth"])
async def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    _rl: None = Depends(rate_limit(max_requests=10, window_seconds=60)),
):
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
    _set_auth_cookies(response, token, user.role, user.username, secure=secure)

    return Token(access_token=token, role=user.role)


@router.post("/auth/google", response_model=Token, tags=["Auth"])
async def login_google(
    body: GoogleLoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    _rl: None = Depends(rate_limit(max_requests=10, window_seconds=60)),
):
    """Autentica via Google Identity Services. A conta precisa já existir
    na plataforma (vinculada pelo e-mail) — não há autocadastro."""
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token as google_id_token

    from app.core.config import settings
    from datetime import datetime, timezone

    if not settings.google_client_id:
        raise HTTPException(status_code=503, detail="Login com Google não está configurado.")

    try:
        idinfo = google_id_token.verify_oauth2_token(
            body.credential, google_requests.Request(), settings.google_client_id
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="Token do Google inválido.")

    email = idinfo.get("email")
    if not email or not idinfo.get("email_verified"):
        raise HTTPException(status_code=401, detail="E-mail do Google não verificado.")

    user = db.query(User).filter(User.email.ilike(email)).first()
    if not user or not user.is_active:
        _log_access(db, email, "login_failed", request)
        raise HTTPException(status_code=403, detail="Conta não cadastrada na plataforma. Contate o administrador.")

    user.last_login = datetime.now(timezone.utc)
    db.commit()
    _log_access(db, user.username, "login_success", request)

    token = create_access_token(user.username, role=user.role)
    secure = settings.environment == "production"
    _set_auth_cookies(response, token, user.role, user.username, secure=secure)

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


class ChangePasswordBody(BaseModel):
    current_password: str
    new_password: str


@router.post("/auth/change-password", tags=["Auth"])
async def change_password(
    body: ChangePasswordBody,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Permite ao usuário autenticado trocar a própria senha."""
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="A nova senha deve ter no mínimo 6 caracteres.")
    user = db.query(User).filter(User.username == current_user).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Senha atual incorreta.")
    user.password_hash = get_password_hash(body.new_password)
    db.commit()
    return {"ok": True}
