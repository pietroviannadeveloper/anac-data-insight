"""Shared fixtures for all tests."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.database import Base, get_db
from app.main import app
from app.core.security import get_password_hash
from app.models.user import User


@pytest.fixture(scope="session")
def db_engine():
    # Import all models so SQLAlchemy registers them in Base.metadata
    from app.models import analysis, user  # noqa: F401
    # StaticPool ensures all connections share the same in-memory DB
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db_session(db_engine):
    Session = sessionmaker(bind=db_engine)
    session = Session()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture()
def client(db_session):
    def _override_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_db
    # Seed users
    if not db_session.query(User).filter(User.username == "admin_test").first():
        db_session.add(User(
            username="admin_test",
            password_hash=get_password_hash("admin123"),
            role="admin",
            is_active=True,
        ))
    if not db_session.query(User).filter(User.username == "analyst_test").first():
        db_session.add(User(
            username="analyst_test",
            password_hash=get_password_hash("analyst123"),
            role="analyst",
            is_active=True,
        ))
    if not db_session.query(User).filter(User.username == "viewer_test").first():
        db_session.add(User(
            username="viewer_test",
            password_hash=get_password_hash("viewer123"),
            role="viewer",
            is_active=True,
        ))
    db_session.commit()

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()


def _get_token(client, username: str, password: str) -> str:
    r = client.post("/api/v1/auth/token", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture()
def admin_token(client):
    return _get_token(client, "admin_test", "admin123")


@pytest.fixture()
def analyst_token(client):
    return _get_token(client, "analyst_test", "analyst123")


@pytest.fixture()
def viewer_token(client):
    return _get_token(client, "viewer_test", "viewer123")
