"""CRUD for AlertRule and read for AlertEvent."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_analyst_or_admin
from app.db.database import get_db
from app.models.analysis import AlertRule, AlertEvent, Analysis

router = APIRouter()


class RuleCreate(BaseModel):
    label: str
    metric: str
    operator: str           # lt | gt | lte | gte | eq
    threshold: int
    analysis_types: list[str] = ["ciclos"]
    enabled: bool = True


class RuleUpdate(BaseModel):
    label: Optional[str] = None
    metric: Optional[str] = None
    operator: Optional[str] = None
    threshold: Optional[int] = None
    analysis_types: Optional[list[str]] = None
    enabled: Optional[bool] = None


VALID_OPERATORS = {"lt", "gt", "lte", "gte", "eq"}

AVAILABLE_METRICS = {
    "ciclos": [
        "taxa_execucao", "taxa_agendamento", "realizadas", "agendadas",
        "sem_agendamento", "sem_giaso", "sem_pcdp", "sem_processo",
        "locais_indefinidos", "pendencias_criticas", "pcdp_duplicada", "multiplas_pcdps",
    ],
    "generic": ["total_rows", "total_columns", "duplicate_rows"],
    "pdf":     ["pages", "word_count"],
}


def _rule_to_dict(r: AlertRule) -> dict:
    return {
        "id": r.id,
        "label": r.label,
        "metric": r.metric,
        "operator": r.operator,
        "threshold": r.threshold,
        "analysis_types": r.analysis_types or [],
        "enabled": bool(r.enabled),
        "created_by": r.created_by,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


@router.get("/alert-rules", tags=["Alert Rules"])
async def list_rules(
    _: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rules = db.query(AlertRule).order_by(AlertRule.created_at.desc()).all()
    return {"items": [_rule_to_dict(r) for r in rules], "available_metrics": AVAILABLE_METRICS}


@router.post("/alert-rules", tags=["Alert Rules"], status_code=201)
async def create_rule(
    body: RuleCreate,
    current_user: str = Depends(require_analyst_or_admin),
    db: Session = Depends(get_db),
):
    if body.operator not in VALID_OPERATORS:
        raise HTTPException(status_code=400, detail=f"Operador inválido. Use: {', '.join(VALID_OPERATORS)}")
    rule = AlertRule(
        label=body.label,
        metric=body.metric,
        operator=body.operator,
        threshold=body.threshold,
        analysis_types=body.analysis_types,
        enabled=1 if body.enabled else 0,
        created_by=current_user,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return _rule_to_dict(rule)


@router.patch("/alert-rules/{rule_id}", tags=["Alert Rules"])
async def update_rule(
    rule_id: str,
    body: RuleUpdate,
    _: str = Depends(require_analyst_or_admin),
    db: Session = Depends(get_db),
):
    rule = db.query(AlertRule).filter(AlertRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Regra não encontrada.")
    if body.label is not None:        rule.label = body.label
    if body.metric is not None:       rule.metric = body.metric
    if body.operator is not None:
        if body.operator not in VALID_OPERATORS:
            raise HTTPException(status_code=400, detail="Operador inválido.")
        rule.operator = body.operator
    if body.threshold is not None:    rule.threshold = body.threshold
    if body.analysis_types is not None: rule.analysis_types = body.analysis_types
    if body.enabled is not None:      rule.enabled = 1 if body.enabled else 0
    db.commit()
    db.refresh(rule)
    return _rule_to_dict(rule)


@router.delete("/alert-rules/{rule_id}", status_code=204, tags=["Alert Rules"])
async def delete_rule(
    rule_id: str,
    _: str = Depends(require_analyst_or_admin),
    db: Session = Depends(get_db),
):
    rule = db.query(AlertRule).filter(AlertRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Regra não encontrada.")
    db.delete(rule)
    db.commit()


@router.get("/analyses/{analysis_id}/alert-events", tags=["Alert Rules"])
async def list_alert_events(
    analysis_id: str,
    _: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not db.query(Analysis).filter(Analysis.id == analysis_id).first():
        raise HTTPException(status_code=404, detail="Análise não encontrada.")
    events = db.query(AlertEvent).filter(AlertEvent.analysis_id == analysis_id).all()
    return [
        {
            "id": e.id,
            "rule_label": e.rule_label,
            "metric": e.metric,
            "operator": e.operator,
            "threshold": e.threshold,
            "triggered_value": e.triggered_value,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in events
    ]
