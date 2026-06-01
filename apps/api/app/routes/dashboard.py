from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.analysis import Analysis, CicloActivity

router = APIRouter()


def _ciclo_base_query(
    db: Session,
    analysis_id: Optional[str],
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
):
    """Base query for CicloActivity, optionally filtered by analysis and period."""
    q = db.query(CicloActivity)
    if analysis_id and analysis_id != "all":
        q = q.filter(CicloActivity.analysis_id == analysis_id)
    elif date_from or date_to:
        # Filter via Analysis.created_at join
        ids_q = db.query(Analysis.id)
        if date_from:
            ids_q = ids_q.filter(Analysis.created_at >= date_from)
        if date_to:
            ids_q = ids_q.filter(Analysis.created_at <= date_to)
        valid_ids = [r[0] for r in ids_q.all()]
        q = q.filter(CicloActivity.analysis_id.in_(valid_ids))
    return q


def _parse_date(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value).replace(tzinfo=timezone.utc)
    except ValueError:
        return None


@router.get("/dashboard/summary", tags=["Dashboard"])
async def get_dashboard_summary(
    analysis_id: Optional[str] = Query(None, description="ID da análise ou 'all'"),
    date_from: Optional[str] = Query(None, description="Data inicial ISO (ex: 2026-01-01)"),
    date_to: Optional[str] = Query(None, description="Data final ISO (ex: 2026-12-31)"),
    _: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retorna dados agregados para o dashboard. Aceita filtro por análise e período."""
    dt_from = _parse_date(date_from)
    dt_to = _parse_date(date_to)
    base = _ciclo_base_query(db, analysis_id, dt_from, dt_to)

    total_activities = base.count()

    # Status breakdown
    status_rows = (
        base.with_entities(CicloActivity.status, func.count(CicloActivity.id))
        .group_by(CicloActivity.status)
        .all()
    )
    status_map = {s: c for s, c in status_rows}
    realizadas = status_map.get("realizado", 0)
    agendadas = status_map.get("agendado", 0)
    sem_agendamento = status_map.get("sem-agendamento", 0)

    activities_by_status = [
        {"status": "Realizado", "value": realizadas, "key": "realizado"},
        {"status": "Agendado", "value": agendadas, "key": "agendado"},
        {"status": "Sem agendamento", "value": sem_agendamento, "key": "sem-agendamento"},
    ]

    # ── Tipos de atividades realizadas ─────────────────────────────────────
    # Usa campo `atividade` quando preenchido; cai para `setor` como fallback
    has_atividade = (
        base.filter(
            CicloActivity.atividade.isnot(None),
            CicloActivity.atividade != "",
        ).count() > 0
    )

    if has_atividade:
        type_field = CicloActivity.atividade
        type_label = "Tipo de Atividade (O135)"
        atividade_disponivel = True
    else:
        type_field = CicloActivity.setor
        type_label = "Setor"
        atividade_disponivel = False

    type_rows = (
        base.with_entities(
            type_field.label("tipo"),
            CicloActivity.status,
            func.count(CicloActivity.id).label("n"),
        )
        .filter(type_field.isnot(None))
        .group_by(type_field, CicloActivity.status)
        .order_by(func.count(CicloActivity.id).desc())
        .all()
    )

    # Consolidate: per tipo → {realizado, agendado, sem_agendamento, total}
    type_agg: dict[str, dict] = {}
    for tipo, status, n in type_rows:
        if tipo not in type_agg:
            type_agg[tipo] = {"tipo": tipo, "realizado": 0, "agendado": 0, "sem_agendamento": 0, "total": 0}
        key = "sem_agendamento" if status == "sem-agendamento" else status
        type_agg[tipo][key] = n
        type_agg[tipo]["total"] += n

    activities_by_type = sorted(type_agg.values(), key=lambda x: -x["total"])
    type_field_label = type_label
    # atividade_disponivel already set above

    # ── Métricas das análises ciclo ──────────────────────────────────────
    ciclo_q = db.query(Analysis).filter(
        Analysis.detected_type == "ciclos",
        Analysis.indicators.isnot(None),
    )
    if analysis_id and analysis_id != "all":
        ciclo_q = ciclo_q.filter(Analysis.id == analysis_id)
    ciclo_analyses = ciclo_q.all()

    exec_rates = [
        a.indicators.get("taxa_execucao", 0)
        for a in ciclo_analyses
        if isinstance(a.indicators, dict)
    ]
    average_execution_rate = round(sum(exec_rates) / len(exec_rates), 1) if exec_rates else 0.0
    critical_pending_items = sum(
        a.indicators.get("pendencias_criticas", 0)
        for a in ciclo_analyses
        if isinstance(a.indicators, dict)
    )
    total_analyses = ciclo_q.count()

    # ── Execução por mês ──────────────────────────────────────────────────
    six_months_ago = datetime.now(timezone.utc) - timedelta(days=180)
    month_q = db.query(Analysis.created_at).filter(Analysis.created_at >= six_months_ago)
    if analysis_id and analysis_id != "all":
        month_q = month_q.filter(Analysis.id == analysis_id)
    monthly: dict[str, int] = defaultdict(int)
    for (dt,) in month_q.all():
        if dt:
            monthly[dt.strftime("%Y-%m")] += 1
    execution_by_month = [{"month": k, "count": v} for k, v in sorted(monthly.items())]

    # ── Empresas (regulado) ──────────────────────────────────────────────
    top_companies = [
        {"empresa": r, "total": c}
        for r, c in (
            base.with_entities(CicloActivity.regulado, func.count(CicloActivity.id).label("n"))
            .filter(CicloActivity.regulado.isnot(None))
            .group_by(CicloActivity.regulado)
            .order_by(func.count(CicloActivity.id).desc())
            .limit(10)
            .all()
        )
    ]

    bottom_companies = [
        {"empresa": r, "total": c}
        for r, c in (
            base.with_entities(CicloActivity.regulado, func.count(CicloActivity.id).label("n"))
            .filter(CicloActivity.regulado.isnot(None))
            .group_by(CicloActivity.regulado)
            .order_by(func.count(CicloActivity.id).asc())
            .limit(10)
            .all()
        )
    ]

    pending_by_company = [
        {"empresa": r, "pendentes": c}
        for r, c in (
            base.with_entities(CicloActivity.regulado, func.count(CicloActivity.id).label("n"))
            .filter(
                CicloActivity.regulado.isnot(None),
                CicloActivity.status == "sem-agendamento",
            )
            .group_by(CicloActivity.regulado)
            .order_by(func.count(CicloActivity.id).desc())
            .limit(15)
            .all()
        )
    ]

    # ── Detalhes pendentes O135 ──────────────────────────────────────────
    pending_items = (
        base.filter(CicloActivity.status == "sem-agendamento")
        .order_by(CicloActivity.item)
        .limit(50)
        .all()
    )
    pending_detail = [
        {
            "item": p.item,
            "regulado": p.regulado,
            "gerencia": p.gerencia,
            "setor": p.setor,
            "prioridade": p.prioridade,
            "sem_giaso": p.sem_giaso,
            "sem_pcdp": p.sem_pcdp,
            "sem_processo": p.sem_processo,
        }
        for p in pending_items
    ]

    # ── Top alertas ───────────────────────────────────────────────────────
    agg: dict[str, int] = defaultdict(int)
    for a in ciclo_analyses:
        ind = a.indicators or {}
        if isinstance(ind, dict):
            for key in ("sem_giaso", "pcdp_duplicada", "multiplas_pcdps", "sem_pcdp",
                        "sem_processo", "locais_indefinidos", "sem_agendamento"):
                agg[key] += ind.get(key, 0)

    _labels = {
        "sem_giaso": "Sem GIASO", "pcdp_duplicada": "PCDP Duplicada",
        "multiplas_pcdps": "Múltiplas PCDPs", "sem_pcdp": "Sem PCDP",
        "sem_processo": "Sem Processo", "locais_indefinidos": "Local Indefinido",
        "sem_agendamento": "Sem Agendamento",
    }
    top_alerts = sorted(
        [{"key": k, "label": _labels.get(k, k), "count": v} for k, v in agg.items() if v > 0],
        key=lambda x: x["count"], reverse=True,
    )[:5]

    return {
        "total_analyses": total_analyses,
        "total_activities": total_activities,
        "realizadas": realizadas,
        "agendadas": agendadas,
        "sem_agendamento": sem_agendamento,
        "average_execution_rate": average_execution_rate,
        "critical_pending_items": critical_pending_items,
        "activities_by_status": activities_by_status,
        "activities_by_type": activities_by_type,
        "type_field_label": type_field_label,
        "atividade_disponivel": atividade_disponivel,
        "execution_by_month": execution_by_month,
        "top_companies": top_companies,
        "bottom_companies": bottom_companies,
        "pending_by_company": pending_by_company,
        "pending_detail": pending_detail,
        "top_alerts": top_alerts,
    }
