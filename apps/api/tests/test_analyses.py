"""Tests for analyses.py routes (non-upload endpoints)."""
import pytest


def _create_analysis(db_session, filename="test.xlsx", detected_type="ciclos", created_by="admin_test"):
    from app.models.analysis import Analysis
    analysis = Analysis(
        original_filename=filename,
        stored_filename=f"abc_{filename}",
        file_type="xlsx",
        detected_type=detected_type,
        status="completed",
        total_rows=5,
        total_columns=10,
        indicators={"taxa_execucao": 80.0, "sem_giaso": 2},
        created_by=created_by,
    )
    db_session.add(analysis)
    db_session.commit()
    db_session.refresh(analysis)
    return analysis


def test_list_analyses_authenticated(client, viewer_token):
    r = client.get("/api/v1/analyses", headers={"Authorization": f"Bearer {viewer_token}"})
    assert r.status_code == 200
    data = r.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data


def test_list_analyses_unauthenticated(client):
    r = client.get("/api/v1/analyses")
    assert r.status_code == 401


def test_list_analyses_pagination(client, viewer_token, db_session):
    for i in range(3):
        _create_analysis(db_session, filename=f"pag_test_{i}.xlsx")

    r = client.get(
        "/api/v1/analyses?page=1&per_page=2",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["per_page"] == 2


def test_get_analysis_detail(client, viewer_token, db_session):
    analysis = _create_analysis(db_session)
    r = client.get(
        f"/api/v1/analyses/{analysis.id}",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == str(analysis.id)
    assert data["original_filename"] == analysis.original_filename


def test_get_analysis_not_found(client, viewer_token):
    r = client.get(
        "/api/v1/analyses/nonexistent-id",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 404


def test_update_analysis_description(client, analyst_token, db_session):
    analysis = _create_analysis(db_session)
    r = client.patch(
        f"/api/v1/analyses/{analysis.id}",
        json={"description": "Nova descrição de teste"},
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 200
    assert r.json()["description"] == "Nova descrição de teste"


def test_update_analysis_tags(client, analyst_token, db_session):
    analysis = _create_analysis(db_session)
    r = client.patch(
        f"/api/v1/analyses/{analysis.id}",
        json={"tags": ["tag1", "tag2"]},
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 200
    assert "tag1" in r.json()["tags"]


def test_update_analysis_not_found(client, analyst_token):
    r = client.patch(
        "/api/v1/analyses/nonexistent-id",
        json={"description": "Test"},
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 404


def test_delete_analysis_admin(client, admin_token, db_session):
    analysis = _create_analysis(db_session)
    r = client.delete(
        f"/api/v1/analyses/{analysis.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    # 204 no content or 404 if soft-delete logic differs
    assert r.status_code in (204, 200)


def test_delete_analysis_not_found(client, admin_token):
    r = client.delete(
        "/api/v1/analyses/nonexistent-id",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 404


def test_get_analysis_alerts(client, viewer_token, db_session):
    analysis = _create_analysis(db_session)
    r = client.get(
        f"/api/v1/analyses/{analysis.id}/alerts",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 200


def test_get_analysis_alerts_not_found(client, viewer_token):
    r = client.get(
        "/api/v1/analyses/nonexistent-id/alerts",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 404


def test_list_analyses_with_tag_filter(client, viewer_token, db_session):
    analysis = _create_analysis(db_session, filename="tagged.xlsx")
    # Update tags
    client.patch(
        f"/api/v1/analyses/{analysis.id}",
        json={"tags": ["important"]},
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    r = client.get(
        "/api/v1/analyses?tag=important",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 200
