"""Comments on analyses."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.analysis import Analysis, Comment

router = APIRouter()


class CommentCreate(BaseModel):
    content: str


@router.get("/analyses/{analysis_id}/comments", tags=["Comments"])
async def list_comments(
    analysis_id: str,
    _: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not db.query(Analysis).filter(Analysis.id == analysis_id).first():
        raise HTTPException(status_code=404, detail="Análise não encontrada.")
    items = (
        db.query(Comment)
        .filter(Comment.analysis_id == analysis_id)
        .order_by(Comment.created_at.asc())
        .all()
    )
    return [
        {
            "id": c.id,
            "username": c.username,
            "content": c.content,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in items
    ]


@router.post("/analyses/{analysis_id}/comments", tags=["Comments"], status_code=201)
async def add_comment(
    analysis_id: str,
    body: CommentCreate,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not db.query(Analysis).filter(Analysis.id == analysis_id).first():
        raise HTTPException(status_code=404, detail="Análise não encontrada.")
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="O comentário não pode estar vazio.")

    comment = Comment(
        analysis_id=analysis_id,
        username=current_user,
        content=body.content.strip(),
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return {
        "id": comment.id,
        "username": comment.username,
        "content": comment.content,
        "created_at": comment.created_at.isoformat() if comment.created_at else None,
    }


@router.delete("/analyses/{analysis_id}/comments/{comment_id}", status_code=204, tags=["Comments"])
async def delete_comment(
    analysis_id: str,
    comment_id: str,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    comment = db.query(Comment).filter(
        Comment.id == comment_id,
        Comment.analysis_id == analysis_id,
    ).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comentário não encontrado.")
    from app.core.dependencies import require_admin
    from app.models.user import User
    user = db.query(User).filter(User.username == current_user).first()
    if comment.username != current_user and (not user or user.role != "admin"):
        raise HTTPException(status_code=403, detail="Sem permissão para excluir este comentário.")
    db.delete(comment)
    db.commit()
