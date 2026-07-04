"""Shared query layer for PendenciaTracking across both source types.

PendenciaTracking is polymorphic ("ciclo" -> CicloActivity, "pta_mensal" ->
PTAMensalActivity) with no DB-level FK, since the two source tables are
unrelated. This module centralizes the join-per-source + merge pattern so
routes (pendencias.py, dashboard.py) don't duplicate it.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models.analysis import CicloActivity, PendenciaHistorico, PendenciaTracking
from app.models.pta_mensal import PTAMensalActivity
from app.services.pendencia_rules import describe

PendenciaRow = tuple[PendenciaTracking, Any, str]  # (tracking, activity, origem)


def _ciclo_pendencias(
    db: Session, *, severity: Optional[str], status: Optional[str],
    gerencia: Optional[str], cidade: Optional[str], setor: Optional[str],
    tipo_ciclo: Optional[str], analysis_id: Optional[str],
) -> list[PendenciaRow]:
    q = (
        db.query(PendenciaTracking, CicloActivity)
        .join(CicloActivity, PendenciaTracking.source_id == CicloActivity.id)
        .filter(PendenciaTracking.source_type == "ciclo")
    )
    if severity:
        q = q.filter(PendenciaTracking.severity == severity)
    if status:
        q = q.filter(PendenciaTracking.status == status)
    if gerencia:
        q = q.filter(CicloActivity.gerencia.ilike(f"%{gerencia}%"))
    if cidade:
        q = q.filter(CicloActivity.cidade.ilike(f"%{cidade}%"))
    if setor:
        q = q.filter(CicloActivity.setor.ilike(f"%{setor}%"))
    if tipo_ciclo:
        q = q.filter(CicloActivity.tipo_ciclo == tipo_ciclo.upper())
    if analysis_id:
        q = q.filter(CicloActivity.analysis_id == analysis_id)
    return [(p, a, "ciclo") for p, a in q.all()]


def _pta_mensal_pendencias(
    db: Session, *, severity: Optional[str], status: Optional[str],
    gerencia: Optional[str], cidade: Optional[str], setor: Optional[str],
    tipo_ciclo: Optional[str], upload_id: Optional[str],
) -> list[PendenciaRow]:
    q = (
        db.query(PendenciaTracking, PTAMensalActivity)
        .join(PTAMensalActivity, PendenciaTracking.source_id == PTAMensalActivity.id)
        .filter(PendenciaTracking.source_type == "pta_mensal")
    )
    if severity:
        q = q.filter(PendenciaTracking.severity == severity)
    if status:
        q = q.filter(PendenciaTracking.status == status)
    if gerencia:
        q = q.filter(PTAMensalActivity.gerencia.ilike(f"%{gerencia}%"))
    if cidade:
        q = q.filter(PTAMensalActivity.cidade.ilike(f"%{cidade}%"))
    if setor:
        q = q.filter(PTAMensalActivity.setor.ilike(f"%{setor}%"))
    if tipo_ciclo:
        q = q.filter(PTAMensalActivity.tipo_ciclo == tipo_ciclo.upper())
    if upload_id:
        q = q.filter(PTAMensalActivity.upload_id == upload_id)
    return [(p, a, "pta_mensal") for p, a in q.all()]


def query_pendencias(
    db: Session, *,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    gerencia: Optional[str] = None,
    cidade: Optional[str] = None,
    setor: Optional[str] = None,
    tipo_ciclo: Optional[str] = None,
    origem: Optional[str] = None,  # "ciclo" | "pta_mensal" | None (both)
    analysis_id: Optional[str] = None,
    upload_id: Optional[str] = None,
) -> list[PendenciaRow]:
    """Returns (tracking, activity, origem) tuples across both sources, newest first.

    `analysis_id` only applies to the "ciclo" source and `upload_id` only to
    "pta_mensal" — passing one of them implicitly scopes the query to that
    source, since the other source has no such concept.
    """
    results: list[PendenciaRow] = []
    if origem in (None, "ciclo") and not upload_id:
        results += _ciclo_pendencias(
            db, severity=severity, status=status, gerencia=gerencia,
            cidade=cidade, setor=setor, tipo_ciclo=tipo_ciclo, analysis_id=analysis_id,
        )
    if origem in (None, "pta_mensal") and not analysis_id:
        results += _pta_mensal_pendencias(
            db, severity=severity, status=status, gerencia=gerencia,
            cidade=cidade, setor=setor, tipo_ciclo=tipo_ciclo, upload_id=upload_id,
        )
    results.sort(key=lambda row: row[0].created_at or datetime.min, reverse=True)
    return results


def pendencia_to_dict(tracking: PendenciaTracking, activity: Any, origem: str) -> dict:
    motivo, recomendacao = describe(activity)
    return {
        "id": tracking.id,
        "severity": tracking.severity,
        "status": tracking.status,
        "assigned_to": tracking.assigned_to,
        "resolution_note": tracking.resolution_note,
        "created_at": tracking.created_at.isoformat() if tracking.created_at else None,
        "updated_at": tracking.updated_at.isoformat() if tracking.updated_at else None,
        "motivo": motivo,
        "recomendacao": recomendacao,
        "origem": origem,
        "origem_id": activity.analysis_id if origem == "ciclo" else activity.upload_id,
        "atividade": activity.atividade,
        "gerencia": activity.gerencia,
        "setor": activity.setor,
        "cidade": activity.cidade,
        "mes": activity.mes,
        "tipo_ciclo": activity.tipo_ciclo,
        "status_atividade": activity.status,
    }


def resolve_source_activity(db: Session, tracking: PendenciaTracking) -> tuple[Any, str]:
    """Look up the activity (CicloActivity or PTAMensalActivity) a tracking row points to."""
    if tracking.source_type == "pta_mensal":
        activity = db.query(PTAMensalActivity).filter(PTAMensalActivity.id == tracking.source_id).first()
        return activity, "pta_mensal"
    activity = db.query(CicloActivity).filter(CicloActivity.id == tracking.source_id).first()
    return activity, "ciclo"


def list_filter_options(db: Session, *, origem: Optional[str] = None) -> dict:
    """Distinct gerencia/cidade values across the requested source(s), for
    populating filter dropdowns — so the UI offers only values that actually
    exist instead of free-text guessing."""
    gerencias: set[str] = set()
    cidades: set[str] = set()

    if origem in (None, "ciclo"):
        gerencias.update(
            g for (g,) in db.query(CicloActivity.gerencia).filter(CicloActivity.gerencia.isnot(None)).distinct().all()
        )
        cidades.update(
            c for (c,) in db.query(CicloActivity.cidade).filter(CicloActivity.cidade.isnot(None)).distinct().all()
        )
    if origem in (None, "pta_mensal"):
        gerencias.update(
            g for (g,) in db.query(PTAMensalActivity.gerencia).filter(PTAMensalActivity.gerencia.isnot(None)).distinct().all()
        )
        cidades.update(
            c for (c,) in db.query(PTAMensalActivity.cidade).filter(PTAMensalActivity.cidade.isnot(None)).distinct().all()
        )

    return {
        "gerencias": sorted(g.strip() for g in gerencias if g and g.strip()),
        "cidades": sorted(c.strip() for c in cidades if c and c.strip()),
    }


def delete_tracking_for_sources(db: Session, source_type: str, source_ids: list[str]) -> None:
    """Delete PendenciaTracking (+ history) rows for the given source ids.

    Must be called before deleting CicloActivity/PTAMensalActivity rows,
    since there's no DB-level FK to cascade this automatically.
    """
    if not source_ids:
        return
    tracking_ids = [
        row[0] for row in db.query(PendenciaTracking.id)
        .filter(PendenciaTracking.source_type == source_type, PendenciaTracking.source_id.in_(source_ids))
        .all()
    ]
    if not tracking_ids:
        return
    db.query(PendenciaHistorico).filter(PendenciaHistorico.pendencia_id.in_(tracking_ids)).delete(synchronize_session=False)
    db.query(PendenciaTracking).filter(PendenciaTracking.id.in_(tracking_ids)).delete(synchronize_session=False)
