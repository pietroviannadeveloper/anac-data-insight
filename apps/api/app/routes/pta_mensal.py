"""
PTA Mensal routes — acompanhamento do PTA vigente (2026).
Requires admin or analyst role.
"""

from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import Optional

import asyncio

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_current_user, require_admin
from app.utils.file_validation import validate_file_bytes
from app.db.database import get_db
from app.models.pta_mensal import PTAMensalActivity, PTAMensalUpload, TIPOS_MENSAL
from app.services.pta_mensal_service import process_upload, compute_bi_summary

router = APIRouter(tags=["PTA Mensal"])

_UPLOAD_DIR = Path(settings.upload_dir)


# ─── helpers ─────────────────────────────────────────────────────────────────


def _upload_to_dict(u: PTAMensalUpload) -> dict:
    return {
        "id": u.id,
        "tipo": u.tipo,
        "year": u.year,
        "filename": u.filename,
        "total_rows": u.total_rows,
        "indicators": u.indicators,
        "created_by": u.created_by,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


# ─── endpoints ───────────────────────────────────────────────────────────────


@router.get("/pta-mensal/uploads")
async def list_uploads(
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """List all PTA mensal uploads ordered by tipo."""
    rows = (
        db.query(PTAMensalUpload)
        .order_by(PTAMensalUpload.tipo.asc(), PTAMensalUpload.created_at.desc())
        .all()
    )
    return [_upload_to_dict(r) for r in rows]


@router.post("/pta-mensal/upload", status_code=201)
async def upload_pta_mensal(
    tipo: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: str = Depends(require_admin),
):
    """
    Upload a spreadsheet for PTA 2026.
    If a spreadsheet of the same tipo already exists, it is replaced.
    """
    if tipo not in TIPOS_MENSAL:
        raise HTTPException(
            status_code=422,
            detail=f"Tipo inválido. Use um dos: {', '.join(TIPOS_MENSAL)}",
        )

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=422, detail="Arquivo vazio.")

    ok, reason = validate_file_bytes(file.filename or "", raw)
    if not ok:
        raise HTTPException(status_code=400, detail=reason)

    # processamento pesado em thread pool
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None, process_upload, raw, file.filename or "planilha", tipo
        )
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Erro ao processar planilha: {exc}")

    # save physical file
    _UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename or "file").suffix or ".xlsx"
    stored_name = f"pta_mensal_{tipo.lower()}_{uuid.uuid4().hex[:8]}{ext}"
    stored_path = _UPLOAD_DIR / stored_name
    stored_path.write_bytes(raw)

    # delete existing upload of same tipo (replace flow)
    old_uploads = (
        db.query(PTAMensalUpload).filter(PTAMensalUpload.tipo == tipo).all()
    )
    for old in old_uploads:
        # remove physical file if possible
        if old.stored_filename:
            try:
                (_UPLOAD_DIR / old.stored_filename).unlink(missing_ok=True)
            except Exception:
                pass
        db.delete(old)
    db.flush()

    # create new upload record
    upload = PTAMensalUpload(
        tipo=tipo,
        year=2026,
        filename=file.filename,
        stored_filename=stored_name,
        total_rows=result["total_rows"],
        indicators=result["indicators"],
        created_by=current_user,
    )
    db.add(upload)
    db.flush()

    # persist activity rows
    for act in result["activities"]:
        db.add(PTAMensalActivity(
            upload_id=upload.id,
            item=act["item"],
            atividade=act["atividade"],
            gerencia=act["gerencia"],
            setor=act["setor"],
            regulado=act["regulado"],
            cidade=act["cidade"],
            servidor=act["servidor"],
            mes=act["mes"],
            mes_agendado=act["mes_agendado"],
            mes_realizado=act["mes_realizado"],
            mes_num=act["mes_num"],
            mes_original_num=act["mes_original_num"],
            giaso=act["giaso"],
            processo=act["processo"],
            pcdp=act["pcdp"],
            pcdp_tipo=act["pcdp_tipo"],
            prioridade=act["prioridade"],
            status=act["status"],
            remanejado=act["remanejado"],
            sem_giaso=act["sem_giaso"],
            sem_pcdp=act["sem_pcdp"],
            sem_pcdp_valida=act["sem_pcdp_valida"],
            sem_processo=act["sem_processo"],
            local_indefinido=act["local_indefinido"],
            tipo_ciclo=tipo,
        ))

    db.commit()
    db.refresh(upload)
    return {**_upload_to_dict(upload), "message": "Planilha carregada com sucesso."}


@router.delete("/pta-mensal/uploads/{upload_id}", status_code=204)
async def delete_upload(
    upload_id: str,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    """Delete a PTA mensal upload and its activities."""
    row = db.query(PTAMensalUpload).filter(PTAMensalUpload.id == upload_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Upload não encontrado.")
    if row.stored_filename:
        try:
            (_UPLOAD_DIR / row.stored_filename).unlink(missing_ok=True)
        except Exception:
            pass
    db.delete(row)
    db.commit()


@router.get("/pta-mensal/summary")
async def get_summary(
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """
    Return aggregated BI summary across all uploaded PTA mensal spreadsheets.
    """
    uploads = db.query(PTAMensalUpload).all()
    if not uploads:
        return {
            "total_uploads": 0,
            "tipos_carregados": [],
            "indicadores_por_tipo": {},
            "consolidado": {},
        }

    tipos_carregados = sorted({u.tipo for u in uploads})

    # per-tipo summary from stored indicators
    indicadores_por_tipo = {}
    for u in uploads:
        indicadores_por_tipo[u.tipo] = {
            "upload_id": u.id,
            "filename": u.filename,
            "total_rows": u.total_rows,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            **(u.indicators or {}),
        }

    # consolidated across all activities
    all_activities = db.query(PTAMensalActivity).all()
    act_dicts = [
        {
            "status":           a.status,
            "mes_num":          a.mes_num,
            "mes_original_num": getattr(a, "mes_original_num", a.mes_num),
            "gerencia":         a.gerencia,
            "cidade":           a.cidade,
            "servidor":         a.servidor,
            "pcdp":             a.pcdp,
            "pcdp_tipo":        getattr(a, "pcdp_tipo", None),
            "processo":         a.processo,
            "remanejado":       getattr(a, "remanejado", 0) or 0,
            "sem_giaso":        a.sem_giaso,
            "sem_pcdp":         a.sem_pcdp,
            "sem_pcdp_valida":  getattr(a, "sem_pcdp_valida", a.sem_pcdp) or 0,
            "sem_processo":     a.sem_processo,
            "local_indefinido": a.local_indefinido,
            "atividade":        a.atividade,
            "tipo_ciclo":       a.tipo_ciclo,
        }
        for a in all_activities
    ]

    consolidado = compute_bi_summary(act_dicts) if act_dicts else {}

    return {
        "total_uploads": len(uploads),
        "tipos_carregados": tipos_carregados,
        "indicadores_por_tipo": indicadores_por_tipo,
        "consolidado": consolidado,
    }


@router.get("/pta-mensal/activities")
async def list_activities(
    upload_id: Optional[str] = None,
    tipo: Optional[str] = None,
    mes: Optional[int] = None,
    status: Optional[str] = None,
    gerencia: Optional[str] = None,
    cidade: Optional[str] = None,
    servidor: Optional[str] = None,
    search: Optional[str] = None,
    mes_vigente: bool = False,
    dia_vigente: bool = False,
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Paginated and filtered list of PTA mensal activities."""
    from datetime import date as _date
    _mes_atual = _date.today().month

    q = db.query(PTAMensalActivity)

    # atalhos de período
    if dia_vigente or mes_vigente:
        q = q.filter(PTAMensalActivity.mes_num == _mes_atual)

    if upload_id:
        q = q.filter(PTAMensalActivity.upload_id == upload_id)
    if tipo:
        q = q.filter(PTAMensalActivity.tipo_ciclo == tipo)
    if mes is not None:
        q = q.filter(PTAMensalActivity.mes_num == mes)
    if status:
        q = q.filter(PTAMensalActivity.status == status)
    if gerencia:
        q = q.filter(PTAMensalActivity.gerencia.ilike(f"%{gerencia}%"))
    if cidade:
        q = q.filter(PTAMensalActivity.cidade.ilike(f"%{cidade}%"))
    if servidor:
        q = q.filter(PTAMensalActivity.servidor.ilike(f"%{servidor}%"))
    if search:
        like = f"%{search}%"
        q = q.filter(
            or_(
                PTAMensalActivity.atividade.ilike(like),
                PTAMensalActivity.regulado.ilike(like),
                PTAMensalActivity.item.ilike(like),
            )
        )

    total = q.count()
    offset = (page - 1) * page_size
    rows = q.order_by(PTAMensalActivity.mes_num.asc()).offset(offset).limit(page_size).all()

    return {
        "items": [
            {
                "id": r.id,
                "item": r.item,
                "atividade": r.atividade,
                "gerencia": r.gerencia,
                "setor": r.setor,
                "regulado": r.regulado,
                "cidade": r.cidade,
                "servidor": r.servidor,
                "mes": r.mes,
                "mes_agendado": r.mes_agendado,
                "mes_realizado": r.mes_realizado,
                "mes_num": r.mes_num,
                "giaso": r.giaso,
                "processo": r.processo,
                "pcdp": r.pcdp,
                "prioridade": r.prioridade,
                "status": r.status,
                "sem_giaso": r.sem_giaso,
                "sem_pcdp": r.sem_pcdp,
                "sem_processo": r.sem_processo,
                "local_indefinido": r.local_indefinido,
                "tipo_ciclo": r.tipo_ciclo,
            }
            for r in rows
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size),
    }


@router.get("/pta-mensal/activities/export")
async def export_activities_excel(
    upload_id: Optional[str] = None,
    tipo: Optional[str] = None,
    mes: Optional[int] = None,
    status: Optional[str] = None,
    gerencia: Optional[str] = None,
    cidade: Optional[str] = None,
    servidor: Optional[str] = None,
    search: Optional[str] = None,
    mes_vigente: bool = False,
    dia_vigente: bool = False,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Export filtered PTA mensal activities as an Excel workbook."""
    import io
    import polars as pl
    from fastapi.responses import StreamingResponse
    from datetime import date as _date

    _mes_atual = _date.today().month
    q = db.query(PTAMensalActivity)

    if dia_vigente or mes_vigente:
        q = q.filter(PTAMensalActivity.mes_num == _mes_atual)
    if upload_id:
        q = q.filter(PTAMensalActivity.upload_id == upload_id)
    if tipo:
        q = q.filter(PTAMensalActivity.tipo_ciclo == tipo)
    if mes is not None:
        q = q.filter(PTAMensalActivity.mes_num == mes)
    if status:
        q = q.filter(PTAMensalActivity.status == status)
    if gerencia:
        q = q.filter(PTAMensalActivity.gerencia.ilike(f"%{gerencia}%"))
    if cidade:
        q = q.filter(PTAMensalActivity.cidade.ilike(f"%{cidade}%"))
    if servidor:
        q = q.filter(PTAMensalActivity.servidor.ilike(f"%{servidor}%"))
    if search:
        like = f"%{search}%"
        q = q.filter(
            or_(
                PTAMensalActivity.atividade.ilike(like),
                PTAMensalActivity.regulado.ilike(like),
                PTAMensalActivity.item.ilike(like),
            )
        )

    rows = q.order_by(PTAMensalActivity.mes_num.asc()).all()
    if not rows:
        raise HTTPException(status_code=404, detail="Nenhuma atividade encontrada com os filtros aplicados.")

    data = [
        {
            "Item": r.item or "",
            "Atividade": r.atividade or "",
            "Gerência": r.gerencia or "",
            "Setor": r.setor or "",
            "Regulado": r.regulado or "",
            "Cidade": r.cidade or "",
            "Servidor": r.servidor or "",
            "Mês Planejado": r.mes or "",
            "Mês Agendado": r.mes_agendado or "",
            "Mês Realizado": r.mes_realizado or "",
            "GIASO": r.giaso or "",
            "Processo": r.processo or "",
            "PCDP": r.pcdp or "",
            "Prioridade": r.prioridade or "",
            "Status": r.status or "",
            "Tipo": r.tipo_ciclo or "",
            "Sem GIASO": r.sem_giaso,
            "Sem PCDP": r.sem_pcdp,
            "Sem Processo": r.sem_processo,
            "Local Indefinido": r.local_indefinido,
        }
        for r in rows
    ]

    df = pl.DataFrame(data)
    buf = io.BytesIO()
    df.write_excel(buf)
    buf.seek(0)

    filename = f"atividades-pta-{_date.today().isoformat()}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
