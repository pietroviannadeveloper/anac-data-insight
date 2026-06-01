"""
Chat endpoint — natural language queries over analysis data.

Approach: Text-to-Context (not vector RAG).
1. Receive user question + optional analysis_id.
2. Query DB for structured context (aggregations, top values).
3. Send question + context to AI provider.
4. Return natural language answer in Portuguese.
"""

from __future__ import annotations

import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.analysis import Analysis, CicloActivity
from app.services.ai_summary import get_ai_provider

router = APIRouter()


class ChatRequest(BaseModel):
    question: str
    analysis_id: Optional[str] = None


class ChatResponse(BaseModel):
    answer: str
    context_used: str
    analysis_id: Optional[str] = None


def _build_context(analysis_id: Optional[str], db: Session) -> tuple[str, str]:
    """Build a structured context string and a description of what was used."""

    q = db.query(CicloActivity)
    if analysis_id:
        analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
        if not analysis:
            raise HTTPException(status_code=404, detail="Análise não encontrada.")
        q = q.filter(CicloActivity.analysis_id == analysis_id)
        scope = f"análise '{analysis.original_filename}'"
    else:
        scope = "todas as análises disponíveis"

    total = q.count()
    if total == 0:
        return "Nenhuma atividade encontrada.", scope

    lines = [f"Total de atividades: {total}", f"Escopo: {scope}", ""]

    # Status breakdown
    status_rows = (
        q.with_entities(CicloActivity.status, func.count(CicloActivity.id))
        .group_by(CicloActivity.status).all()
    )
    if status_rows:
        lines.append("Status das atividades:")
        for s, c in status_rows:
            lines.append(f"  - {s}: {c} ({round(c/total*100, 1)}%)")
        lines.append("")

    # Top companies by sem_giaso
    giaso_rows = (
        q.filter(CicloActivity.sem_giaso == 1)
        .with_entities(CicloActivity.regulado, func.count(CicloActivity.id).label("n"))
        .group_by(CicloActivity.regulado)
        .order_by(func.count(CicloActivity.id).desc())
        .limit(10).all()
    )
    if giaso_rows:
        lines.append("Empresas com mais atividades sem GIASO:")
        for empresa, n in giaso_rows:
            lines.append(f"  - {empresa or '(não informado)'}: {n}")
        lines.append("")

    # Top companies by total activities
    company_rows = (
        q.with_entities(CicloActivity.regulado, func.count(CicloActivity.id).label("n"))
        .filter(CicloActivity.regulado.isnot(None))
        .group_by(CicloActivity.regulado)
        .order_by(func.count(CicloActivity.id).desc())
        .limit(10).all()
    )
    if company_rows:
        lines.append("Empresas com mais atividades no total:")
        for empresa, n in company_rows:
            lines.append(f"  - {empresa}: {n}")
        lines.append("")

    # Top gerencias
    gerencia_rows = (
        q.with_entities(CicloActivity.gerencia, func.count(CicloActivity.id).label("n"))
        .filter(CicloActivity.gerencia.isnot(None))
        .group_by(CicloActivity.gerencia)
        .order_by(func.count(CicloActivity.id).desc())
        .limit(10).all()
    )
    if gerencia_rows:
        lines.append("Gerências com mais atividades:")
        for g, n in gerencia_rows:
            lines.append(f"  - {g}: {n}")
        lines.append("")

    # Cities with most indefinido
    city_rows = (
        q.filter(CicloActivity.local_indefinido == 1)
        .with_entities(CicloActivity.gerencia, func.count(CicloActivity.id).label("n"))
        .group_by(CicloActivity.gerencia)
        .order_by(func.count(CicloActivity.id).desc())
        .limit(5).all()
    )
    if city_rows:
        lines.append("Gerências com mais locais indefinidos:")
        for g, n in city_rows:
            lines.append(f"  - {g or '(não informado)'}: {n}")
        lines.append("")

    # Pending items
    sem_pcdp = q.filter(CicloActivity.sem_pcdp == 1).count()
    sem_proc  = q.filter(CicloActivity.sem_processo == 1).count()
    lines.append(f"Atividades sem PCDP: {sem_pcdp}")
    lines.append(f"Atividades sem processo: {sem_proc}")

    # Tipo ciclo breakdown
    tipo_rows = (
        q.with_entities(CicloActivity.tipo_ciclo, func.count(CicloActivity.id).label("n"))
        .filter(CicloActivity.tipo_ciclo.isnot(None))
        .group_by(CicloActivity.tipo_ciclo).all()
    )
    if tipo_rows:
        lines.append("")
        lines.append("Distribuição por tipo de ciclo:")
        for t, n in tipo_rows:
            lines.append(f"  - {t}: {n}")

    return "\n".join(lines), scope


def _build_chat_prompt(question: str, context: str) -> str:
    return f"""Você é um assistente analítico especializado em dados de fiscalização e planejamento de atividades.

Responda à pergunta do usuário com base EXCLUSIVAMENTE nos dados fornecidos abaixo.
Seja objetivo, direto e use português brasileiro.
Formate a resposta de forma clara — use listas quando houver múltiplos itens.
Se os dados não forem suficientes para responder, diga claramente o que está faltando.
Não invente informações além dos dados fornecidos.

DADOS DISPONÍVEIS:
{context}

PERGUNTA DO USUÁRIO:
{question}

RESPOSTA:"""


@router.post("/chat", response_model=ChatResponse, tags=["Chat"])
async def chat_with_data(
    body: ChatRequest,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Recebe uma pergunta em linguagem natural e responde com base nos dados de atividades.
    Escopo: todas as análises ou uma análise específica via analysis_id.
    """
    if not body.question.strip():
        raise HTTPException(status_code=400, detail="A pergunta não pode estar vazia.")

    context, scope = _build_context(body.analysis_id, db)
    prompt = _build_chat_prompt(body.question.strip(), context)

    provider = get_ai_provider()

    # Use the provider's raw HTTP client instead of generate_summary
    try:
        from app.core.config import settings
        import httpx

        if settings.gemini_api_key:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent?key={settings.gemini_api_key}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.2, "maxOutputTokens": 4096},
            }
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(url, json=payload)
            resp.raise_for_status()
            answer = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()

        elif settings.openai_api_key:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                    json={
                        "model": settings.openai_model,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.2,
                    },
                )
            resp.raise_for_status()
            answer = resp.json()["choices"][0]["message"]["content"].strip()

        else:
            answer = (
                "Nenhum provedor de IA está configurado. "
                "Adicione GEMINI_API_KEY ou OPENAI_API_KEY no arquivo .env para usar o chat."
            )

    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Erro ao consultar IA: {exc}")

    return ChatResponse(
        answer=answer,
        context_used=scope,
        analysis_id=body.analysis_id,
    )
