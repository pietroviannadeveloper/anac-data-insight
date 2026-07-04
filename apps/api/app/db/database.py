from sqlalchemy import create_engine, inspect
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

engine = create_engine(
    settings.database_url,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """Initialize schema and seed the admin user.

    Strategy for PostgreSQL:
    - create_all() creates tables from models (idempotent).
    - If alembic_version is absent, stamp head so future 'alembic upgrade' works.
    - If alembic_version exists, run upgrade head to apply any pending migrations.
    """
    # Import all models so Base.metadata knows every table
    from app.models import analysis  # noqa: F401
    from app.models import user  # noqa: F401
    from app.models import pta  # noqa: F401
    from app.models import pta_planning  # noqa: F401
    from app.models import pta_mensal  # noqa: F401
    from app.models import scheduled  # noqa: F401
    from app.models import dictionary  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _sync_alembic()
    _seed_admin()


def _sync_alembic() -> None:
    """Stamp or upgrade Alembic so the version table stays in sync."""
    from pathlib import Path
    from alembic import command
    from alembic.config import Config

    ini_path = Path(__file__).resolve().parents[2] / "alembic.ini"
    alembic_cfg = Config(str(ini_path))
    alembic_cfg.set_main_option("sqlalchemy.url", settings.database_url)

    with engine.connect() as conn:
        table_names = inspect(conn).get_table_names()
        if "alembic_version" not in table_names:
            # Fresh DB: tables created by create_all — mark all migrations as applied
            command.stamp(alembic_cfg, "head")
        else:
            # Existing DB: apply any pending migrations
            command.upgrade(alembic_cfg, "head")


def _seed_admin() -> None:
    """Ensure the superadmin user (pietro.rocha) exists and has role='admin'.

    Handles three cases:
    - Fresh DB: creates the admin user.
    - Old 'admin' user from previous seed: migrates to new username/password.
    - Admin already exists: ensures role is correct.
    """
    from app.core.security import get_password_hash
    from app.models.user import User

    db = SessionLocal()
    try:
        new_admin = db.query(User).filter(User.username == settings.auth_username).first()
        if new_admin:
            if new_admin.role != "admin":
                new_admin.role = "admin"  # type: ignore[assignment]
                db.commit()
            return

        old_admin = db.query(User).filter(User.username == "admin").first()
        if old_admin:
            old_admin.username = settings.auth_username  # type: ignore[assignment]
            old_admin.password_hash = get_password_hash(settings.auth_password)  # type: ignore[assignment]
            old_admin.role = "admin"  # type: ignore[assignment]
            db.commit()
            return

        db.add(User(
            username=settings.auth_username,
            password_hash=get_password_hash(settings.auth_password),
            role="admin",
            is_active=True,
        ))
        db.commit()
    finally:
        db.close()
