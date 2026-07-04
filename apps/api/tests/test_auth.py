"""Tests for auth.py routes."""
import pytest


def test_login_valid_credentials(client):
    r = client.post("/api/v1/auth/token", json={"username": "admin_test", "password": "admin123"})
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data
    assert data["access_token"]
    assert data["role"] == "admin"


def test_login_wrong_password(client):
    r = client.post("/api/v1/auth/token", json={"username": "admin_test", "password": "wrongpass"})
    assert r.status_code == 401


def test_login_unknown_user(client):
    r = client.post("/api/v1/auth/token", json={"username": "nobody", "password": "any"})
    assert r.status_code == 401


def test_login_inactive_user(client, db_session):
    from app.models.user import User
    user = db_session.query(User).filter(User.username == "viewer_test").first()
    user.is_active = False
    db_session.commit()

    r = client.post("/api/v1/auth/token", json={"username": "viewer_test", "password": "viewer123"})
    assert r.status_code == 401

    # restore
    user.is_active = True
    db_session.commit()


def test_login_sets_cookie(client):
    r = client.post("/api/v1/auth/token", json={"username": "admin_test", "password": "admin123"})
    assert r.status_code == 200
    # TestClient collects cookies from responses
    assert "anac_token" in r.cookies or "anac_token" in client.cookies


def test_logout(client):
    r = client.post("/api/v1/auth/logout")
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_me_authenticated(client, admin_token):
    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    data = r.json()
    assert data["username"] == "admin_test"
    assert data["role"] == "admin"


def test_me_unauthenticated(client):
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 401


def test_analyst_login(client):
    r = client.post("/api/v1/auth/token", json={"username": "analyst_test", "password": "analyst123"})
    assert r.status_code == 200
    assert r.json()["role"] == "analyst"


def test_viewer_login(client):
    r = client.post("/api/v1/auth/token", json={"username": "viewer_test", "password": "viewer123"})
    assert r.status_code == 200
    assert r.json()["role"] == "viewer"


def test_change_password_success(client, analyst_token):
    r = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "analyst123", "new_password": "newpass456"},
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 200
    assert r.json()["ok"] is True

    # login with new password should work
    r2 = client.post("/api/v1/auth/token", json={"username": "analyst_test", "password": "newpass456"})
    assert r2.status_code == 200

    # restore password
    new_token = r2.json()["access_token"]
    client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "newpass456", "new_password": "analyst123"},
        headers={"Authorization": f"Bearer {new_token}"},
    )


def test_change_password_wrong_current(client, admin_token):
    r = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "wrongcurrent", "new_password": "newpass456"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 400


def test_change_password_too_short(client, admin_token):
    r = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "admin123", "new_password": "123"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 400


def test_change_password_unauthenticated(client):
    r = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "admin123", "new_password": "newpass456"},
    )
    assert r.status_code == 401
