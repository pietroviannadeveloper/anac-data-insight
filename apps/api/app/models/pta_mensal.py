import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from app.db.database import Base


def _gen_uuid() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


TIPOS_MENSAL = [
    "CICLO_BASE",
    "CICLO_DESEMPENHO",
    "CONTROLE_PTA",
    "PTA_FINAL",
    "NAO_INFORMADA",
]


class PTAMensalUpload(Base):
    """One uploaded spreadsheet for the PTA vigente (2026)."""

    __tablename__ = "pta_mensal_uploads"

    id = Column(String, primary_key=True, default=_gen_uuid)
    tipo = Column(String, nullable=False)
    year = Column(Integer, nullable=False, default=2026)
    filename = Column(String, nullable=True)
    stored_filename = Column(String, nullable=True)
    total_rows = Column(Integer, default=0)
    indicators = Column(JSON, nullable=True)
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=_utcnow)

    activities = relationship(
        "PTAMensalActivity",
        back_populates="upload",
        cascade="all, delete-orphan",
    )


class PTAMensalActivity(Base):
    """One activity row from a PTAMensalUpload spreadsheet."""

    __tablename__ = "pta_mensal_activities"

    id = Column(String, primary_key=True, default=_gen_uuid)
    upload_id = Column(String, ForeignKey("pta_mensal_uploads.id"), nullable=False)

    item = Column(String, nullable=True)
    atividade = Column(String, nullable=True)
    gerencia = Column(String, nullable=True)
    setor = Column(String, nullable=True)
    regulado = Column(String, nullable=True)
    cidade = Column(String, nullable=True)
    servidor = Column(String, nullable=True)          # GIASO = servidor responsável
    mes = Column(String, nullable=True)               # coluna Mes — mês original do PTA
    mes_agendado = Column(String, nullable=True)
    mes_realizado = Column(String, nullable=True)
    mes_num = Column(Integer, nullable=True)          # mês numérico (MesRealizado > MesAgendado > Mes)
    mes_original_num = Column(Integer, nullable=True) # mês numérico da coluna Mes (plano original)
    giaso = Column(String, nullable=True)
    processo = Column(String, nullable=True)
    pcdp = Column(String, nullable=True)
    pcdp_tipo = Column(String, nullable=True)         # valida | remota | cancelada | especial | vazia
    prioridade = Column(String, nullable=True)

    # computed flags
    status = Column(String, nullable=True)            # realizado | agendado | sem-agendamento
    remanejado = Column(Integer, default=0)           # 1 se Mes != MesAgendado
    sem_giaso = Column(Integer, default=0)
    sem_pcdp_valida = Column(Integer, default=0)      # 1 se não tem PCDP com número válido
    sem_pcdp = Column(Integer, default=0)             # 1 se campo PCDP vazio
    sem_processo = Column(Integer, default=0)
    local_indefinido = Column(Integer, default=0)
    tipo_ciclo = Column(String, nullable=True)

    upload = relationship("PTAMensalUpload", back_populates="activities")
