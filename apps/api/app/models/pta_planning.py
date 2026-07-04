import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, JSON, Text
from app.db.database import Base


def _gen_uuid() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class PTAPlanning(Base):
    """Persisted PTA planning scope — one record per analysis run."""

    __tablename__ = "pta_planejamentos"

    id            = Column(String,  primary_key=True, default=_gen_uuid)
    label         = Column(String,  nullable=True)          # optional user description
    ano_referencia= Column(Integer, nullable=False)
    tipos_carregados = Column(JSON, nullable=True)          # ["CICLO_BASE", ...]
    resultado     = Column(JSON,    nullable=True)          # full scope payload
    created_by    = Column(String,  nullable=True)
    created_at    = Column(DateTime, default=_utcnow)
