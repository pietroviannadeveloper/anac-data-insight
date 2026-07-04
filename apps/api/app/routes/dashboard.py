from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.analysis import Analysis, CicloActivity
from app.models.pta import PTASnapshot
from app.models.pta_mensal import PTAMensalActivity
from app.services.pendencia_query import query_pendencias

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


# PTA Mensal "vigente" year — matches the hardcoded year in routes/pta_mensal.py.
PTA_CURRENT_YEAR = 2026


def _pta_mensal_status_counts(
    db: Session, gerencia: Optional[str], cidade: Optional[str], tipo_ciclo: Optional[str],
) -> dict[str, int]:
    q = db.query(PTAMensalActivity)
    if gerencia:
        q = q.filter(PTAMensalActivity.gerencia.ilike(f"%{gerencia}%"))
    if cidade:
        q = q.filter(PTAMensalActivity.cidade.ilike(f"%{cidade}%"))
    if tipo_ciclo:
        q = q.filter(PTAMensalActivity.tipo_ciclo == tipo_ciclo.upper())
    rows = q.with_entities(PTAMensalActivity.status, func.count(PTAMensalActivity.id)).group_by(PTAMensalActivity.status).all()
    return {s: c for s, c in rows}


def _previous_year_execution_rate(db: Session, tipo_ciclo: Optional[str]) -> Optional[float]:
    """Weighted average taxa_execucao from PTA Histórico for the year before PTA_CURRENT_YEAR.

    Pre-aggregated per ano/tipo_ciclo (PTASnapshot has no per-activity rows), so this
    comparison cannot be narrowed by gerência/cidade.
    """
    q = db.query(PTASnapshot).filter(PTASnapshot.year == PTA_CURRENT_YEAR - 1)
    if tipo_ciclo:
        q = q.filter(PTASnapshot.tipo_ciclo == tipo_ciclo.upper())
    weighted = [
        (s.indicators.get("taxa_execucao", 0), s.total_rows or 0)
        for s in q.all() if isinstance(s.indicators, dict)
    ]
    weighted = [(rate, weight) for rate, weight in weighted if weight > 0]
    if not weighted:
        return None
    total_weight = sum(w for _, w in weighted)
    return round(sum(r * w for r, w in weighted) / total_weight, 1)


VALID_BRIEFING_ORIGENS = ("ciclo", "pta_mensal")


@router.get("/dashboard/briefing", tags=["Dashboard"])
async def get_executive_briefing(
    analysis_id: Optional[str] = Query(None, description="ID da análise ou 'all'"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    gerencia: Optional[str] = Query(None),
    cidade: Optional[str] = Query(None),
    tipo_ciclo: Optional[str] = Query(None),
    origem: Optional[str] = Query(None, description="'ciclo' ou 'pta_mensal' — omitido combina ambas"),
    incluir_historico: bool = Query(True, description="Se a comparação com o PTA Histórico deve ser calculada"),
    approval_status: Optional[str] = Query(None, description="'oficial' = aprovado; 'rascunho' = qualquer não-aprovado"),
    _: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Agrega KPIs, pendências críticas e comparação com o ano anterior (PTA Histórico)
    para um briefing executivo pronto para reunião. Combina dados de Ciclos (uploads
    via /upload) e do PTA Mensal vigente, ou pode ser restrito a uma única origem."""
    if origem and origem not in VALID_BRIEFING_ORIGENS:
        raise HTTPException(status_code=400, detail=f"Origem inválida. Use: {', '.join(VALID_BRIEFING_ORIGENS)}")

    dt_from = _parse_date(date_from)
    dt_to = _parse_date(date_to)

    # ── Ciclos ────────────────────────────────────────────────────────────
    ciclo_status: dict[str, int] = {}
    if origem in (None, "ciclo"):
        base = _ciclo_base_query(db, analysis_id, dt_from, dt_to)
        if gerencia:
            base = base.filter(CicloActivity.gerencia.ilike(f"%{gerencia}%"))
        if cidade:
            base = base.filter(CicloActivity.cidade.ilike(f"%{cidade}%"))
        if tipo_ciclo:
            base = base.filter(CicloActivity.tipo_ciclo == tipo_ciclo.upper())
        if approval_status:
            analysis_ids_q = db.query(Analysis.id)
            if approval_status == "oficial":
                analysis_ids_q = analysis_ids_q.filter(Analysis.approval_status == "aprovado")
            else:
                analysis_ids_q = analysis_ids_q.filter(Analysis.approval_status != "aprovado")
            base = base.filter(CicloActivity.analysis_id.in_([r[0] for r in analysis_ids_q.all()]))
        ciclo_status = {s: c for s, c in base.with_entities(CicloActivity.status, func.count(CicloActivity.id)).group_by(CicloActivity.status).all()}

    # ── PTA Mensal (vigente) ─────────────────────────────────────────────
    pta_status = _pta_mensal_status_counts(db, gerencia, cidade, tipo_ciclo) if origem in (None, "pta_mensal") else {}

    realizadas = ciclo_status.get("realizado", 0) + pta_status.get("realizado", 0)
    agendadas = ciclo_status.get("agendado", 0) + pta_status.get("agendado", 0)
    sem_agendamento = ciclo_status.get("sem-agendamento", 0) + pta_status.get("sem-agendamento", 0)
    total_activities = realizadas + agendadas + sem_agendamento
    avg_exec_rate = round(realizadas / total_activities * 100, 1) if total_activities else None

    previous_rate = _previous_year_execution_rate(db, tipo_ciclo) if incluir_historico else None
    delta = round(avg_exec_rate - previous_rate, 1) if avg_exec_rate is not None and previous_rate is not None else None

    # ── Pendências críticas ativas (combinando Ciclos + PTA Mensal) ───────
    all_critical = query_pendencias(
        db, severity="critica", gerencia=gerencia, cidade=cidade, tipo_ciclo=tipo_ciclo, origem=origem,
        analysis_id=(analysis_id if analysis_id and analysis_id != "all" else None),
    )
    active_critical = [row for row in all_critical if row[0].status not in ("resolvido", "ignorado")]

    pendencias_criticas_total = len(active_critical)
    pendencias_items = [
        {
            "id": p.id,
            "origem": o,
            "gerencia": a.gerencia,
            "cidade": a.cidade,
            "atividade": a.atividade,
            "status": p.status,
        }
        for p, a, o in active_critical[:10]
    ]

    gerencia_counts: dict[str, int] = defaultdict(int)
    cidade_counts: dict[str, int] = defaultdict(int)
    for _p, a, _o in active_critical:
        if a.gerencia:
            gerencia_counts[a.gerencia] += 1
        if a.cidade:
            cidade_counts[a.cidade] += 1
    gerencias_atencao = [
        {"gerencia": g, "criticas": c}
        for g, c in sorted(gerencia_counts.items(), key=lambda kv: -kv[1])[:5]
    ]
    cidades_atencao = [
        {"cidade": c, "criticas": n}
        for c, n in sorted(cidade_counts.items(), key=lambda kv: -kv[1])[:5]
    ]

    return {
        "kpis": {
            "total_activities": total_activities,
            "realizadas": realizadas,
            "agendadas": agendadas,
            "sem_agendamento": sem_agendamento,
            "average_execution_rate": avg_exec_rate,
            "pendencias_criticas": pendencias_criticas_total,
        },
        "comparison": {
            "average_execution_rate_previous": previous_rate,
            "delta": delta,
        },
        "pendencias_criticas": {
            "total": pendencias_criticas_total,
            "items": pendencias_items,
        },
        "gerencias_atencao": gerencias_atencao,
        "cidades_atencao": cidades_atencao,
    }
