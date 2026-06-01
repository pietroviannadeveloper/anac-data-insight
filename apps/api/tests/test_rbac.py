"""Tests for RBAC — 7 minimum cases from context.md."""
import io
import pytest


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


# ── 1. Viewer consegue listar análises ──────────────────────────────────────

def test_viewer_can_list_analyses(client, viewer_token):
    r = client.get("/api/v1/analyses", headers=_auth(viewer_token))
    assert r.status_code == 200


# ── 2. Viewer NÃO consegue fazer upload ────────────────────────────────────

def test_viewer_cannot_upload(client, viewer_token):
    fake = io.BytesIO(b"col1,col2\n1,2")
    r = client.post(
        "/api/v1/upload",
        files={"file": ("test.csv", fake, "text/csv")},
        headers=_auth(viewer_token),
    )
    assert r.status_code == 403


# ── 3. Viewer NÃO consegue criar análise ───────────────────────────────────

def test_viewer_cannot_create_analysis(client, viewer_token):
    r = client.post("/api/v1/analyses", json={"upload_id": "nonexistent"},
                    headers=_auth(viewer_token))
    assert r.status_code in (403, 404)


# ── 4. Analyst consegue fazer upload ────────────────────────────────────────

def test_analyst_can_upload(client, analyst_token):
    fake = io.BytesIO(b"col1,col2\n1,2")
    r = client.post(
        "/api/v1/upload",
        files={"file": ("test.csv", fake, "text/csv")},
        headers=_auth(analyst_token),
    )
    # 200 = success, 422 = file valid but analysis failed — both are past the auth gate
    assert r.status_code != 403


# ── 5. Analyst NÃO consegue gerenciar usuários ──────────────────────────────

def test_analyst_cannot_manage_users(client, analyst_token):
    r = client.get("/api/v1/admin/users", headers=_auth(analyst_token))
    assert r.status_code == 403


# ── 6. Admin consegue gerenciar usuários ────────────────────────────────────

def test_admin_can_manage_users(client, admin_token):
    r = client.get("/api/v1/admin/users", headers=_auth(admin_token))
    assert r.status_code == 200


# ── 7. Usuário não autenticado recebe 401 ───────────────────────────────────

def test_unauthenticated_gets_401(client):
    r = client.get("/api/v1/analyses")
    assert r.status_code == 401

    r = client.get("/api/v1/admin/users")
    assert r.status_code == 401
