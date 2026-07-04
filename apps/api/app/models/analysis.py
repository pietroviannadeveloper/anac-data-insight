import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Integer, DateTime, ForeignKey, Text, JSON
)
from sqlalchemy.orm import relationship
from app.db.database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(String, primary_key=True, default=gen_uuid)
    original_filename = Column(String, nullable=False)
    stored_filename = Column(String, nullable=False)
    file_type = Column(String, nullable=False)  # csv | xlsx | xls
    detected_type = Column(String, nullable=False, default="unknown")  # ciclos | generic | unknown
    status = Column(String, nullable=False, default="pending")  # pending | processing | completed | error
    total_rows = Column(Integer, default=0)
    total_columns = Column(Integer, default=0)
    indicators = Column(JSON, nullable=True)
    description = Column(Text, nullable=True)
    tags = Column(JSON, nullable=True, default=list)
    parent_analysis_id = Column(String, nullable=True)   # links re-uploads of the same file
    version = Column(Integer, default=1)
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    deleted_at = Column(DateTime, nullable=True)

    ciclo_activities = relationship("CicloActivity", back_populates="analysis", cascade="all, delete-orphan")
    ai_analysis = relationship("AIAnalysis", back_populates="analysis", uselist=False, cascade="all, delete-orphan")


class CicloActivity(Base):
    __tablename__ = "ciclo_activities"

    id = Column(String, primary_key=True, default=gen_uuid)
    analysis_id = Column(String, ForeignKey("analyses.id"), nullable=False)

    item = Column(String, nullable=True)
    atividade = Column(String, nullable=True)
    gerencia = Column(String, nullable=True)
    setor = Column(String, nullable=True)
    regulado = Column(String, nullable=True)
    cidade = Column(String, nullable=True)
    mes = Column(String, nullable=True)
    mes_agendado = Column(String, nullable=True)
    mes_realizado = Column(String, nullable=True)
    giaso = Column(String, nullable=True)
    processo = Column(String, nullable=True)
    pcdp = Column(String, nullable=True)
    prioridade = Column(String, nullable=True)

    status = Column(String, nullable=True)  # realizado | agendado | sem-agendamento
    sem_giaso = Column(Integer, default=0)
    sem_pcdp = Column(Integer, default=0)
    sem_processo = Column(Integer, default=0)
    local_indefinido = Column(Integer, default=0)
    tipo_ciclo = Column(String, nullable=True)  # CICLO_BASE | CICLO_DESEMPENHO | NAO_PROGRAMADA | INDEFINIDO
    criterio_classificacao = Column(String, nullable=True)

    analysis = relationship("Analysis", back_populates="ciclo_activities")


class Comment(Base):
    """User comments/annotations on an analysis."""
    __tablename__ = "comments"

    id = Column(String, primary_key=True, default=gen_uuid)
    analysis_id = Column(String, ForeignKey("analyses.id"), nullable=False)
    username = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=utcnow)


class AlertRule(Base):
    """Configurable threshold rules applied when an analysis completes."""
    __tablename__ = "alert_rules"

    id = Column(String, primary_key=True, default=gen_uuid)
    label = Column(String, nullable=False)          # Human-readable name
    metric = Column(String, nullable=False)          # e.g. taxa_execucao, pendencias_criticas
    operator = Column(String, nullable=False)        # lt | gt | lte | gte | eq
    threshold = Column(Integer, nullable=False)
    analysis_types = Column(JSON, default=list)      # ["ciclos"] or ["ciclos","generic"]
    enabled = Column(Integer, default=1)             # 1 | 0
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=utcnow)


class AlertEvent(Base):
    """Records a rule firing on a specific analysis."""
    __tablename__ = "alert_events"

    id = Column(String, primary_key=True, default=gen_uuid)
    analysis_id = Column(String, ForeignKey("analyses.id"), nullable=False)
    rule_id = Column(String, ForeignKey("alert_rules.id"), nullable=False)
    rule_label = Column(String, nullable=False)
    metric = Column(String, nullable=False)
    triggered_value = Column(Integer, nullable=True)
    threshold = Column(Integer, nullable=False)
    operator = Column(String, nullable=False)
    created_at = Column(DateTime, default=utcnow)


class AIAnalysis(Base):
    __tablename__ = "ai_analyses"

    id = Column(String, primary_key=True, default=gen_uuid)
    analysis_id = Column(String, ForeignKey("analyses.id"), nullable=False, unique=True)
    resumo_executivo = Column(Text, nullable=True)
    principais_achados = Column(JSON, default=list)
    riscos_operacionais = Column(JSON, default=list)
    recomendacoes = Column(JSON, default=list)
    plano_acao = Column(JSON, default=list)
    perguntas_sugeridas = Column(JSON, default=list)
    created_at = Column(DateTime, default=utcnow)

    analysis = relationship("Analysis", back_populates="ai_analysis")
