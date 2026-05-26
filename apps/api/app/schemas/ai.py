from pydantic import BaseModel, ConfigDict
from typing import List
from datetime import datetime


class PlanoAcaoItem(BaseModel):
    prioridade: str  # Alta | Média | Baixa
    acao: str
    justificativa: str


class AIAnalysisResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    analysis_id: str
    resumo_executivo: str
    principais_achados: List[str]
    riscos_operacionais: List[str]
    recomendacoes: List[str]
    plano_acao: List[PlanoAcaoItem]
    perguntas_sugeridas: List[str]
    created_at: datetime
