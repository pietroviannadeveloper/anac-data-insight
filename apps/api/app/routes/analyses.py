from __future__ import annotations

import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_current_user, require_admin, require_analyst_or_admin
from app.db.database import get_db
from app.models.analysis import Analysis, CicloActivity, PendenciaTracking, gen_uuid
from app.schemas.upload import (
    AnalysisCreate, AnalysisResponse, AnalysisUpdate, PaginatedAnalysesResponse,
    PreviewResponse, AlertItem, AlertsResponse, TreatedDataResponse,
)
from app.services.file_reader import read_file, get_preview
from app.services.classifier import classify_spreadsheet
from app.services.ciclo_analyzer import analyze_ciclos_with_breakdown
from app.services.classifier import classify_row_type
from app.services.pendencia_rules import classify_severity, is_pendencia

router = APIRouter()


def _find_file(upload_id: str) -> Path:
    upload_dir = Path(settings.upload_dir)
    matches = list(upload_dir.glob(f"{upload_id}_*"))
    if not matches:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado. Faça o upload novamente.")
    return matches[0]


def _get_analysis_or_404(analysis_id: str, db: Session) -> Analysis:
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")
    return analysis


def _build_alerts(indicators: dict, detected_type: str) -> list[AlertItem]:
    alerts: list[AlertItem] = []
    if detected_type != "ciclos" or not indicators:
        return alerts

    if indicators.get("sem_giaso", 0) > 0:
        alerts.append(AlertItem(type="error", category="Pendência GIASO",
            message="Atividades sem número GIASO vinculado", count=indicators["sem_giaso"]))
    if indicators.get("pcdp_duplicada", 0) > 0:
        alerts.append(AlertItem(type="error", category="PCDP Duplicado",
            message="PCDPs que aparecem em mais de uma atividade", count=indicators["pcdp_duplicada"]))
    if indicators.get("multiplas_pcdps", 0) > 0:
        alerts.append(AlertItem(type="warning", category="Múltiplas PCDPs",
            message="Pares atividade/regulado com mais de uma PCDP distinta", count=indicators["multiplas_pcdps"]))
    if indicators.get("sem_pcdp", 0) > 0:
        alerts.append(AlertItem(type="warning", category="Pendência PCDP",
            message="Atividades sem PCDP vinculada", count=indicators["sem_pcdp"]))
    if indicators.get("sem_processo", 0) > 0:
        alerts.append(AlertItem(type="warning", category="Pendência Processo",
            message="Atividades sem número de processo", count=indicators["sem_processo"]))
    if indicators.get("locais_indefinidos", 0) > 0:
        alerts.append(AlertItem(type="info", category="Local Indefinido",
            message="Atividades com cidade/local não definido", count=indicators["locais_indefinidos"]))
    if indicators.get("sem_agendamento", 0) > 0:
        alerts.append(AlertItem(type="info", category="Sem Agendamento",
            message="Atividades sem data agendada ou realizada", count=indicators["sem_agendamento"]))
    return alerts


@router.post("/analyses", response_model=AnalysisResponse, tags=["Analyses"], status_code=201)
async def create_analysis(
    body: AnalysisCreate,
    current_user: str = Depends(require_analyst_or_admin),
    db: Session = Depends(get_db),
):
    """Analisa um arquivo já enviado. Requer perfil analyst ou admin."""
    file_path = _find_file(body.upload_id)

    try:
        df = read_file(file_path)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Erro ao ler o arquivo: {e}")

    detected_type = classify_spreadsheet(df)
    indicators: dict | None = None

    if detected_type == "ciclos":
        indicators = analyze_ciclos_with_breakdown(df)

    now = datetime.now(timezone.utc)
    analysis = Analysis(
        original_filename=file_path.name.split("_", 1)[1] if "_" in file_path.name else file_path.name,
        stored_filename=file_path.name,
        file_type=file_path.suffix.lstrip("."),
        detected_type=detected_type,
        status="completed",
        total_rows=len(df),
        total_columns=len(df.columns),
        indicators=indicators,
        created_by=current_user,
        created_at=now,
        completed_at=now,
    )
    db.add(analysis)
    db.flush()

    if detected_type == "ciclos":
        _save_ciclo_activities(db, str(analysis.id), df)

    db.commit()
    db.refresh(analysis)

    import hashlib
    from app.services.classifier import CLASSIFIER_VERSION
    _audit(db, current_user, "analysis_created", "analysis", str(analysis.id), {
        "filename": analysis.original_filename,
        "type": detected_type,
        "file_hash": hashlib.sha256(file_path.read_bytes()).hexdigest(),
        "classifier_version": CLASSIFIER_VERSION,
        "total_rows": analysis.total_rows,
        "total_columns": analysis.total_columns,
    })
    return analysis


def _norm_cols(df) -> dict:
    return {c.lower().replace(" ", "").replace("_", ""): c for c in df.columns}


def _row_str(df, row_idx: int, col_norm: str, mapping: dict) -> str | None:
    real = mapping.get(col_norm)
    if real is None:
        return None
    val = df[real][row_idx]
    return str(val) if val is not None else None


def _is_empty_val(val: str | None) -> bool:
    if val is None:
        return True
    return val.strip().lower() in {"", "indefinido", "a definir", "-", "n/a"}


def _save_ciclo_activities(db: Session, analysis_id: str, df):
    mapping = _norm_cols(df)

    for i in range(len(df)):
        def g(key): return _row_str(df, i, key, mapping)

        mes_realizado = g("mesrealizado")
        mes_agendado = g("mesagendado")

        if not _is_empty_val(mes_realizado):
            row_status = "realizado"
        elif not _is_empty_val(mes_agendado):
            row_status = "agendado"
        else:
            row_status = "sem-agendamento"

        giaso_val = g("giaso")
        pcdp_val = g("pcdp")
        processo_val = g("processo")
        cidade_val = g("cidade")

        item_val = g("item")
        tipo_ciclo, criterio = classify_row_type(item_val)

        activity = CicloActivity(
            id=gen_uuid(),
            analysis_id=analysis_id,
            item=item_val,
            atividade=g("atividade"),
            gerencia=g("gerencia"),
            setor=g("setor"),
            regulado=g("regulado"),
            cidade=cidade_val,
            mes=g("mes"),
            mes_agendado=mes_agendado,
            mes_realizado=mes_realizado,
            giaso=giaso_val,
            processo=processo_val,
            pcdp=pcdp_val,
            prioridade=g("prioridade"),
            status=row_status,
            sem_giaso=1 if _is_empty_val(giaso_val) else 0,
            sem_pcdp=1 if _is_empty_val(pcdp_val) else 0,
            sem_processo=1 if _is_empty_val(processo_val) else 0,
            local_indefinido=1 if _is_empty_val(cidade_val) else 0,
            tipo_ciclo=tipo_ciclo,
            criterio_classificacao=criterio,
        )
        db.add(activity)
        if is_pendencia(activity):
            db.add(PendenciaTracking(
                source_type="ciclo",
                source_id=activity.id,
                severity=classify_severity(activity),
            ))


def _audit(db: Session, username: str, action: str, entity_type: str, entity_id: str, meta: dict | None = None) -> None:
    import json
    from app.models.user import AuditLog, User
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


def _attach_roles(analyses: list, db: Session) -> list:
    """Attach created_by_role to each Analysis instance by looking up the User table."""
    from app.models.user import User
    usernames = {a.created_by for a in analyses if a.created_by}
    if not usernames:
        return analyses
    role_map = {
        u.username: u.role
        for u in db.query(User).filter(User.username.in_(list(usernames))).all()
    }
    for a in analyses:
        a.created_by_role = role_map.get(a.created_by) if a.created_by else None
    return analyses


@router.get("/analyses", response_model=PaginatedAnalysesResponse, tags=["Analyses"])
async def list_analyses(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    tag: Optional[str] = Query(None, description="Filtrar por tag"),
    _: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Analysis).filter(Analysis.deleted_at.is_(None))
    if tag:
        q = q.filter(Analysis.tags.contains([tag]))
    total = q.count()
    items = (
        q.order_by(Analysis.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    _attach_roles(items, db)
    return PaginatedAnalysesResponse(items=items, total=total, page=page, per_page=per_page)


@router.patch("/analyses/{analysis_id}", response_model=AnalysisResponse, tags=["Analyses"])
async def update_analysis(
    analysis_id: str,
    body: AnalysisUpdate,
    _: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Atualiza descrição e/ou tags de uma análise."""
    analysis = _get_analysis_or_404(analysis_id, db)
    if body.description is not None:
        analysis.description = body.description
    if body.tags is not None:
        analysis.tags = [t.strip() for t in body.tags if t.strip()]
    db.commit()
    db.refresh(analysis)
    return analysis


@router.get("/search", tags=["Analyses"])
async def global_search(
    q: str = Query(..., min_length=1, description="Texto a buscar"),
    _: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Busca global em nome de arquivo, descrição, tags e dados de atividades."""
    from sqlalchemy import or_
    term = f"%{q}%"

    # Análises por nome, descrição
    analyses = (
        db.query(Analysis)
        .filter(or_(
            Analysis.original_filename.ilike(term),
            Analysis.description.ilike(term),
            Analysis.created_by.ilike(term),
        ))
        .order_by(Analysis.created_at.desc())
        .limit(8)
        .all()
    )

    # Atividades por gerência, regulado, atividade
    activities = (
        db.query(CicloActivity)
        .filter(or_(
            CicloActivity.gerencia.ilike(term),
            CicloActivity.regulado.ilike(term),
            CicloActivity.atividade.ilike(term),
            CicloActivity.cidade.ilike(term),
        ))
        .limit(5)
        .all()
    )

    # Agrupa atividades por analysis_id para links úteis
    analysis_ids_from_activities = list({a.analysis_id for a in activities})
    analyses_from_activities = (
        db.query(Analysis)
        .filter(Analysis.id.in_(analysis_ids_from_activities))
        .all()
    ) if analysis_ids_from_activities else []

    all_analyses = {a.id: a for a in analyses + analyses_from_activities}

    return {
        "query": q,
        "analyses": [
            {
                "id": a.id,
                "original_filename": a.original_filename,
                "detected_type": a.detected_type,
                "status": a.status,
                "description": a.description,
                "tags": a.tags or [],
                "created_by": a.created_by,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in all_analyses.values()
        ],
    }


@router.get("/analyses/{analysis_id}", response_model=AnalysisResponse, tags=["Analyses"])
async def get_analysis(
    analysis_id: str,
    _: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    a = _get_analysis_or_404(analysis_id, db)
    _attach_roles([a], db)
    return a


@router.delete("/analyses/{analysis_id}", status_code=204, tags=["Analyses"])
async def delete_analysis(
    analysis_id: str,
    current_user: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Soft delete: marca deleted_at. Arquivo físico permanece para possível restore."""
    analysis = _get_analysis_or_404(analysis_id, db)
    analysis.deleted_at = datetime.now(timezone.utc)
    db.commit()
    _audit(db, current_user, "analysis_soft_deleted", "analysis", analysis_id,
           {"filename": analysis.original_filename})


@router.post("/analyses/{analysis_id}/restore", status_code=200, tags=["Analyses"])
async def restore_analysis(
    analysis_id: str,
    current_user: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Restaura uma análise previamente removida (soft delete)."""
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")
    if analysis.deleted_at is None:
        raise HTTPException(status_code=400, detail="Análise não está na lixeira.")
    analysis.deleted_at = None
    db.commit()
    _audit(db, current_user, "analysis_restored", "analysis", analysis_id,
           {"filename": analysis.original_filename})
    return {"ok": True}


@router.delete("/analyses/{analysis_id}/permanent", status_code=204, tags=["Analyses"])
async def delete_analysis_permanent(
    analysis_id: str,
    current_user: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Exclusão permanente — remove arquivo físico e registro do banco."""
    from app.services.pendencia_query import delete_tracking_for_sources

    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")
    stored = Path(settings.upload_dir) / str(analysis.stored_filename)
    if stored.exists():
        stored.unlink()
    _audit(db, current_user, "analysis_deleted_permanent", "analysis", analysis_id,
           {"filename": analysis.original_filename})
    activity_ids = [r[0] for r in db.query(CicloActivity.id).filter(CicloActivity.analysis_id == analysis_id).all()]
    delete_tracking_for_sources(db, "ciclo", activity_ids)
    db.delete(analysis)
    db.commit()


@router.get("/analyses/{analysis_id}/file", tags=["Analyses"])
async def get_analysis_file(
    analysis_id: str,
    _: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Serve the original uploaded file (used for PDF inline preview)."""
    analysis = _get_analysis_or_404(analysis_id, db)
    file_path = Path(settings.upload_dir) / str(analysis.stored_filename)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Arquivo não encontrado no servidor.")

    media_type = "application/pdf" if str(analysis.file_type) == "pdf" else "application/octet-stream"
    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        filename=str(analysis.original_filename),
        headers={"Content-Disposition": "inline"},
    )


@router.get("/analyses/{analysis_id}/preview", response_model=PreviewResponse, tags=["Analyses"])
async def get_analysis_preview(
    analysis_id: str,
    _: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    analysis = _get_analysis_or_404(analysis_id, db)
    file_path = Path(settings.upload_dir) / str(analysis.stored_filename)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Arquivo original não encontrado no servidor.")
    try:
        df = read_file(file_path)
        return get_preview(df, n=10)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao ler arquivo: {e}")


@router.get("/analyses/{analysis_id}/summary", tags=["Analyses"])
async def get_analysis_summary(
    analysis_id: str,
    _: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    analysis = _get_analysis_or_404(analysis_id, db)
    if analysis.detected_type != "ciclos" or not analysis.indicators:
        return {"detected_type": analysis.detected_type, "indicators": None}
    return {"detected_type": analysis.detected_type, "indicators": analysis.indicators}


@router.get("/analyses/{analysis_id}/alerts", response_model=AlertsResponse, tags=["Analyses"])
async def get_analysis_alerts(
    analysis_id: str,
    _: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    analysis = _get_analysis_or_404(analysis_id, db)
    indicators: dict = analysis.indicators or {}
    alerts = _build_alerts(indicators, str(analysis.detected_type))
    total_critical = sum(1 for a in alerts if a.type == "error")
    return AlertsResponse(alerts=alerts, total_critical=total_critical)


@router.get("/analyses/{analysis_id}/audit-trail", tags=["Analyses"])
async def get_analysis_audit_trail(
    analysis_id: str,
    _: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Trilha de auditoria analítica: quem criou, exportou, editou esta análise — em ordem cronológica."""
    from app.models.user import AuditLog

    _get_analysis_or_404(analysis_id, db)
    entries = (
        db.query(AuditLog)
        .filter(AuditLog.entity_type == "analysis", AuditLog.entity_id == analysis_id)
        .order_by(AuditLog.created_at.asc())
        .all()
    )
    return [
        {
            "id": e.id,
            "username": e.username,
            "action": e.action,
            "extra_data": e.extra_data,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in entries
    ]


@router.get("/analyses/{analysis_id}/treated-data", response_model=TreatedDataResponse, tags=["Analyses"])
async def get_treated_data(
    analysis_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200, alias="page_size"),
    per_page: Optional[int] = Query(None, ge=1, le=200),  # backward compat alias
    status: Optional[str] = Query(None),
    gerencia: Optional[str] = Query(None),
    cidade: Optional[str] = Query(None),
    setor: Optional[str] = Query(None),
    sem_giaso: Optional[int] = Query(None, ge=0, le=1),
    sem_pcdp: Optional[int] = Query(None, ge=0, le=1),
    sem_processo: Optional[int] = Query(None, ge=0, le=1),
    local_indefinido: Optional[int] = Query(None, ge=0, le=1),
    tipo_ciclo: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    sort_order: str = Query("asc", pattern="^(asc|desc)$"),
    _: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_analysis_or_404(analysis_id, db)
    effective_size = per_page or page_size

    q = db.query(CicloActivity).filter(CicloActivity.analysis_id == analysis_id)

    if status:
        q = q.filter(CicloActivity.status == status)
    if gerencia:
        q = q.filter(CicloActivity.gerencia.ilike(f"%{gerencia}%"))
    if cidade:
        q = q.filter(CicloActivity.cidade.ilike(f"%{cidade}%"))
    if setor:
        q = q.filter(CicloActivity.setor.ilike(f"%{setor}%"))
    if sem_giaso is not None:
        q = q.filter(CicloActivity.sem_giaso == sem_giaso)
    if sem_pcdp is not None:
        q = q.filter(CicloActivity.sem_pcdp == sem_pcdp)
    if sem_processo is not None:
        q = q.filter(CicloActivity.sem_processo == sem_processo)
    if local_indefinido is not None:
        q = q.filter(CicloActivity.local_indefinido == local_indefinido)
    if tipo_ciclo:
        q = q.filter(CicloActivity.tipo_ciclo == tipo_ciclo.upper())
    if search:
        term = f"%{search}%"
        from sqlalchemy import or_
        q = q.filter(or_(
            CicloActivity.atividade.ilike(term),
            CicloActivity.regulado.ilike(term),
            CicloActivity.gerencia.ilike(term),
            CicloActivity.cidade.ilike(term),
            CicloActivity.giaso.ilike(term),
            CicloActivity.processo.ilike(term),
            CicloActivity.pcdp.ilike(term),
        ))

    # Sorting
    _sortable = {
        "atividade": CicloActivity.atividade,
        "gerencia": CicloActivity.gerencia,
        "setor": CicloActivity.setor,
        "cidade": CicloActivity.cidade,
        "status": CicloActivity.status,
        "prioridade": CicloActivity.prioridade,
        "mes": CicloActivity.mes,
    }
    sort_col = _sortable.get(sort_by or "")
    if sort_col is not None:
        q = q.order_by(sort_col.desc() if sort_order == "desc" else sort_col.asc())

    total = q.count()
    total_pages = math.ceil(total / effective_size) if effective_size else 1
    items = q.offset((page - 1) * effective_size).limit(effective_size).all()

    return TreatedDataResponse(
        items=items,
        total=total,
        page=page,
        page_size=effective_size,
        total_pages=total_pages,
    )


@router.get("/analyses/{analysis_id}/export/excel", tags=["Analyses"])
async def export_excel(
    analysis_id: str,
    current_user: str = Depends(require_analyst_or_admin),
    db: Session = Depends(get_db),
):
    analysis = _get_analysis_or_404(analysis_id, db)
    file_path = Path(settings.upload_dir) / str(analysis.stored_filename)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Arquivo original não encontrado no servidor.")

    try:
        import polars as pl
        df = read_file(file_path)

        if analysis.detected_type == "ciclos":
            activities = (
                db.query(CicloActivity)
                .filter(CicloActivity.analysis_id == analysis_id)
                .all()
            )
            status_map = {
                (a.atividade or "", a.regulado or ""): a.status
                for a in activities
            }
            mapping = {c.lower().replace(" ", "").replace("_", ""): c for c in df.columns}
            col_atv = mapping.get("atividade")
            col_reg = mapping.get("regulado")

            if col_atv and col_reg:
                statuses = [
                    status_map.get((str(row[col_atv] or ""), str(row[col_reg] or "")), "")
                    for row in df.iter_rows(named=True)
                ]
                df = df.with_columns(pl.Series("Status Tratado", statuses))

        out_path = Path(settings.generated_dir) / f"{analysis_id}_export.xlsx"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        df.write_excel(str(out_path))

        _audit(db, current_user, "excel_exported", "analysis", analysis_id,
               {"filename": analysis.original_filename, "version": analysis.version})

        return FileResponse(
            path=str(out_path),
            filename=f"analise_{analysis_id}.xlsx",
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar exportação: {e}")


@router.get("/analyses/{analysis_id}/export/pdf", tags=["Analyses"])
async def export_pdf(
    analysis_id: str,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Gera e devolve um relatório executivo em PDF para a análise informada."""
    from app.services.pdf_report import generate_pdf
    from app.models.analysis import AIAnalysis
    import tempfile

    analysis = _get_analysis_or_404(analysis_id, db)
    if analysis.status != "completed":
        raise HTTPException(status_code=400, detail="A análise ainda não foi concluída.")

    ai_record = db.query(AIAnalysis).filter(AIAnalysis.analysis_id == analysis_id).first()
    ai_summary: dict | None = None
    if ai_record:
        ai_summary = {
            "resumo_executivo":  ai_record.resumo_executivo,
            "principais_achados": ai_record.principais_achados or [],
            "riscos_operacionais": ai_record.riscos_operacionais or [],
            "recomendacoes":      ai_record.recomendacoes or [],
        }

    indicators: dict | None = analysis.indicators

    alerts_raw = _build_alerts(indicators or {}, str(analysis.detected_type))
    alerts = [
        {"type": a.type, "category": a.category, "message": a.message, "count": a.count}
        for a in alerts_raw
    ]

    try:
        pdf_bytes = generate_pdf(
            filename=str(analysis.original_filename),
            created_at=analysis.created_at,
            total_rows=int(analysis.total_rows or 0),
            indicators=indicators,
            alerts=alerts,
            ai_summary=ai_summary,
            analysis_type=str(analysis.detected_type),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar PDF: {e}")

    out_dir = Path(settings.generated_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{analysis_id}_report.pdf"
    out_path.write_bytes(pdf_bytes)

    safe_name = "".join(c if c.isalnum() or c in "-_." else "_"
                        for c in str(analysis.original_filename))
    safe_name = safe_name.rsplit(".", 1)[0] + "_relatorio.pdf"

    _audit(db, current_user, "pdf_exported", "analysis", analysis_id,
           {"filename": analysis.original_filename, "version": analysis.version})

    return FileResponse(
        path=str(out_path),
        filename=safe_name,
        media_type="application/pdf",
    )


@router.get("/analyses/{analysis_id}/export/docx", tags=["Analyses"])
async def export_docx(
    analysis_id: str,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Gera e devolve um relatório executivo editável em formato Word (.docx)."""
    from app.services.docx_report import generate_docx
    from app.models.analysis import AIAnalysis

    analysis = _get_analysis_or_404(analysis_id, db)
    if analysis.status != "completed":
        raise HTTPException(status_code=400, detail="A análise ainda não foi concluída.")

    ai_record = db.query(AIAnalysis).filter(AIAnalysis.analysis_id == analysis_id).first()
    ai_summary = None
    if ai_record:
        ai_summary = {
            "resumo_executivo":   ai_record.resumo_executivo,
            "principais_achados": ai_record.principais_achados or [],
            "riscos_operacionais":ai_record.riscos_operacionais or [],
            "recomendacoes":      ai_record.recomendacoes or [],
            "plano_acao":         ai_record.plano_acao or [],
        }

    alerts_raw = _build_alerts(analysis.indicators or {}, str(analysis.detected_type))
    alerts = [{"type": a.type, "category": a.category, "message": a.message, "count": a.count} for a in alerts_raw]

    try:
        docx_bytes = generate_docx(
            filename=str(analysis.original_filename),
            created_at=analysis.created_at,
            total_rows=int(analysis.total_rows or 0),
            indicators=analysis.indicators,
            alerts=alerts,
            ai_summary=ai_summary,
            analysis_type=str(analysis.detected_type),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar DOCX: {e}")

    out_dir = Path(settings.generated_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{analysis_id}_report.docx"
    out_path.write_bytes(docx_bytes)

    safe_name = "".join(c if c.isalnum() or c in "-_." else "_"
                        for c in str(analysis.original_filename))
    safe_name = safe_name.rsplit(".", 1)[0] + "_relatorio.docx"

    _audit(db, current_user, "docx_exported", "analysis", analysis_id,
           {"filename": analysis.original_filename, "version": analysis.version})

    return FileResponse(
        path=str(out_path),
        filename=safe_name,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


@router.get("/analyses/{analysis_id}/export/pptx", tags=["Analyses"])
async def export_pptx(
    analysis_id: str,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Gera e devolve uma apresentação executiva em PowerPoint (.pptx)."""
    from app.services.pptx_report import generate_pptx
    from app.models.analysis import AIAnalysis

    analysis = _get_analysis_or_404(analysis_id, db)
    if analysis.status != "completed":
        raise HTTPException(status_code=400, detail="A análise ainda não foi concluída.")

    ai_record = db.query(AIAnalysis).filter(AIAnalysis.analysis_id == analysis_id).first()
    ai_summary = None
    if ai_record:
        ai_summary = {
            "resumo_executivo":   ai_record.resumo_executivo,
            "principais_achados": ai_record.principais_achados or [],
            "riscos_operacionais":ai_record.riscos_operacionais or [],
            "recomendacoes":      ai_record.recomendacoes or [],
        }

    alerts_raw = _build_alerts(analysis.indicators or {}, str(analysis.detected_type))
    alerts = [{"type": a.type, "category": a.category, "message": a.message, "count": a.count} for a in alerts_raw]

    try:
        pptx_bytes = generate_pptx(
            filename=str(analysis.original_filename),
            created_at=analysis.created_at,
            total_rows=int(analysis.total_rows or 0),
            indicators=analysis.indicators,
            alerts=alerts,
            ai_summary=ai_summary,
            analysis_type=str(analysis.detected_type),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar PPTX: {e}")

    out_dir = Path(settings.generated_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{analysis_id}_report.pptx"
    out_path.write_bytes(pptx_bytes)

    safe_name = "".join(c if c.isalnum() or c in "-_." else "_"
                        for c in str(analysis.original_filename))
    safe_name = safe_name.rsplit(".", 1)[0] + "_briefing.pptx"

    _audit(db, current_user, "pptx_exported", "analysis", analysis_id,
           {"filename": analysis.original_filename, "version": analysis.version})

    return FileResponse(
        path=str(out_path),
        filename=safe_name,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
    )


@router.get("/analyses/{analysis_id}/map-data", tags=["Analyses"])
async def get_map_data(
    analysis_id: str,
    _: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retorna dados agregados por cidade para renderização no mapa."""
    from app.services.geocoder import geocode_city
    from sqlalchemy import func

    _get_analysis_or_404(analysis_id, db)

    rows = (
        db.query(
            CicloActivity.cidade,
            func.count(CicloActivity.id).label("total"),
            func.sum(CicloActivity.sem_giaso).label("sem_giaso"),
            func.sum(CicloActivity.sem_pcdp).label("sem_pcdp"),
            func.sum(CicloActivity.sem_processo).label("sem_processo"),
            func.sum(CicloActivity.local_indefinido).label("indefinido"),
        )
        .filter(
            CicloActivity.analysis_id == analysis_id,
            CicloActivity.cidade.isnot(None),
            CicloActivity.cidade != "",
        )
        .group_by(CicloActivity.cidade)
        .order_by(func.count(CicloActivity.id).desc())
        .all()
    )

    points = []
    for row in rows:
        coords = geocode_city(row.cidade or "")
        if coords is None:
            continue
        total      = int(row.total or 0)
        pendencias = int((row.sem_giaso or 0) + (row.sem_pcdp or 0) + (row.sem_processo or 0))
        severity = "high" if pendencias > total * 0.5 else "medium" if pendencias > 0 else "low"
        points.append({
            "city":       row.cidade,
            "lat":        coords[0],
            "lon":        coords[1],
            "total":      total,
            "sem_giaso":  int(row.sem_giaso or 0),
            "sem_pcdp":   int(row.sem_pcdp or 0),
            "sem_processo": int(row.sem_processo or 0),
            "pendencias": pendencias,
            "severity":   severity,
        })

    return {"points": points, "total_geocoded": len(points), "total_cities": len(rows)}
