"""Approval workflow for Analysis: rascunho -> em_validacao -> aprovado/rejeitado -> arquivado.

Informational only — approval_status does not gate report exports.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_admin, require_analyst_or_admin
from app.db.database import get_db
from app.models.analysis import Analysis, AnalysisApproval
from app.models.user import AuditLog, User
from app.schemas.upload import AnalysisResponse

router = APIRouter()

_SUBMITTABLE_FROM = ("rascunho", "rejeitado")


class RejectBody(BaseModel):
    comment: str


def _audit(db: Session, username: str, action: str, entity_id: str, meta: dict | None = None) -> None:
    import json
    user = db.query(User).filter(User.username == username).first()
    db.add(AuditLog(
        user_id=user.id if user else None,
        username=username,
        action=action,
        entity_type="analysis",
        entity_id=entity_id,
        extra_data=json.dumps(meta) if meta else None,
    ))
    db.commit()


def _get_analysis_or_404(analysis_id: str, db: Session) -> Analysis:
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")
    return analysis


def _transition(db: Session, analysis: Analysis, current_user: str, to_status: str, comment: Optional[str] = None) -> Analysis:
    from_status = analysis.approval_status
    analysis.approval_status = to_status
    db.add(AnalysisApproval(
        analysis_id=analysis.id, from_status=from_status, to_status=to_status,
        username=current_user, comment=comment,
    ))
    db.commit()
    db.refresh(analysis)
    return analysis


@router.post("/analyses/{analysis_id}/submit", tags=["Aprovação"], response_model=AnalysisResponse)
async def submit_analysis(
    analysis_id: str,
    current_user: str = Depends(require_analyst_or_admin),
    db: Session = Depends(get_db),
):
    analysis = _get_analysis_or_404(analysis_id, db)
    if analysis.approval_status not in _SUBMITTABLE_FROM:
        raise HTTPException(
            status_code=400,
            detail=f"Só é possível submeter análises em rascunho ou rejeitadas (status atual: {analysis.approval_status}).",
        )
    analysis = _transition(db, analysis, current_user, "em_validacao")
    _audit(db, current_user, "analysis_submitted", analysis_id)
    return analysis


@router.post("/analyses/{analysis_id}/approve", tags=["Aprovação"], response_model=AnalysisResponse)
async def approve_analysis(
    analysis_id: str,
    current_user: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    analysis = _get_analysis_or_404(analysis_id, db)
    if analysis.approval_status != "em_validacao":
        raise HTTPException(
            status_code=400,
            detail=f"Só é possível aprovar análises em validação (status atual: {analysis.approval_status}).",
        )
    analysis = _transition(db, analysis, current_user, "aprovado")
    _audit(db, current_user, "analysis_approved", analysis_id)
    return analysis


@router.post("/analyses/{analysis_id}/reject", tags=["Aprovação"], response_model=AnalysisResponse)
async def reject_analysis(
    analysis_id: str,
    body: RejectBody,
    current_user: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if not body.comment.strip():
        raise HTTPException(status_code=400, detail="É necessário informar um motivo para rejeitar a análise.")
    analysis = _get_analysis_or_404(analysis_id, db)
    if analysis.approval_status != "em_validacao":
        raise HTTPException(
            status_code=400,
            detail=f"Só é possível rejeitar análises em validação (status atual: {analysis.approval_status}).",
        )
    analysis = _transition(db, analysis, current_user, "rejeitado", comment=body.comment.strip())
    _audit(db, current_user, "analysis_rejected", analysis_id, {"comment": body.comment.strip()})
    return analysis


@router.post("/analyses/{analysis_id}/archive", tags=["Aprovação"], response_model=AnalysisResponse)
async def archive_analysis(
    analysis_id: str,
    current_user: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    analysis = _get_analysis_or_404(analysis_id, db)
    if analysis.approval_status == "arquivado":
        raise HTTPException(status_code=400, detail="Análise já está arquivada.")
    analysis = _transition(db, analysis, current_user, "arquivado")
    _audit(db, current_user, "analysis_archived", analysis_id)
    return analysis


@router.get("/analyses/{analysis_id}/approval-history", tags=["Aprovação"])
async def get_approval_history(
    analysis_id: str,
    _: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_analysis_or_404(analysis_id, db)
    entries = (
        db.query(AnalysisApproval)
        .filter(AnalysisApproval.analysis_id == analysis_id)
        .order_by(AnalysisApproval.created_at.asc())
        .all()
    )
    return [
        {
            "id": e.id,
            "from_status": e.from_status,
            "to_status": e.to_status,
            "username": e.username,
            "comment": e.comment,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in entries
    ]
