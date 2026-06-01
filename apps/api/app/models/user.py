from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, String, Text

from app.db.database import Base


def _gen_uuid() -> str:
    import uuid
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# Valid roles: "admin" | "analyst" | "viewer"
VALID_ROLES = ("admin", "analyst", "viewer")


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=_gen_uuid)
    username = Column(String, unique=True, nullable=False)
    email = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False, default="viewer")  # "admin" | "analyst" | "viewer"
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=_utcnow)
    last_login = Column(DateTime, nullable=True)


class AccessLog(Base):
    __tablename__ = "access_logs"

    id = Column(String, primary_key=True, default=_gen_uuid)
    username = Column(String, nullable=False)
    action = Column(String, nullable=False)  # login_success | login_failed
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime, default=_utcnow)


class AuditLog(Base):
    """Audit trail for sensitive operations."""
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=_gen_uuid)
    user_id = Column(String, nullable=True)
    username = Column(String, nullable=False)
    action = Column(String, nullable=False)
    entity_type = Column(String, nullable=True)
    entity_id = Column(String, nullable=True)
    extra_data = Column(Text, nullable=True)  # JSON string
    created_at = Column(DateTime, default=_utcnow)
