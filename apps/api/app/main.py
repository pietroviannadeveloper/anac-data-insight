from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.dependencies import get_current_user, require_admin
from app.routes import (
    admin, ai, analyses, alert_rules, chat, comments,
    dashboard, health, scheduled, upload, pta, pta_mensal,
)
from app.routes import auth as auth_router

# ── Body size middleware ───────────────────────────────────────────────────────
_MAX_BODY_MB = settings.max_upload_size_mb + 5   # um pouco acima do limite de arquivo

class MaxBodySizeMiddleware:
    """Rejeita requests com body acima do limite antes de chegar nas rotas."""

    def __init__(self, app, max_bytes: int):
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            content_length = None
            for name, value in scope.get("headers", []):
                if name == b"content-length":
                    try:
                        content_length = int(value)
                    except ValueError:
                        pass
            if content_length and content_length > self.max_bytes:
                async def send_413(send):
                    await send({"type": "http.response.start", "status": 413,
                                "headers": [[b"content-type", b"application/json"]]})
                    import json
                    body = json.dumps({"detail": f"Requisição excede o limite de {_MAX_BODY_MB} MB."}).encode()
                    await send({"type": "http.response.body", "body": body})
                await send_413(send)
                return
        await self.app(scope, receive, send)


# ── Security headers middleware ───────────────────────────────────────────────
class SecurityHeadersMiddleware:
    """Adiciona headers de segurança em todas as respostas."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                security_headers = [
                    (b"x-content-type-options",  b"nosniff"),
                    (b"x-frame-options",          b"DENY"),
                    (b"x-xss-protection",         b"1; mode=block"),
                    (b"referrer-policy",          b"strict-origin-when-cross-origin"),
                    (b"permissions-policy",       b"geolocation=(), microphone=(), camera=()"),
                ]
                # HSTS apenas em produção
                if settings.environment != "development":
                    security_headers.append(
                        (b"strict-transport-security", b"max-age=31536000; includeSubDomains")
                    )
                headers.extend(security_headers)
                message = {**message, "headers": headers}
            await send(message)

        await self.app(scope, receive, send_with_headers)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Validação de configuração crítica
    _validate_settings()

    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    Path(settings.generated_dir).mkdir(parents=True, exist_ok=True)

    from app.db.database import create_tables
    create_tables()

    from app.services.scheduler import start as start_scheduler
    start_scheduler()
    yield
    from app.services.scheduler import stop as stop_scheduler
    stop_scheduler()


def _validate_settings() -> None:
    """Falha no startup se configurações críticas estiverem inseguras em produção."""
    if settings.environment == "production":
        insecure_keys = {
            "insecure-dev-secret-change-in-production",
            "secret",
            "changeme",
            "dev",
        }
        if settings.secret_key.lower() in insecure_keys or len(settings.secret_key) < 32:
            raise RuntimeError(
                "SECRET_KEY insegura detectada. "
                "Defina uma chave aleatória de pelo menos 32 caracteres no .env antes de iniciar em produção."
            )
        if not settings.auth_password or settings.auth_password == "Pietro007@":
            raise RuntimeError(
                "AUTH_PASSWORD padrão detectado em produção. "
                "Defina AUTH_PASSWORD no .env com uma senha segura."
            )


app = FastAPI(
    title="ANAC Data Insight API",
    version="0.1.0",
    description="API para análise de planilhas operacionais da aviação civil.",
    lifespan=lifespan,
)

# Prometheus metrics — expõe /metrics; silenciosamente desabilitado se lib ausente
try:
    from prometheus_fastapi_instrumentator import Instrumentator
    Instrumentator().instrument(app).expose(app, endpoint="/metrics")
except ImportError:
    pass

# ── Middlewares (ordem importa: último adicionado = primeiro executado) ────────
dev_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
]
origins = dev_origins if settings.environment == "development" else settings.cors_origins

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    MaxBodySizeMiddleware,
    max_bytes=_MAX_BODY_MB * 1024 * 1024,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_protected       = [Depends(get_current_user)]
_admin_protected = [Depends(require_admin)]

app.include_router(health.router)
app.include_router(auth_router.router,     prefix="/api/v1")
app.include_router(upload.router,          prefix="/api/v1", dependencies=_protected)
app.include_router(analyses.router,        prefix="/api/v1")
app.include_router(ai.router,              prefix="/api/v1", dependencies=_protected)
app.include_router(dashboard.router,       prefix="/api/v1")
app.include_router(admin.router,           prefix="/api/v1", dependencies=_admin_protected)
app.include_router(comments.router,        prefix="/api/v1")
app.include_router(alert_rules.router,     prefix="/api/v1")
app.include_router(chat.router,            prefix="/api/v1")
app.include_router(scheduled.router,       prefix="/api/v1")
app.include_router(pta.router,             prefix="/api/v1", dependencies=_admin_protected)
app.include_router(pta_mensal.router,      prefix="/api/v1", dependencies=_protected)


@app.exception_handler(404)
async def not_found_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=404, content={"detail": "Recurso não encontrado."})


@app.exception_handler(500)
async def server_error_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "Erro interno do servidor. Contate o suporte."},
    )
