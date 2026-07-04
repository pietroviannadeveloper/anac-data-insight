import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, JSON
from app.db.database import Base


def _gen_uuid() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class PTASnapshot(Base):
    """One PTA snapshot = indicators for one year + one ciclo type, loaded from seed CSVs."""

    __tablename__ = "pta_snapshots"

    id = Column(String, primary_key=True, default=_gen_uuid)
    year = Column(Integer, nullable=False)
    tipo_ciclo = Column(String, nullable=False)  # CICLO_BASE | CICLO_DESEMPENHO | NAO_PROGRAMADA
    source_file = Column(String, nullable=True)
    indicators = Column(JSON, nullable=True)
    total_rows = Column(Integer, default=0)
    is_seed = Column(Integer, default=1)  # 1 = historical data protected from deletion via UI
    loaded_at = Column(DateTime, default=_utcnow)
