"""
AI summary service.

Supports multiple providers via the AIProvider abstract class:
  - GeminiProvider  (Google Gemini — preferred when GEMINI_API_KEY is set)
  - OpenAIProvider  (OpenAI — fallback when OPENAI_API_KEY is set)
  - MockAIProvider  (placeholder when no key is configured)

Priority: Gemini > OpenAI > Mock
"""

from abc import ABC, abstractmethod
import json
import re

import httpx


# ── prompts por tipo de análise ───────────────────────────────────────────

_JSON_SCHEMA = """Gere um relatório executivo em JSON com exatamente estas chaves:
- "resumo_executivo": string com análise geral objetiva e útil
- "principais_achados": lista de strings com os pontos mais relevantes encontrados
- "riscos_operacionais": lista de strings com riscos ou problemas identificados
- "recomendacoes": lista de strings com ações concretas recomendadas
- "plano_acao": lista de objetos com chaves "prioridade" ("Alta", "Média" ou "Baixa"), "acao" e "justificativa"
- "perguntas_sugeridas": lista de strings com perguntas para aprofundar a análise

Regras obrigatórias:
- Responda APENAS com o JSON válido, sem texto extra.
- NÃO invente dados que não estão no conteúdo fornecido.
- Analise o que foi enviado independente do tema ou origem do documento.
- Se o documento não for da ANAC, analise-o da mesma forma — o sistema aceita qualquer documento."""


def _build_prompt(indicators: dict, context: str, analysis_type: str = "ciclos") -> str:
    indicators_json = json.dumps(indicators, ensure_ascii=False, indent=2)

    if analysis_type == "pdf":
        return f"""Você é um analista especializado em leitura e síntese de documentos.
Analise o documento abaixo e gere um relatório executivo útil sobre seu conteúdo.

METADADOS DO DOCUMENTO:
{indicators_json}

CONTEÚDO DO DOCUMENTO:
{context}

{_JSON_SCHEMA}"""

    if analysis_type == "generic":
        return f"""Você é um analista de dados especializado em análise exploratória de planilhas e bases de dados.
Analise a planilha abaixo com base no perfil de colunas e contexto fornecidos.

PERFIL DA PLANILHA:
{indicators_json}

CONTEXTO ADICIONAL:
{context}

{_JSON_SCHEMA}"""

    # ciclos (padrão ANAC)
    return f"""Você é um analista especializado em planejamento e controle de atividades operacionais.
Analise os indicadores do ciclo de fiscalização abaixo e gere um relatório executivo detalhado.

INDICADORES DO CICLO:
{indicators_json}

CONTEXTO:
{context}

{_JSON_SCHEMA}"""


# ── abstract base ─────────────────────────────────────────────────────────

class AIProvider(ABC):
    @abstractmethod
    async def generate_summary(self, indicators: dict, context: str, analysis_type: str = "ciclos") -> dict:
        pass


# ── Gemini ────────────────────────────────────────────────────────────────

def _extract_json(text: str) -> dict:
    """Extract JSON from AI response robustly.

    Handles: raw JSON, ```json fences, trailing text, truncated responses.
    """
    # 1. Raw parse
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass

    # 2. Strip markdown code fences
    clean = re.sub(r"```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    clean = clean.replace("```", "").strip()
    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        pass

    # 3. Extract from first { to matching closing }
    start = text.find("{")
    if start != -1:
        depth = 0
        for i, ch in enumerate(text[start:], start):
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    candidate = text[start : i + 1]
                    try:
                        return json.loads(candidate)
                    except json.JSONDecodeError:
                        break

    # 4. Truncated JSON recovery — fix incomplete response by closing open structures
    if start != -1:
        fragment = (clean if clean.startswith("{") else text[start:]).rstrip()
        # Close any open string first
        if fragment.count('"') % 2 == 1:
            fragment += '"'
        # Close open arrays/objects
        opens = fragment.count("[") - fragment.count("]")
        closes = fragment.count("{") - fragment.count("}")
        fragment += "]" * max(opens, 0) + "}" * max(closes, 0)
        try:
            return json.loads(fragment)
        except json.JSONDecodeError:
            pass

    # 5. Last resort: extract individual string fields with regex
    result: dict = {}
    for key in ("resumo_executivo", "principais_achados", "riscos_operacionais",
                "recomendacoes", "plano_acao", "perguntas_sugeridas"):
        m = re.search(rf'"{key}"\s*:\s*"(.*?)(?<!\\)"', text, re.DOTALL)
        if m:
            result[key] = m.group(1).replace('\\"', '"')
    if result:
        result.setdefault("resumo_executivo", "Resumo parcialmente extraído da resposta.")
        result.setdefault("principais_achados", [])
        result.setdefault("riscos_operacionais", [])
        result.setdefault("recomendacoes", [])
        result.setdefault("plano_acao", [])
        result.setdefault("perguntas_sugeridas", [])
        return result

    raise ValueError(f"Nenhum JSON válido encontrado na resposta: {text[:300]}")


class GeminiProvider(AIProvider):
    """Google Gemini via REST API — no extra SDK required."""

    _BASE = "https://generativelanguage.googleapis.com/v1beta/models"

    def __init__(self, api_key: str, model: str = "gemini-2.5-flash"):
        self.api_key = api_key
        self.model = model

    async def generate_summary(self, indicators: dict, context: str, analysis_type: str = "ciclos") -> dict:
        url = f"{self._BASE}/{self.model}:generateContent?key={self.api_key}"
        payload = {
            "contents": [{"parts": [{"text": _build_prompt(indicators, context, analysis_type)}]}],
            "generationConfig": {
                "temperature": 0.3,
                "maxOutputTokens": 8192,
                "responseMimeType": "application/json",
            },
        }

        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post(url, json=payload)

        if resp.status_code != 200:
            raise RuntimeError(f"Gemini retornou status {resp.status_code}: {resp.text[:300]}")

        data = resp.json()
        try:
            raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
            return _extract_json(raw_text)
        except (KeyError, IndexError) as e:
            raise RuntimeError(f"Resposta inesperada do Gemini: {e} — {resp.text[:200]}")


# ── OpenAI ────────────────────────────────────────────────────────────────

class OpenAIProvider(AIProvider):
    def __init__(self, api_key: str, model: str = "gpt-4o"):
        self.api_key = api_key
        self.model = model

    async def generate_summary(self, indicators: dict, context: str, analysis_type: str = "ciclos") -> dict:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "model": self.model,
                    "messages": [{"role": "user", "content": _build_prompt(indicators, context, analysis_type)}],
                    "response_format": {"type": "json_object"},
                    "max_tokens": 8192,
                },
            )
        resp.raise_for_status()
        return json.loads(resp.json()["choices"][0]["message"]["content"])


# ── Mock ──────────────────────────────────────────────────────────────────

class MockAIProvider(AIProvider):
    """Usado quando nenhuma chave de IA está configurada."""

    async def generate_summary(self, indicators: dict, context: str, analysis_type: str = "ciclos") -> dict:
        return {
            "resumo_executivo": (
                "Nenhum provedor de IA configurado. "
                "Adicione GEMINI_API_KEY ou OPENAI_API_KEY no arquivo .env para habilitar resumos automáticos."
            ),
            "principais_achados": ["Configure uma chave de IA para gerar análises automáticas."],
            "riscos_operacionais": [],
            "recomendacoes": [],
            "plano_acao": [],
            "perguntas_sugeridas": [],
        }


# ── factory ───────────────────────────────────────────────────────────────

def get_ai_provider() -> AIProvider:
    """Return the best available provider: Gemini > OpenAI > Mock."""
    from app.core.config import settings

    if settings.gemini_api_key:
        return GeminiProvider(settings.gemini_api_key, settings.gemini_model)
    if settings.openai_api_key:
        return OpenAIProvider(settings.openai_api_key, settings.openai_model)
    return MockAIProvider()
