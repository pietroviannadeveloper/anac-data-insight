from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.analysis import Analysis, AIAnalysis
from app.schemas.ai import AIAnalysisResponse
from app.services.ai_summary import get_ai_provider

router = APIRouter()


@router.post("/analyses/{analysis_id}/ai-summary", response_model=AIAnalysisResponse, tags=["AI"])
async def generate_ai_summary(analysis_id: str, db: Session = Depends(get_db)):
    """Generate an AI-powered executive summary for a completed analysis."""
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")

    if analysis.status != "completed":
        raise HTTPException(status_code=422, detail="A análise ainda não foi concluída.")

    # Return cached result if already generated
    existing = db.query(AIAnalysis).filter(AIAnalysis.analysis_id == analysis_id).first()
    if existing:
        return existing

    indicators: dict = analysis.indicators or {}  # type: ignore[assignment]
    context = (
        f"Arquivo: {analysis.original_filename}, "
        f"Tipo: {analysis.detected_type}, "
        f"Total de linhas: {analysis.total_rows}"
    )

    provider = get_ai_provider()
    try:
        result = await provider.generate_summary(indicators, context)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro ao chamar provedor de IA: {e}")

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


@router.get("/analyses/{analysis_id}/ai-summary", response_model=AIAnalysisResponse, tags=["AI"])
async def get_ai_summary(analysis_id: str, db: Session = Depends(get_db)):
    """Return the cached AI summary for an analysis, if it exists."""
    existing = db.query(AIAnalysis).filter(AIAnalysis.analysis_id == analysis_id).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Resumo de IA ainda não gerado. Use POST para gerar.")
    return existing
