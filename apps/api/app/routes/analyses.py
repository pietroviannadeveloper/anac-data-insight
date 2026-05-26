from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import get_db
from app.models.analysis import Analysis, CicloActivity
from app.schemas.upload import (
    AnalysisCreate, AnalysisResponse, PaginatedAnalysesResponse,
    PreviewResponse, AlertItem, AlertsResponse, TreatedDataResponse,
)
from app.services.file_reader import read_file, get_preview
from app.services.classifier import classify_spreadsheet
from app.services.ciclo_analyzer import analyze_ciclos

router = APIRouter()


def _find_file(upload_id: str) -> Path:
    """Find uploaded file by 8-char UUID prefix."""
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
        alerts.append(AlertItem(
            type="error",
            category="Pendência GIASO",
            message="Atividades sem número GIASO vinculado",
            count=indicators["sem_giaso"],
        ))
    if indicators.get("pcdp_duplicada", 0) > 0:
        alerts.append(AlertItem(
            type="error",
            category="PCDP Duplicado",
            message="PCDPs que aparecem em mais de uma atividade",
            count=indicators["pcdp_duplicada"],
        ))
    if indicators.get("multiplas_pcdps", 0) > 0:
        alerts.append(AlertItem(
            type="warning",
            category="Múltiplas PCDPs",
            message="Pares atividade/regulado com mais de uma PCDP distinta",
            count=indicators["multiplas_pcdps"],
        ))
    if indicators.get("sem_pcdp", 0) > 0:
        alerts.append(AlertItem(
            type="warning",
            category="Pendência PCDP",
            message="Atividades sem PCDP vinculada",
            count=indicators["sem_pcdp"],
        ))
    if indicators.get("sem_processo", 0) > 0:
        alerts.append(AlertItem(
            type="warning",
            category="Pendência Processo",
            message="Atividades sem número de processo",
            count=indicators["sem_processo"],
        ))
    if indicators.get("locais_indefinidos", 0) > 0:
        alerts.append(AlertItem(
            type="info",
            category="Local Indefinido",
            message="Atividades com cidade/local não definido",
            count=indicators["locais_indefinidos"],
        ))
    if indicators.get("sem_agendamento", 0) > 0:
        alerts.append(AlertItem(
            type="info",
            category="Sem Agendamento",
            message="Atividades sem data agendada ou realizada",
            count=indicators["sem_agendamento"],
        ))
    return alerts


@router.post("/analyses", response_model=AnalysisResponse, tags=["Analyses"], status_code=201)
async def create_analysis(body: AnalysisCreate, db: Session = Depends(get_db)):
    """Trigger analysis for an uploaded file."""
    file_path = _find_file(body.upload_id)

    try:
        df = read_file(file_path)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Erro ao ler o arquivo: {e}")

    detected_type = classify_spreadsheet(df)
    indicators: dict | None = None

    if detected_type == "ciclos":
        indicators = analyze_ciclos(df)

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

        activity = CicloActivity(
            analysis_id=analysis_id,
            item=g("item"),
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
        )
        db.add(activity)


@router.get("/analyses", response_model=PaginatedAnalysesResponse, tags=["Analyses"])
async def list_analyses(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    total = db.query(Analysis).count()
    items = (
        db.query(Analysis)
        .order_by(Analysis.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return PaginatedAnalysesResponse(items=items, total=total, page=page, per_page=per_page)


@router.get("/analyses/{analysis_id}", response_model=AnalysisResponse, tags=["Analyses"])
async def get_analysis(analysis_id: str, db: Session = Depends(get_db)):
    return _get_analysis_or_404(analysis_id, db)


@router.delete("/analyses/{analysis_id}", status_code=204, tags=["Analyses"])
async def delete_analysis(analysis_id: str, db: Session = Depends(get_db)):
    analysis = _get_analysis_or_404(analysis_id, db)
    stored = Path(settings.upload_dir) / str(analysis.stored_filename)
    if stored.exists():
        stored.unlink()
    db.delete(analysis)
    db.commit()


@router.get("/analyses/{analysis_id}/preview", response_model=PreviewResponse, tags=["Analyses"])
async def get_analysis_preview(analysis_id: str, db: Session = Depends(get_db)):
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
async def get_analysis_summary(analysis_id: str, db: Session = Depends(get_db)):
    analysis = _get_analysis_or_404(analysis_id, db)
    if analysis.detected_type != "ciclos" or not analysis.indicators:
        return {"detected_type": analysis.detected_type, "indicators": None}
    return {"detected_type": analysis.detected_type, "indicators": analysis.indicators}


@router.get("/analyses/{analysis_id}/alerts", response_model=AlertsResponse, tags=["Analyses"])
async def get_analysis_alerts(analysis_id: str, db: Session = Depends(get_db)):
    analysis = _get_analysis_or_404(analysis_id, db)
    indicators: dict = analysis.indicators or {}  # type: ignore[assignment]
    alerts = _build_alerts(indicators, str(analysis.detected_type))
    total_critical = sum(1 for a in alerts if a.type == "error")
    return AlertsResponse(alerts=alerts, total_critical=total_critical)


@router.get("/analyses/{analysis_id}/treated-data", response_model=TreatedDataResponse, tags=["Analyses"])
async def get_treated_data(
    analysis_id: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    _get_analysis_or_404(analysis_id, db)
    total = db.query(CicloActivity).filter(CicloActivity.analysis_id == analysis_id).count()
    items = (
        db.query(CicloActivity)
        .filter(CicloActivity.analysis_id == analysis_id)
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return TreatedDataResponse(items=items, total=total)


@router.get("/analyses/{analysis_id}/export/excel", tags=["Analyses"])
async def export_excel(analysis_id: str, db: Session = Depends(get_db)):
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

        return FileResponse(
            path=str(out_path),
            filename=f"analise_{analysis_id}.xlsx",
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar exportação: {e}")
