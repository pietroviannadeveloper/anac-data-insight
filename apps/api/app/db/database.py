from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# SQLite needs check_same_thread=False; PostgreSQL does not need that flag
connect_args = {}
if settings.database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.database_url,
    connect_args=connect_args,
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
    """Create all tables, run column migrations and seed the admin user."""
    from app.models import analysis  # noqa: F401
    from app.models import user as user_models  # noqa: F401
    from app.models import pta as pta_models  # noqa: F401
    from app.models import pta_planning as pta_planning_models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    _ensure_role_column()
    _migrate_old_roles()
    _seed_admin()


def _migrate_old_roles() -> None:
    """Migrate legacy 'user' role to 'analyst' so existing users keep write access."""
    from sqlalchemy import text
    try:
        with engine.connect() as conn:
            conn.execute(text("UPDATE users SET role = 'analyst' WHERE role = 'user'"))
            conn.commit()
    except Exception:
        pass


def _ensure_role_column() -> None:
    """Add role column to users table if it doesn't exist (SQLite/Postgres migration)."""
    from sqlalchemy import text
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR NOT NULL DEFAULT 'user'"))
            conn.commit()
    except Exception:
        pass  # Column already exists


def _seed_admin() -> None:
    """Ensure the superadmin user (pietro.rocha) exists and has role='admin'.

    Handles three cases:
    - Fresh DB: creates the admin user.
    - Old 'admin' user from previous seed: migrates to new username/password.
    - Admin already exists: ensures role is correct.
    """
    from app.core.config import settings
    from app.core.security import get_password_hash
    from app.models.user import User

    db = SessionLocal()
    try:
        new_admin = db.query(User).filter(User.username == settings.auth_username).first()
        if new_admin:
            if new_admin.role != "admin":
                new_admin.role = "admin"
                db.commit()
            return

        old_admin = db.query(User).filter(User.username == "admin").first()
        if old_admin:
            old_admin.username = settings.auth_username
            old_admin.password_hash = get_password_hash(settings.auth_password)
            old_admin.role = "admin"
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
