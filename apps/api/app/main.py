from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.dependencies import get_current_user, require_admin
from app.routes import admin, ai, analyses, alert_rules, chat, comments, dashboard, health, scheduled, upload
from app.routes import auth as auth_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    Path(settings.generated_dir).mkdir(parents=True, exist_ok=True)
    from app.db.database import create_tables
    create_tables()
    # Start background scheduler
    from app.services.scheduler import start as start_scheduler
    start_scheduler()
    yield
    from app.services.scheduler import stop as stop_scheduler
    stop_scheduler()


app = FastAPI(
    title="ANAC Data Insight API",
    version="0.1.0",
    description="API para análise de planilhas operacionais da aviação civil.",
    lifespan=lifespan,
)

dev_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
]
origins = dev_origins if settings.environment == "development" else settings.cors_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_protected = [Depends(get_current_user)]
_admin_protected = [Depends(require_admin)]

app.include_router(health.router)
app.include_router(auth_router.router, prefix="/api/v1")
app.include_router(upload.router, prefix="/api/v1", dependencies=_protected)
app.include_router(analyses.router, prefix="/api/v1")
app.include_router(ai.router, prefix="/api/v1", dependencies=_protected)
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1", dependencies=_admin_protected)
app.include_router(comments.router, prefix="/api/v1")
app.include_router(alert_rules.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")
app.include_router(scheduled.router, prefix="/api/v1")


@app.exception_handler(404)
async def not_found_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=404, content={"detail": "Recurso não encontrado."})


@app.exception_handler(500)
async def server_error_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "Erro interno do servidor. Contate o suporte."},
    )
