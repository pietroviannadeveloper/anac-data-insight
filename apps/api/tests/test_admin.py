"""Tests for admin.py routes."""
import pytest


# ── User listing ──────────────────────────────────────────────────────────────

def test_list_users_admin(client, admin_token):
    r = client.get("/api/v1/admin/users", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    usernames = [u["username"] for u in data]
    assert "admin_test" in usernames


def test_list_users_analyst_forbidden(client, analyst_token):
    r = client.get("/api/v1/admin/users", headers={"Authorization": f"Bearer {analyst_token}"})
    assert r.status_code == 403


def test_list_users_viewer_forbidden(client, viewer_token):
    r = client.get("/api/v1/admin/users", headers={"Authorization": f"Bearer {viewer_token}"})
    assert r.status_code == 403


def test_list_users_unauthenticated(client):
    r = client.get("/api/v1/admin/users")
    assert r.status_code == 401


# ── User creation ─────────────────────────────────────────────────────────────

def test_create_user_admin(client, admin_token):
    r = client.post(
        "/api/v1/admin/users",
        json={"username": "newuser_test", "password": "password123", "role": "viewer"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 201
    data = r.json()
    assert data["username"] == "newuser_test"
    assert data["role"] == "viewer"


def test_create_user_duplicate(client, admin_token):
    # Create once
    client.post(
        "/api/v1/admin/users",
        json={"username": "dupuser_test", "password": "password123", "role": "viewer"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    # Create again
    r = client.post(
        "/api/v1/admin/users",
        json={"username": "dupuser_test", "password": "password123", "role": "viewer"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 409


def test_create_user_short_password(client, admin_token):
    r = client.post(
        "/api/v1/admin/users",
        json={"username": "shortpass_test", "password": "12", "role": "viewer"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 400


def test_create_user_invalid_role(client, admin_token):
    r = client.post(
        "/api/v1/admin/users",
        json={"username": "badrole_test", "password": "password123", "role": "superuser"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 400


# ── Password reset ────────────────────────────────────────────────────────────

def test_reset_password(client, admin_token, db_session):
    from app.models.user import User
    user = db_session.query(User).filter(User.username == "viewer_test").first()
    r = client.patch(
        f"/api/v1/admin/users/{user.id}/password",
        json={"password": "newviewer123"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    assert r.json()["ok"] is True

    # restore
    r2 = client.patch(
        f"/api/v1/admin/users/{user.id}/password",
        json={"password": "viewer123"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r2.status_code == 200


def test_reset_password_too_short(client, admin_token, db_session):
    from app.models.user import User
    user = db_session.query(User).filter(User.username == "viewer_test").first()
    r = client.patch(
        f"/api/v1/admin/users/{user.id}/password",
        json={"password": "12"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 400


def test_reset_password_user_not_found(client, admin_token):
    r = client.patch(
        "/api/v1/admin/users/nonexistent-id/password",
        json={"password": "newpass123"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 404


# ── Toggle user status ────────────────────────────────────────────────────────

def test_toggle_user_status(client, admin_token, db_session):
    from app.models.user import User
    user = db_session.query(User).filter(User.username == "viewer_test").first()
    original_status = user.is_active

    r = client.patch(
        f"/api/v1/admin/users/{user.id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["is_active"] != original_status

    # Toggle back
    client.patch(
        f"/api/v1/admin/users/{user.id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
    )


def test_toggle_own_status_forbidden(client, admin_token, db_session):
    from app.models.user import User
    user = db_session.query(User).filter(User.username == "admin_test").first()
    r = client.patch(
        f"/api/v1/admin/users/{user.id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 400


# ── Delete user ───────────────────────────────────────────────────────────────

def test_delete_user(client, admin_token, db_session):
    from app.models.user import User
    from app.core.security import get_password_hash
    # Create a disposable user to delete
    tmp = User(username="todelete_test", password_hash=get_password_hash("delete123"), role="viewer")
    db_session.add(tmp)
    db_session.commit()
    db_session.refresh(tmp)

    r = client.delete(
        f"/api/v1/admin/users/{tmp.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 204


def test_delete_own_user_forbidden(client, admin_token, db_session):
    from app.models.user import User
    user = db_session.query(User).filter(User.username == "admin_test").first()
    r = client.delete(
        f"/api/v1/admin/users/{user.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 400


def test_delete_user_not_found(client, admin_token):
    r = client.delete(
        "/api/v1/admin/users/nonexistent-id",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 404


# ── Stats ─────────────────────────────────────────────────────────────────────

def test_admin_stats(client, admin_token):
    r = client.get("/api/v1/admin/stats", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    data = r.json()
    assert "total_analyses" in data
    assert "total_rows_processed" in data
    assert "by_status" in data
    assert "by_type" in data
    assert "by_month" in data


def test_admin_stats_non_admin(client, analyst_token):
    r = client.get("/api/v1/admin/stats", headers={"Authorization": f"Bearer {analyst_token}"})
    assert r.status_code == 403


# ── System info ───────────────────────────────────────────────────────────────

def test_admin_system(client, admin_token):
    r = client.get("/api/v1/admin/system", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    data = r.json()
    assert "environment" in data
    assert "ai_provider" in data
    assert "database_ok" in data


# ── Access logs ───────────────────────────────────────────────────────────────

def test_access_logs(client, admin_token):
    r = client.get("/api/v1/admin/access-logs", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    data = r.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data


def test_access_logs_with_filters(client, admin_token):
    r = client.get(
        "/api/v1/admin/access-logs?username=admin_test&action=login_success",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200


# ── Audit logs ────────────────────────────────────────────────────────────────

def test_audit_logs(client, admin_token):
    r = client.get("/api/v1/admin/audit-logs", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    data = r.json()
    assert "items" in data
    assert "total" in data


def test_audit_logs_with_filters(client, admin_token):
    r = client.get(
        "/api/v1/admin/audit-logs?action=user_created",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200


# ── Admin analyses ────────────────────────────────────────────────────────────

def test_admin_analyses_list(client, admin_token):
    r = client.get("/api/v1/admin/analyses", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    data = r.json()
    assert "items" in data
    assert "total" in data


def test_admin_storage(client, admin_token):
    r = client.get("/api/v1/admin/storage", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    data = r.json()
    assert "used_bytes" in data
    assert "file_count" in data


def test_admin_analyses_with_filters(client, admin_token):
    r = client.get(
        "/api/v1/admin/analyses?status=completed&detected_type=ciclos",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200


def test_admin_analyses_date_filter(client, admin_token):
    r = client.get(
        "/api/v1/admin/analyses?data_inicio=2026-01-01&data_fim=2026-12-31",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200


def test_cleanup_old_errors(client, admin_token):
    r = client.delete(
        "/api/v1/admin/analyses/errors/cleanup?days=30",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    assert "deleted" in r.json()


def test_bulk_export_zip(client, admin_token):
    r = client.get(
        "/api/v1/admin/analyses/export/zip",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    # Returns zip file or empty zip
    assert r.status_code == 200
    assert "zip" in r.headers.get("content-type", "")


def test_bulk_delete_analyses_empty_ids(client, admin_token):
    import json
    r = client.request(
        "DELETE",
        "/api/v1/admin/analyses/bulk",
        content=json.dumps([]),
        headers={"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"},
    )
    assert r.status_code == 400


def test_bulk_delete_analyses_nonexistent(client, admin_token):
    import json
    r = client.request(
        "DELETE",
        "/api/v1/admin/analyses/bulk",
        content=json.dumps(["nonexistent-id-1", "nonexistent-id-2"]),
        headers={"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"},
    )
    assert r.status_code == 200
    assert r.json()["deleted"] == 0
