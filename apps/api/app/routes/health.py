from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter
from sqlalchemy import text

from app.core.config import settings
from app.db.database import SessionLocal

router = APIRouter()


@router.get("/health", tags=["Health"])
async def health_check():
    """Health check com status do banco de dados e filesystem."""
    checks: dict[str, str] = {}

    # Banco de dados
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        checks["database"] = "ok"
    except Exception as exc:
        checks["database"] = f"error: {exc}"

    # Filesystem — diretório de uploads
    try:
        upload_path = Path(settings.upload_dir)
        upload_path.mkdir(parents=True, exist_ok=True)
        test_file = upload_path / ".healthcheck"
        test_file.write_text("ok")
        test_file.unlink()
        checks["filesystem"] = "ok"
    except Exception as exc:
        checks["filesystem"] = f"error: {exc}"

    all_ok = all(v == "ok" for v in checks.values())

    return {
        "status": "ok" if all_ok else "degraded",
        "service": "ANAC Data Insight API",
        "version": "0.1.0",
        "environment": settings.environment,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "checks": checks,
    }
