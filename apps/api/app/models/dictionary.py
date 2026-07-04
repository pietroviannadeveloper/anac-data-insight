from sqlalchemy import Column, DateTime, Integer, JSON, String

from app.db.database import Base
from app.models.analysis import gen_uuid, utcnow

# Valid categories: "gerencia" | "cidade" | "servidor" | "status" | "categoria_atividade"
VALID_CATEGORIES = ("gerencia", "cidade", "servidor", "status", "categoria_atividade")


class DictionaryEntry(Base):
    """Canonical value + known aliases for a normalization category.

    Used to flag (not silently rewrite) divergent values found in uploaded
    spreadsheets, e.g. "GPA" / "G. Planejamento" both mapping to the
    canonical "Gerência de Planejamento".
    """
    __tablename__ = "dictionary_entries"

    id = Column(String, primary_key=True, default=gen_uuid)
    category = Column(String, nullable=False)
    canonical_value = Column(String, nullable=False)
    aliases = Column(JSON, default=list)
    active = Column(Integer, default=1)
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow)
