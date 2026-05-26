from abc import ABC, abstractmethod
import httpx
import json


class AIProvider(ABC):
    @abstractmethod
    async def generate_summary(self, indicators: dict, context: str) -> dict:
        pass


class OpenAIProvider(AIProvider):
    def __init__(self, api_key: str, model: str = "gpt-4o"):
        self.api_key = api_key
        self.model = model

    async def generate_summary(self, indicators: dict, context: str) -> dict:
        prompt = f"""Você é um analista de dados especializado em inspeções de aviação civil.

Com base EXCLUSIVAMENTE nos indicadores calculados abaixo, gere um relatório executivo.
NÃO invente números. NÃO adicione informações além dos dados fornecidos.

INDICADORES:
{json.dumps(indicators, ensure_ascii=False, indent=2)}

CONTEXTO: {context}

Responda em JSON com as seguintes chaves:
- resumo_executivo (string)
- principais_achados (lista de strings)
- riscos_operacionais (lista de strings)
- recomendacoes (lista de strings)
- plano_acao (lista de objetos com chaves: prioridade ["Alta"|"Média"|"Baixa"], acao, justificativa)
- perguntas_sugeridas (lista de strings com perguntas para aprofundar a análise)"""

        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "model": self.model,
                    "messages": [{"role": "user", "content": prompt}],
                    "response_format": {"type": "json_object"},
                },
                timeout=60.0,
            )
            response.raise_for_status()
            data = response.json()
            return json.loads(data["choices"][0]["message"]["content"])


class MockAIProvider(AIProvider):
    """Used when no API key is configured. Returns a placeholder response."""

    async def generate_summary(self, indicators: dict, context: str) -> dict:
        return {
            "resumo_executivo": (
                "IA não configurada. Configure OPENAI_API_KEY no arquivo .env "
                "para habilitar resumos automáticos."
            ),
            "principais_achados": ["IA não disponível no momento."],
            "riscos_operacionais": [],
            "recomendacoes": [],
            "plano_acao": [],
            "perguntas_sugeridas": [],
        }


def get_ai_provider() -> AIProvider:
    from app.core.config import settings

    if settings.openai_api_key:
        return OpenAIProvider(settings.openai_api_key, settings.openai_model)
    return MockAIProvider()
