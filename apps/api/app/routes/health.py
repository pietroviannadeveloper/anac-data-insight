from fastapi import APIRouter
from datetime import datetime
from app.core.config import settings

router = APIRouter()


@router.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "ok",
        "service": "ANAC Data Insight API",
        "version": "0.1.0",
        "timestamp": datetime.utcnow().isoformat(),
        "environment": settings.environment,
    }
