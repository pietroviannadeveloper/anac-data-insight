"""
Scheduler Service
=================
APScheduler-based background job runner.
Jobs are loaded from the ScheduledReport table at startup and re-synced on changes.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)

_scheduler = AsyncIOScheduler(timezone="America/Sao_Paulo")


def get_scheduler() -> AsyncIOScheduler:
    return _scheduler


async def _run_report(report_id: str) -> None:
    """Execute one scheduled report: generate PDF and send by email."""
    from app.db.database import SessionLocal
    from app.models.scheduled import ScheduledReport
    from app.models.analysis import Analysis, AIAnalysis
    from app.routes.analyses import _build_alerts
    from app.services.pdf_report import generate_pdf
    from app.services.email_service import send_email

    db = SessionLocal()
    try:
        report = db.query(ScheduledReport).filter(ScheduledReport.id == report_id).first()
        if not report or not report.enabled:
            return

        # Find latest completed ciclos analysis matching gerencia filter
        q = db.query(Analysis).filter(
            Analysis.detected_type == "ciclos",
            Analysis.status == "completed",
        )
        if report.gerencia_filter:
            q = q.filter(Analysis.original_filename.ilike(f"%{report.gerencia_filter}%"))
        analysis = q.order_by(Analysis.created_at.desc()).first()

        if not analysis:
            logger.warning("Scheduled report %s: no analysis found", report.label)
            return

        ai_record = db.query(AIAnalysis).filter(AIAnalysis.analysis_id == analysis.id).first()
        ai_summary = None
        if ai_record:
            ai_summary = {
                "resumo_executivo":    ai_record.resumo_executivo,
                "principais_achados":  ai_record.principais_achados or [],
                "riscos_operacionais": ai_record.riscos_operacionais or [],
                "recomendacoes":       ai_record.recomendacoes or [],
            }

        alerts_raw = _build_alerts(analysis.indicators or {}, "ciclos")
        alerts = [{"type": a.type, "category": a.category, "message": a.message, "count": a.count} for a in alerts_raw]

        pdf_bytes = generate_pdf(
            filename=str(analysis.original_filename),
            created_at=analysis.created_at,
            total_rows=int(analysis.total_rows or 0),
            indicators=analysis.indicators,
            alerts=alerts,
            ai_summary=ai_summary,
            analysis_type="ciclos",
        )

        import tempfile, pathlib
        tmp = pathlib.Path(tempfile.mktemp(suffix=".pdf"))
        tmp.write_bytes(pdf_bytes)

        recipients = report.recipient_emails or []
        if recipients:
            now_str = datetime.now().strftime("%d/%m/%Y")
            await send_email(
                to=recipients,
                subject=f"[ANAC Data Insight] Relatório agendado — {report.label} — {now_str}",
                html=f"<p>Relatório automático: <strong>{report.label}</strong></p>"
                     f"<p>Análise: {analysis.original_filename}</p>"
                     f"<p>Gerado em: {now_str}</p>",
                attachment_path=str(tmp),
                attachment_name=f"{report.label}_{now_str}.pdf",
            )
            tmp.unlink(missing_ok=True)

        report.last_run = datetime.now(timezone.utc)
        db.commit()
        logger.info("Scheduled report '%s' completed", report.label)

    except Exception as exc:
        logger.error("Scheduled report %s failed: %s", report_id, exc)
    finally:
        db.close()


def sync_jobs() -> None:
    """Remove all existing jobs and reload from DB."""
    from app.db.database import SessionLocal
    from app.models.scheduled import ScheduledReport

    db = SessionLocal()
    try:
        _scheduler.remove_all_jobs()
        reports = db.query(ScheduledReport).filter(ScheduledReport.enabled == 1).all()
        for r in reports:
            try:
                trigger = CronTrigger.from_crontab(r.cron_expression, timezone="America/Sao_Paulo")
                _scheduler.add_job(
                    _run_report,
                    trigger=trigger,
                    args=[r.id],
                    id=r.id,
                    replace_existing=True,
                )
                logger.info("Scheduled job loaded: %s (%s)", r.label, r.cron_expression)
            except Exception as exc:
                logger.warning("Invalid cron for report %s: %s", r.label, exc)
    finally:
        db.close()


def start() -> None:
    if not _scheduler.running:
        _scheduler.start()
        sync_jobs()
        logger.info("APScheduler started")


def stop() -> None:
    if _scheduler.running:
        _scheduler.shutdown(wait=False)
