from __future__ import annotations
from datetime import datetime, timezone
import uuid

from sqlalchemy import Column, String, Text, JSON, Integer, DateTime
from app.db.database import Base


def _gen() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class ScheduledReport(Base):
    __tablename__ = "scheduled_reports"

    id                = Column(String, primary_key=True, default=_gen)
    label             = Column(String, nullable=False)
    cron_expression   = Column(String, nullable=False)  # e.g. "0 8 1 * *"
    gerencia_filter   = Column(String, nullable=True)   # filter by filename
    recipient_emails  = Column(JSON, default=list)      # list of email strings
    enabled           = Column(Integer, default=1)
    created_by        = Column(String, nullable=True)
    created_at        = Column(DateTime, default=_now)
    last_run          = Column(DateTime, nullable=True)
