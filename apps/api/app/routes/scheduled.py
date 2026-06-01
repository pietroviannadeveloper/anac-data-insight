"""CRUD for ScheduledReport."""

from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import require_analyst_or_admin
from app.db.database import get_db
from app.models.scheduled import ScheduledReport

router = APIRouter()

CRON_EXAMPLES = {
    "Diariamente às 08h":          "0 8 * * *",
    "Todo dia 1 do mês às 08h":    "0 8 1 * *",
    "Toda segunda-feira às 07h":   "0 7 * * 1",
    "Toda sexta-feira às 17h":     "0 17 * * 5",
    "Semanal (segunda, 08h)":      "0 8 * * 1",
}


class ScheduleCreate(BaseModel):
    label: str
    cron_expression: str
    gerencia_filter: Optional[str] = None
    recipient_emails: list[str] = []
    enabled: bool = True


class ScheduleUpdate(BaseModel):
    label: Optional[str] = None
    cron_expression: Optional[str] = None
    gerencia_filter: Optional[str] = None
    recipient_emails: Optional[list[str]] = None
    enabled: Optional[bool] = None


def _to_dict(r: ScheduledReport) -> dict:
    return {
        "id":               r.id,
        "label":            r.label,
        "cron_expression":  r.cron_expression,
        "gerencia_filter":  r.gerencia_filter,
        "recipient_emails": r.recipient_emails or [],
        "enabled":          bool(r.enabled),
        "created_by":       r.created_by,
        "created_at":       r.created_at.isoformat() if r.created_at else None,
        "last_run":         r.last_run.isoformat() if r.last_run else None,
    }


@router.get("/scheduled-reports", tags=["Scheduled"])
async def list_scheduled(
    _: str = Depends(require_analyst_or_admin),
    db: Session = Depends(get_db),
):
    items = db.query(ScheduledReport).order_by(ScheduledReport.created_at.desc()).all()
    return {"items": [_to_dict(r) for r in items], "cron_examples": CRON_EXAMPLES}


@router.post("/scheduled-reports", tags=["Scheduled"], status_code=201)
async def create_scheduled(
    body: ScheduleCreate,
    current_user: str = Depends(require_analyst_or_admin),
    db: Session = Depends(get_db),
):
    from apscheduler.triggers.cron import CronTrigger
    try:
        CronTrigger.from_crontab(body.cron_expression)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Expressão cron inválida: '{body.cron_expression}'")

    r = ScheduledReport(
        label=body.label,
        cron_expression=body.cron_expression,
        gerencia_filter=body.gerencia_filter,
        recipient_emails=body.recipient_emails,
        enabled=1 if body.enabled else 0,
        created_by=current_user,
    )
    db.add(r)
    db.commit()
    db.refresh(r)

    # Sync the scheduler
    from app.services.scheduler import sync_jobs
    sync_jobs()
    return _to_dict(r)


@router.patch("/scheduled-reports/{report_id}", tags=["Scheduled"])
async def update_scheduled(
    report_id: str,
    body: ScheduleUpdate,
    _: str = Depends(require_analyst_or_admin),
    db: Session = Depends(get_db),
):
    r = db.query(ScheduledReport).filter(ScheduledReport.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Relatório agendado não encontrado.")
    if body.label is not None:            r.label = body.label
    if body.cron_expression is not None:
        from apscheduler.triggers.cron import CronTrigger
        try:
            CronTrigger.from_crontab(body.cron_expression)
        except Exception:
            raise HTTPException(status_code=400, detail="Expressão cron inválida.")
        r.cron_expression = body.cron_expression
    if body.gerencia_filter is not None:  r.gerencia_filter = body.gerencia_filter
    if body.recipient_emails is not None: r.recipient_emails = body.recipient_emails
    if body.enabled is not None:          r.enabled = 1 if body.enabled else 0
    db.commit()
    db.refresh(r)

    from app.services.scheduler import sync_jobs
    sync_jobs()
    return _to_dict(r)


@router.delete("/scheduled-reports/{report_id}", status_code=204, tags=["Scheduled"])
async def delete_scheduled(
    report_id: str,
    _: str = Depends(require_analyst_or_admin),
    db: Session = Depends(get_db),
):
    r = db.query(ScheduledReport).filter(ScheduledReport.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Relatório agendado não encontrado.")
    db.delete(r)
    db.commit()
    from app.services.scheduler import sync_jobs
    sync_jobs()


@router.post("/scheduled-reports/{report_id}/run-now", tags=["Scheduled"])
async def run_now(
    report_id: str,
    _: str = Depends(require_analyst_or_admin),
    db: Session = Depends(get_db),
):
    """Dispara manualmente um relatório agendado."""
    from app.services.scheduler import _run_report
    r = db.query(ScheduledReport).filter(ScheduledReport.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Relatório agendado não encontrado.")
    await _run_report(report_id)
    return {"detail": "Relatório executado com sucesso."}
