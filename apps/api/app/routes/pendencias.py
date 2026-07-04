"""Central de pendências — tracked work items derived from atividades de Ciclos
e do PTA Mensal vigente (ambas as fontes compartilham os mesmos flags)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_analyst_or_admin
from app.db.database import get_db
from app.models.analysis import PendenciaHistorico, PendenciaTracking
from app.models.user import AuditLog, User
from app.services.pendencia_query import list_filter_options, pendencia_to_dict, query_pendencias, resolve_source_activity

router = APIRouter()

VALID_SEVERITIES = ("baixa", "media", "alta", "critica")
VALID_STATUSES = ("novo", "em_analise", "em_tratamento", "resolvido", "ignorado")
VALID_ORIGENS = ("ciclo", "pta_mensal")


class PendenciaUpdate(BaseModel):
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    resolution_note: Optional[str] = None


def _audit(db: Session, username: str, action: str, entity_type: str, entity_id: str, meta: dict | None = None) -> None:
    import json
    user = db.query(User).filter(User.username == username).first()
    db.add(AuditLog(
        user_id=user.id if user else None,
        username=username,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        extra_data=json.dumps(meta) if meta else None,
    ))
    db.commit()


@router.get("/pendencias/filtros", tags=["Pendências"])
async def get_filter_options(
    origem: Optional[str] = Query(None, description="'ciclo' ou 'pta_mensal' — omitido retorna ambas"),
    _: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Valores de gerência/cidade efetivamente disponíveis, para popular os
    filtros da UI (Central de Pendências e Briefing Executivo)."""
    if origem and origem not in VALID_ORIGENS:
        raise HTTPException(status_code=400, detail=f"Origem inválida. Use: {', '.join(VALID_ORIGENS)}")
    return list_filter_options(db, origem=origem)


@router.get("/pendencias", tags=["Pendências"])
async def list_pendencias(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    severity: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    gerencia: Optional[str] = Query(None),
    cidade: Optional[str] = Query(None),
    setor: Optional[str] = Query(None),
    tipo_ciclo: Optional[str] = Query(None),
    origem: Optional[str] = Query(None, description="'ciclo' ou 'pta_mensal' — omitido retorna ambas"),
    analysis_id: Optional[str] = Query(None),
    upload_id: Optional[str] = Query(None),
    _: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if origem and origem not in VALID_ORIGENS:
        raise HTTPException(status_code=400, detail=f"Origem inválida. Use: {', '.join(VALID_ORIGENS)}")

    rows = query_pendencias(
        db, severity=severity, status=status, gerencia=gerencia, cidade=cidade,
        setor=setor, tipo_ciclo=tipo_ciclo, origem=origem, analysis_id=analysis_id, upload_id=upload_id,
    )
    total = len(rows)
    total_pages = -(-total // page_size) if page_size else 1  # ceil div
    start = (page - 1) * page_size
    page_rows = rows[start:start + page_size]
    items = [pendencia_to_dict(p, a, o) for p, a, o in page_rows]

    return {"items": items, "total": total, "page": page, "page_size": page_size, "total_pages": max(total_pages, 1)}


@router.get("/pendencias/{pendencia_id}/historico", tags=["Pendências"])
async def get_pendencia_historico(
    pendencia_id: str,
    _: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not db.query(PendenciaTracking).filter(PendenciaTracking.id == pendencia_id).first():
        raise HTTPException(status_code=404, detail="Pendência não encontrada.")
    entries = (
        db.query(PendenciaHistorico)
        .filter(PendenciaHistorico.pendencia_id == pendencia_id)
        .order_by(PendenciaHistorico.created_at.asc())
        .all()
    )
    return [
        {
            "id": h.id,
            "username": h.username,
            "old_status": h.old_status,
            "new_status": h.new_status,
            "note": h.note,
            "created_at": h.created_at.isoformat() if h.created_at else None,
        }
        for h in entries
    ]


@router.patch("/pendencias/{pendencia_id}", tags=["Pendências"])
async def update_pendencia(
    pendencia_id: str,
    body: PendenciaUpdate,
    current_user: str = Depends(require_analyst_or_admin),
    db: Session = Depends(get_db),
):
    pendencia = db.query(PendenciaTracking).filter(PendenciaTracking.id == pendencia_id).first()
    if not pendencia:
        raise HTTPException(status_code=404, detail="Pendência não encontrada.")

    from app.models.analysis import utcnow

    if body.status is not None:
        if body.status not in VALID_STATUSES:
            raise HTTPException(status_code=400, detail=f"Status inválido. Use: {', '.join(VALID_STATUSES)}")
        old_status = pendencia.status
        pendencia.status = body.status
        db.add(PendenciaHistorico(
            pendencia_id=pendencia.id,
            username=current_user,
            old_status=old_status,
            new_status=body.status,
            note=body.resolution_note,
        ))
    if body.assigned_to is not None:
        pendencia.assigned_to = body.assigned_to
    if body.resolution_note is not None:
        pendencia.resolution_note = body.resolution_note
    pendencia.updated_at = utcnow()
    db.commit()
    db.refresh(pendencia)

    _audit(db, current_user, "pendencia_status_changed", "pendencia", pendencia.id, {
        "status": pendencia.status, "assigned_to": pendencia.assigned_to,
    })

    activity, origem = resolve_source_activity(db, pendencia)
    if not activity:
        raise HTTPException(status_code=404, detail="Atividade de origem não encontrada (pode ter sido removida).")
    return pendencia_to_dict(pendencia, activity, origem)
