"""CRUD for the institutional data dictionary (DictionaryEntry)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_admin
from app.db.database import get_db
from app.models.dictionary import VALID_CATEGORIES, DictionaryEntry

router = APIRouter()


class EntryCreate(BaseModel):
    category: str
    canonical_value: str
    aliases: list[str] = []
    active: bool = True


class EntryUpdate(BaseModel):
    canonical_value: Optional[str] = None
    aliases: Optional[list[str]] = None
    active: Optional[bool] = None


def _entry_to_dict(e: DictionaryEntry) -> dict:
    return {
        "id": e.id,
        "category": e.category,
        "canonical_value": e.canonical_value,
        "aliases": e.aliases or [],
        "active": bool(e.active),
        "created_by": e.created_by,
        "created_at": e.created_at.isoformat() if e.created_at else None,
        "updated_at": e.updated_at.isoformat() if e.updated_at else None,
    }


@router.get("/dictionary", tags=["Dictionary"])
async def list_entries(
    category: Optional[str] = Query(None),
    _: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(DictionaryEntry)
    if category:
        query = query.filter(DictionaryEntry.category == category)
    entries = query.order_by(DictionaryEntry.category.asc(), DictionaryEntry.canonical_value.asc()).all()
    return {"items": [_entry_to_dict(e) for e in entries], "categories": list(VALID_CATEGORIES)}


@router.post("/dictionary", tags=["Dictionary"], status_code=201)
async def create_entry(
    body: EntryCreate,
    current_user: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if body.category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Categoria inválida. Use: {', '.join(VALID_CATEGORIES)}")
    if not body.canonical_value.strip():
        raise HTTPException(status_code=400, detail="Valor canônico não pode ser vazio.")
    entry = DictionaryEntry(
        category=body.category,
        canonical_value=body.canonical_value.strip(),
        aliases=[a.strip() for a in body.aliases if a.strip()],
        active=1 if body.active else 0,
        created_by=current_user,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return _entry_to_dict(entry)


@router.patch("/dictionary/{entry_id}", tags=["Dictionary"])
async def update_entry(
    entry_id: str,
    body: EntryUpdate,
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    entry = db.query(DictionaryEntry).filter(DictionaryEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entrada não encontrada.")
    if body.canonical_value is not None:
        if not body.canonical_value.strip():
            raise HTTPException(status_code=400, detail="Valor canônico não pode ser vazio.")
        entry.canonical_value = body.canonical_value.strip()
    if body.aliases is not None:
        entry.aliases = [a.strip() for a in body.aliases if a.strip()]
    if body.active is not None:
        entry.active = 1 if body.active else 0
    from app.models.analysis import utcnow
    entry.updated_at = utcnow()
    db.commit()
    db.refresh(entry)
    return _entry_to_dict(entry)


@router.delete("/dictionary/{entry_id}", status_code=204, tags=["Dictionary"])
async def delete_entry(
    entry_id: str,
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    entry = db.query(DictionaryEntry).filter(DictionaryEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entrada não encontrada.")
    db.delete(entry)
    db.commit()
