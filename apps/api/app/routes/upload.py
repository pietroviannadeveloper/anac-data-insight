from __future__ import annotations

import asyncio
import hashlib
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Query
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import require_analyst_or_admin
from app.db.database import get_db
from app.models.analysis import Analysis, CicloActivity, PendenciaTracking, gen_uuid
from app.schemas.upload import UploadResponse, AnalysisResponse
from app.services.file_reader import read_file
from app.services.classifier import CLASSIFIER_VERSION, classify_spreadsheet
from app.services.ciclo_analyzer import analyze_ciclos_with_breakdown
from app.services.generic_analyzer import analyze_generic
from app.services.pdf_reader import extract_pdf, summarize_pdf_indicators
from app.services.pendencia_rules import classify_severity, is_pendencia
from app.services.quality_validator import validate_quality
from app.utils.file_utils import sanitize_filename
from app.utils.file_validation import validate_file_bytes

router = APIRouter()

ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls"}


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


async def _post_analysis_hooks(analysis, db: Session) -> None:
    """Fire alert rules and send completion email after an analysis is saved."""
    from app.services.alert_checker import check_and_fire
    from app.services.email_service import send_email, analysis_completed_html
    from app.models.user import User

    # 1. Check alert rules
    try:
        await check_and_fire(
            analysis_id=str(analysis.id),
            detected_type=str(analysis.detected_type),
            original_filename=str(analysis.original_filename),
            indicators=analysis.indicators,
            db=db,
        )
    except Exception:
        pass  # never break upload on alert failure

    # 2. Send completion email to the creator (if they have an email configured)
    try:
        if analysis.created_by:
            creator = db.query(User).filter(User.username == analysis.created_by).first()
            if creator and creator.email:
                html = analysis_completed_html(
                    filename=str(analysis.original_filename),
                    detected_type=str(analysis.detected_type),
                    total_rows=int(analysis.total_rows or 0),
                    indicators=analysis.indicators,
                    analysis_url=f"http://localhost:3000/analises/{analysis.id}",
                )
                await send_email(
                    to=[creator.email],
                    subject=f"[ANAC Data Insight] Análise concluída — {analysis.original_filename}",
                    html=html,
                )
    except Exception:
        pass
ALLOWED_PDF_EXTENSIONS  = {".pdf"}
ALLOWED_ALL_EXTENSIONS  = ALLOWED_EXTENSIONS | ALLOWED_PDF_EXTENSIONS

_EMPTY_VALUES = {"", "indefinido", "a definir", "-", "n/a"}


def _is_empty_val(val: str | None) -> bool:
    if val is None:
        return True
    return val.strip().lower() in _EMPTY_VALUES


def _norm_cols(df) -> dict:
    import unicodedata
    def _n(c):
        c = c.lower().replace(" ", "").replace("_", "").replace("-", "")
        c = unicodedata.normalize("NFKD", c)
        return "".join(ch for ch in c if not unicodedata.combining(ch))
    return {_n(c): c for c in df.columns}


_COL_PATTERNS: dict = {
    "realizado":  ["realiz", "mesrealiz", "datarealiz"],
    "agendado":   ["agend", "mesagend", "dataagend", "previsto", "planejado"],
    "atividade":  ["atividade", "atv"],
    "gerencia":   ["gerencia"],
    "regulado":   ["regulado", "fiscalizado", "operador", "empresa"],
    "giaso":      ["giaso"],
    "pcdp":       ["pcdp"],
    "processo":   ["processo"],
    "cidade":     ["cidade", "local", "municipio", "aeroporto"],
    "item":       ["item"],
    "mes":        ["mes"],
    "prioridade": ["prioridade"],
    "setor":      ["setor"],
}


def _find_col(mapping: dict, logical: str) -> str | None:
    patterns = _COL_PATTERNS.get(logical, [logical])
    for col_norm, col_real in mapping.items():
        for p in patterns:
            if p in col_norm:
                return col_real
    return None


def _row_str(df, i: int, col_real: str | None) -> str | None:
    if col_real is None:
        return None
    val = df[col_real][i]
    return str(val) if val is not None else None


def _save_ciclo_activities(db: Session, analysis_id: str, df):
    mapping = _norm_cols(df)
    for i in range(len(df)):
        def g(logical, _i=i): return _row_str(df, _i, _find_col(mapping, logical))
        mes_realizado = g("realizado")
        mes_agendado = g("agendado")
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
        activity = CicloActivity(
            id=gen_uuid(),
            analysis_id=analysis_id,
            item=g("item"), atividade=g("atividade"), gerencia=g("gerencia"),
            setor=g("setor"), regulado=g("regulado"), cidade=cidade_val,
            mes=g("mes"), mes_agendado=mes_agendado, mes_realizado=mes_realizado,
            giaso=giaso_val, processo=processo_val, pcdp=pcdp_val,
            prioridade=g("prioridade"), status=row_status,
            sem_giaso=1 if _is_empty_val(giaso_val) else 0,
            sem_pcdp=1 if _is_empty_val(pcdp_val) else 0,
            sem_processo=1 if _is_empty_val(processo_val) else 0,
            local_indefinido=1 if _is_empty_val(cidade_val) else 0,
        )
        db.add(activity)
        if is_pendencia(activity):
            db.add(PendenciaTracking(
                source_type="ciclo",
                source_id=activity.id,
                severity=classify_severity(activity),
            ))


@router.post("/upload", response_model=UploadResponse, tags=["Upload"])
async def upload_file(
    file: UploadFile = File(...),
    _: str = Depends(require_analyst_or_admin),
):
    """Save file to disk and return an upload ID for the two-step flow."""
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Formato não suportado: '{suffix}'. Use CSV, XLSX ou XLS.",
        )
    content = await file.read()
    if len(content) > settings.max_upload_size_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Arquivo excede {settings.max_upload_size_mb} MB.")

    ok, reason = validate_file_bytes(file.filename or "", content)
    if not ok:
        raise HTTPException(status_code=400, detail=reason)

    safe_name = sanitize_filename(file.filename or "upload")
    upload_path = Path(settings.upload_dir) / safe_name
    upload_path.parent.mkdir(parents=True, exist_ok=True)
    with open(upload_path, "wb") as f:
        f.write(content)

    return UploadResponse(
        id=safe_name.split("_")[0],
        original_filename=file.filename or "upload",
        file_type=suffix.lstrip("."),
        size_bytes=len(content),
        message="Arquivo recebido com sucesso.",
    )


@router.post("/upload-and-analyze", response_model=AnalysisResponse, tags=["Upload"], status_code=201)
async def upload_and_analyze(
    file: UploadFile = File(...),
    force: bool = Query(False, description="Ignora erros bloqueantes de qualidade e prossegue com a análise."),
    current_user: str = Depends(require_analyst_or_admin),
    db: Session = Depends(get_db),
):
    """Upload file and immediately run analysis. Returns the full analysis record."""
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Formato não suportado: '{suffix}'. Use CSV, XLSX ou XLS.",
        )
    content = await file.read()
    if len(content) > settings.max_upload_size_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Arquivo excede {settings.max_upload_size_mb} MB.")

    ok, reason = validate_file_bytes(file.filename or "", content)
    if not ok:
        raise HTTPException(status_code=400, detail=reason)

    safe_name = sanitize_filename(file.filename or "upload")
    upload_path = Path(settings.upload_dir) / safe_name
    upload_path.parent.mkdir(parents=True, exist_ok=True)
    with open(upload_path, "wb") as f:
        f.write(content)

    try:
        # Processamento pesado em thread pool para não bloquear o event loop
        loop = asyncio.get_event_loop()
        df = await loop.run_in_executor(None, read_file, upload_path)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Erro ao ler o arquivo: {e}")

    def _analyze():
        d_type = classify_spreadsheet(df)
        if d_type == "ciclos":
            return d_type, analyze_ciclos_with_breakdown(df)
        return "generic", analyze_generic(df)

    detected_type, indicators = await loop.run_in_executor(None, _analyze)

    quality_report = validate_quality(df, detected_type, db)
    if quality_report["errors"] and not force:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "A planilha não passou na validação de qualidade. "
                           "Corrija os erros listados ou reenvie com force=true para prosseguir mesmo assim.",
                "quality_report": quality_report,
            },
        )

    now = datetime.now(timezone.utc)
    original_name = file.filename or safe_name

    # Link to previous version of the same file
    previous = (
        db.query(Analysis)
        .filter(Analysis.original_filename == original_name)
        .order_by(Analysis.created_at.desc())
        .first()
    )
    parent_id = str(previous.id) if previous else None
    version   = (previous.version or 1) + 1 if previous else 1

    analysis = Analysis(
        original_filename=original_name,
        stored_filename=safe_name,
        file_type=suffix.lstrip("."),
        detected_type=detected_type,
        status="completed",
        total_rows=len(df),
        total_columns=len(df.columns),
        indicators=indicators,
        quality_report=quality_report,
        created_by=current_user,
        parent_analysis_id=parent_id,
        version=version,
        created_at=now,
        completed_at=now,
    )
    db.add(analysis)
    db.flush()

    if detected_type == "ciclos":
        _save_ciclo_activities(db, str(analysis.id), df)

    db.commit()
    db.refresh(analysis)

    _audit(db, current_user, "analysis_created", "analysis", str(analysis.id), {
        "filename": analysis.original_filename,
        "type": detected_type,
        "file_hash": hashlib.sha256(content).hexdigest(),
        "classifier_version": CLASSIFIER_VERSION,
        "total_rows": analysis.total_rows,
        "total_columns": analysis.total_columns,
        "quality_score": quality_report["score"],
    })

    # Verificar regras de alerta + enviar email de conclusão
    await _post_analysis_hooks(analysis, db)

    return analysis


@router.post("/upload-pdf", response_model=AnalysisResponse, tags=["Upload"], status_code=201)
async def upload_and_analyze_pdf(
    file: UploadFile = File(...),
    current_user: str = Depends(require_analyst_or_admin),
    db: Session = Depends(get_db),
):
    """Upload a PDF file, extract its text, and create an analysis record."""
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_PDF_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Formato não suportado: '{suffix}'. Envie um arquivo PDF.",
        )
    content = await file.read()
    if len(content) > settings.max_upload_size_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Arquivo excede {settings.max_upload_size_mb} MB.")

    safe_name = sanitize_filename(file.filename or "upload.pdf")
    upload_path = Path(settings.upload_dir) / safe_name
    upload_path.parent.mkdir(parents=True, exist_ok=True)
    with open(upload_path, "wb") as f:
        f.write(content)

    try:
        extracted = extract_pdf(upload_path)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Erro ao ler o PDF: {e}")

    indicators = summarize_pdf_indicators(extracted)

    now = datetime.now(timezone.utc)
    analysis = Analysis(
        original_filename=file.filename or safe_name,
        stored_filename=safe_name,
        file_type="pdf",
        detected_type="pdf",
        status="completed",
        total_rows=extracted["pages"],
        total_columns=0,
        indicators=indicators,
        created_by=current_user,
        created_at=now,
        completed_at=now,
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)

    _audit(db, current_user, "analysis_created", "analysis", str(analysis.id), {
        "filename": analysis.original_filename,
        "type": "pdf",
        "file_hash": hashlib.sha256(content).hexdigest(),
        "total_rows": analysis.total_rows,
        "total_columns": analysis.total_columns,
    })

    await _post_analysis_hooks(analysis, db)
    return analysis
