"""Tests for alert_rules.py routes."""
import pytest


def test_list_rules_authenticated(client, viewer_token):
    r = client.get("/api/v1/alert-rules", headers={"Authorization": f"Bearer {viewer_token}"})
    assert r.status_code == 200
    data = r.json()
    assert "items" in data
    assert "available_metrics" in data


def test_list_rules_unauthenticated(client):
    r = client.get("/api/v1/alert-rules")
    assert r.status_code == 401


def test_create_rule_analyst(client, analyst_token):
    r = client.post(
        "/api/v1/alert-rules",
        json={
            "label": "Taxa baixa",
            "metric": "taxa_execucao",
            "operator": "lt",
            "threshold": 80,
            "analysis_types": ["ciclos"],
            "enabled": True,
        },
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 201
    data = r.json()
    assert data["label"] == "Taxa baixa"
    assert data["metric"] == "taxa_execucao"


def test_create_rule_admin(client, admin_token):
    r = client.post(
        "/api/v1/alert-rules",
        json={
            "label": "Sem GIASO",
            "metric": "sem_giaso",
            "operator": "gt",
            "threshold": 10,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 201


def test_create_rule_invalid_operator(client, analyst_token):
    r = client.post(
        "/api/v1/alert-rules",
        json={
            "label": "Test",
            "metric": "taxa_execucao",
            "operator": "invalid",
            "threshold": 50,
        },
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 400


def test_create_rule_viewer_forbidden(client, viewer_token):
    r = client.post(
        "/api/v1/alert-rules",
        json={
            "label": "Test",
            "metric": "taxa_execucao",
            "operator": "lt",
            "threshold": 50,
        },
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 403


def test_update_rule(client, analyst_token, db_session):
    from app.models.analysis import AlertRule
    rule = AlertRule(label="Old label", metric="taxa_execucao", operator="lt",
                     threshold=50, created_by="analyst_test")
    db_session.add(rule)
    db_session.commit()
    db_session.refresh(rule)

    r = client.patch(
        f"/api/v1/alert-rules/{rule.id}",
        json={"label": "New label", "threshold": 70},
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 200
    assert r.json()["label"] == "New label"
    assert r.json()["threshold"] == 70


def test_update_rule_invalid_operator(client, analyst_token, db_session):
    from app.models.analysis import AlertRule
    rule = AlertRule(label="Rule", metric="taxa_execucao", operator="lt",
                     threshold=50, created_by="analyst_test")
    db_session.add(rule)
    db_session.commit()
    db_session.refresh(rule)

    r = client.patch(
        f"/api/v1/alert-rules/{rule.id}",
        json={"operator": "bad_op"},
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 400


def test_update_rule_not_found(client, analyst_token):
    r = client.patch(
        "/api/v1/alert-rules/nonexistent",
        json={"label": "New"},
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 404


def test_delete_rule(client, analyst_token, db_session):
    from app.models.analysis import AlertRule
    rule = AlertRule(label="To delete", metric="taxa_execucao", operator="lt",
                     threshold=50, created_by="analyst_test")
    db_session.add(rule)
    db_session.commit()
    db_session.refresh(rule)

    r = client.delete(
        f"/api/v1/alert-rules/{rule.id}",
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 204


def test_delete_rule_not_found(client, analyst_token):
    r = client.delete(
        "/api/v1/alert-rules/nonexistent",
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 404


def test_list_alert_events_analysis_not_found(client, viewer_token):
    r = client.get(
        "/api/v1/analyses/nonexistent-id/alert-events",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 404


def test_list_alert_events_empty(client, viewer_token, db_session):
    from app.models.analysis import Analysis
    analysis = Analysis(
        original_filename="test.xlsx",
        stored_filename="abc_test.xlsx",
        file_type="xlsx",
        detected_type="ciclos",
        status="completed",
        total_rows=0,
        total_columns=0,
    )
    db_session.add(analysis)
    db_session.commit()
    db_session.refresh(analysis)

    r = client.get(
        f"/api/v1/analyses/{analysis.id}/alert-events",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 200
    assert isinstance(r.json(), list)
