from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import get_db
from app.models.analysis import Analysis, CicloActivity
from app.schemas.upload import UploadResponse, AnalysisResponse
from app.services.file_reader import read_file
from app.services.classifier import classify_spreadsheet
from app.services.ciclo_analyzer import analyze_ciclos
from app.utils.file_utils import sanitize_filename

router = APIRouter()

ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls"}

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
        db.add(CicloActivity(
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
        ))


@router.post("/upload", response_model=UploadResponse, tags=["Upload"])
async def upload_file(file: UploadFile = File(...)):
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
async def upload_and_analyze(file: UploadFile = File(...), db: Session = Depends(get_db)):
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

    safe_name = sanitize_filename(file.filename or "upload")
    upload_path = Path(settings.upload_dir) / safe_name
    upload_path.parent.mkdir(parents=True, exist_ok=True)
    with open(upload_path, "wb") as f:
        f.write(content)

    try:
        df = read_file(upload_path)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Erro ao ler o arquivo: {e}")

    detected_type = classify_spreadsheet(df)
    indicators: dict | None = analyze_ciclos(df) if detected_type == "ciclos" else None

    now = datetime.now(timezone.utc)
    original_name = file.filename or safe_name
    analysis = Analysis(
        original_filename=original_name,
        stored_filename=safe_name,
        file_type=suffix.lstrip("."),
        detected_type=detected_type,
        status="completed",
        total_rows=len(df),
        total_columns=len(df.columns),
        indicators=indicators,
        created_at=now,
        completed_at=now,
    )
    db.add(analysis)
    db.flush()

    if detected_type == "ciclos":
        _save_ciclo_activities(db, str(analysis.id), df)

    db.commit()
    db.refresh(analysis)
    return analysis
