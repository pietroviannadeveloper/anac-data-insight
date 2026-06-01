from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_analyst_or_admin
from app.db.database import get_db
from app.models.analysis import Analysis, AIAnalysis, CicloActivity
from app.schemas.ai import AIAnalysisResponse
from app.services.ai_summary import get_ai_provider

router = APIRouter()


@router.get("/ai/status", tags=["AI"])
async def ai_status(_: str = Depends(get_current_user)):
    """Retorna qual provedor de IA está configurado."""
    from app.core.config import settings
    if settings.gemini_api_key:
        return {"provider": "gemini", "model": settings.gemini_model, "available": True}
    if settings.openai_api_key:
        return {"provider": "openai", "model": settings.openai_model, "available": True}
    return {"provider": "none", "model": None, "available": False}


def _build_rich_context(analysis: Analysis, db: Session) -> str:
    """Build a detailed context string tailored to the analysis type."""
    from app.core.config import settings
    from pathlib import Path

    lines = [
        f"Arquivo: {analysis.original_filename}",
        f"Tipo: {analysis.detected_type}",
        f"Total de registros: {analysis.total_rows}",
    ]

    # ── PDF: include extracted text so AI can actually read the document ──
    if analysis.detected_type == "pdf":
        ind = analysis.indicators or {}
        if ind.get("title"):
            lines.append(f"Título: {ind['title']}")
        if ind.get("author"):
            lines.append(f"Autor: {ind['author']}")
        lines.append(f"Páginas: {ind.get('pages', analysis.total_rows)}")
        lines.append(f"Palavras: {ind.get('word_count', 0)}")

        # Try to get full text from the stored file (up to 12 000 chars for AI)
        full_text: str = ""
        file_path = Path(settings.upload_dir) / str(analysis.stored_filename)
        if file_path.exists():
            try:
                from app.services.pdf_reader import extract_pdf
                extracted = extract_pdf(file_path)
                full_text = extracted.get("text", "")[:12_000]
            except Exception:
                pass

        if not full_text:
            full_text = ind.get("text_preview", "") or ""

        if full_text:
            lines.append("\n--- CONTEÚDO DO DOCUMENTO ---")
            lines.append(full_text)
            lines.append("--- FIM DO CONTEÚDO ---")
        else:
            lines.append("\n(Conteúdo do documento não disponível para extração de texto)")

        return "\n".join(lines)

    # ── Generic spreadsheet: include column profile ────────────────────────
    if analysis.detected_type == "generic":
        ind = analysis.indicators or {}
        cols = ind.get("columns_profile", [])
        if cols:
            lines.append("\nColunas da planilha:")
            for col in cols[:30]:
                null_info = f", {col.get('null_pct', 0)}% nulos" if col.get("null_pct", 0) > 0 else ""
                sample = ", ".join(str(s) for s in col.get("sample", [])[:3])
                lines.append(f"  - {col['name']} ({col.get('dtype', '?')}): {col.get('non_null', 0)} preenchidos{null_info} — exemplos: {sample}")
        if ind.get("duplicate_rows", 0) > 0:
            lines.append(f"\nLinhas duplicadas detectadas: {ind['duplicate_rows']}")
        if ind.get("empty_columns"):
            lines.append(f"Colunas completamente vazias: {', '.join(ind['empty_columns'])}")
        return "\n".join(lines)

    # ── Ciclos: activity + company breakdown ──────────────────────────────
    if analysis.detected_type == "ciclos":
        type_rows = (
            db.query(CicloActivity.atividade, func.count(CicloActivity.id).label("n"))
            .filter(
                CicloActivity.analysis_id == str(analysis.id),
                CicloActivity.atividade.isnot(None),
                CicloActivity.atividade != "",
            )
            .group_by(CicloActivity.atividade)
            .order_by(func.count(CicloActivity.id).desc())
            .all()
        )
        if type_rows:
            lines.append("\nTipos de atividade presentes:")
            for atv, n in type_rows:
                lines.append(f"  - {atv}: {n} atividades")

        company_rows = (
            db.query(CicloActivity.regulado, func.count(CicloActivity.id).label("n"))
            .filter(
                CicloActivity.analysis_id == str(analysis.id),
                CicloActivity.regulado.isnot(None),
            )
            .group_by(CicloActivity.regulado)
            .order_by(func.count(CicloActivity.id).desc())
            .limit(10)
            .all()
        )
        if company_rows:
            lines.append("\nEmpresas com mais atividades:")
            for empresa, n in company_rows:
                lines.append(f"  - {empresa}: {n} atividades")

        pending_rows = (
            db.query(CicloActivity.regulado, func.count(CicloActivity.id).label("n"))
            .filter(
                CicloActivity.analysis_id == str(analysis.id),
                CicloActivity.regulado.isnot(None),
                CicloActivity.status == "sem-agendamento",
            )
            .group_by(CicloActivity.regulado)
            .order_by(func.count(CicloActivity.id).desc())
            .limit(5)
            .all()
        )
        if pending_rows:
            lines.append("\nEmpresas com mais pendências sem agendamento:")
            for empresa, n in pending_rows:
                lines.append(f"  - {empresa}: {n} pendentes")

    return "\n".join(lines)


@router.post("/analyses/{analysis_id}/ai-summary", response_model=AIAnalysisResponse, tags=["AI"])
async def generate_ai_summary(
    analysis_id: str,
    current_user: str = Depends(require_analyst_or_admin),
    db: Session = Depends(get_db),
):
    """Gera um resumo executivo com IA para uma análise concluída."""
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")

    if analysis.status != "completed":
        raise HTTPException(status_code=422, detail="A análise ainda não foi concluída.")

    # Return cached result
    existing = db.query(AIAnalysis).filter(AIAnalysis.analysis_id == analysis_id).first()
    if existing:
        return existing

    indicators: dict = analysis.indicators or {}
    context = _build_rich_context(analysis, db)

    provider = get_ai_provider()
    analysis_type = str(analysis.detected_type)
    try:
        result = await provider.generate_summary(indicators, context, analysis_type)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro ao chamar IA: {str(e)}")

    ai_record = AIAnalysis(
        analysis_id=analysis_id,
        resumo_executivo=result.get("resumo_executivo", ""),
        principais_achados=result.get("principais_achados", []),
        riscos_operacionais=result.get("riscos_operacionais", []),
        recomendacoes=result.get("recomendacoes", []),
        plano_acao=result.get("plano_acao", []),
        perguntas_sugeridas=result.get("perguntas_sugeridas", []),
        created_at=datetime.now(timezone.utc),
    )
    db.add(ai_record)
    db.commit()
    db.refresh(ai_record)
    return ai_record


@router.delete("/analyses/{analysis_id}/ai-summary", status_code=204, tags=["AI"])
async def delete_ai_summary(
    analysis_id: str,
    _: str = Depends(require_analyst_or_admin),
    db: Session = Depends(get_db),
):
    """Remove o resumo em cache para permitir regeneração."""
    existing = db.query(AIAnalysis).filter(AIAnalysis.analysis_id == analysis_id).first()
    if existing:
        db.delete(existing)
        db.commit()


@router.get("/analyses/{analysis_id}/ai-summary", response_model=AIAnalysisResponse, tags=["AI"])
async def get_ai_summary(
    analysis_id: str,
    _: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retorna o resumo IA já gerado (cache)."""
    existing = db.query(AIAnalysis).filter(AIAnalysis.analysis_id == analysis_id).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Resumo de IA ainda não gerado. Use POST para gerar.")
    return existing
