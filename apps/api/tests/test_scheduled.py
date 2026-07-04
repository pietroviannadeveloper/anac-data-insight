"""Tests for scheduled.py routes."""
import pytest
from unittest.mock import patch


def _no_scheduler():
    """Mock scheduler sync_jobs to avoid side effects in tests."""
    return patch("app.services.scheduler.sync_jobs")


def test_list_scheduled_analyst(client, analyst_token):
    r = client.get(
        "/api/v1/scheduled-reports",
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert "items" in data
    assert "cron_examples" in data


def test_list_scheduled_admin(client, admin_token):
    r = client.get(
        "/api/v1/scheduled-reports",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200


def test_list_scheduled_viewer_forbidden(client, viewer_token):
    r = client.get(
        "/api/v1/scheduled-reports",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 403


def test_list_scheduled_unauthenticated(client):
    r = client.get("/api/v1/scheduled-reports")
    assert r.status_code == 401


def test_create_scheduled_valid(client, analyst_token):
    with _no_scheduler():
        r = client.post(
            "/api/v1/scheduled-reports",
            json={
                "label": "Relatório mensal",
                "cron_expression": "0 8 1 * *",
                "recipient_emails": ["test@example.com"],
                "enabled": True,
            },
            headers={"Authorization": f"Bearer {analyst_token}"},
        )
    assert r.status_code == 201
    data = r.json()
    assert data["label"] == "Relatório mensal"
    assert data["cron_expression"] == "0 8 1 * *"


def test_create_scheduled_invalid_cron(client, analyst_token):
    with _no_scheduler():
        r = client.post(
            "/api/v1/scheduled-reports",
            json={
                "label": "Test",
                "cron_expression": "invalid cron",
                "recipient_emails": [],
            },
            headers={"Authorization": f"Bearer {analyst_token}"},
        )
    assert r.status_code == 400


def test_update_scheduled(client, analyst_token, db_session):
    from app.models.scheduled import ScheduledReport
    report = ScheduledReport(
        label="Old Report",
        cron_expression="0 8 * * *",
        recipient_emails=["a@b.com"],
        enabled=1,
        created_by="analyst_test",
    )
    db_session.add(report)
    db_session.commit()
    db_session.refresh(report)

    with _no_scheduler():
        r = client.patch(
            f"/api/v1/scheduled-reports/{report.id}",
            json={"label": "New Report", "enabled": False},
            headers={"Authorization": f"Bearer {analyst_token}"},
        )
    assert r.status_code == 200
    data = r.json()
    assert data["label"] == "New Report"
    assert data["enabled"] is False


def test_update_scheduled_invalid_cron(client, analyst_token, db_session):
    from app.models.scheduled import ScheduledReport
    report = ScheduledReport(
        label="Bad cron test",
        cron_expression="0 8 * * *",
        recipient_emails=[],
        enabled=1,
        created_by="analyst_test",
    )
    db_session.add(report)
    db_session.commit()
    db_session.refresh(report)

    with _no_scheduler():
        r = client.patch(
            f"/api/v1/scheduled-reports/{report.id}",
            json={"cron_expression": "not valid cron"},
            headers={"Authorization": f"Bearer {analyst_token}"},
        )
    assert r.status_code == 400


def test_update_scheduled_not_found(client, analyst_token):
    with _no_scheduler():
        r = client.patch(
            "/api/v1/scheduled-reports/nonexistent",
            json={"label": "New"},
            headers={"Authorization": f"Bearer {analyst_token}"},
        )
    assert r.status_code == 404


def test_delete_scheduled(client, analyst_token, db_session):
    from app.models.scheduled import ScheduledReport
    report = ScheduledReport(
        label="To delete",
        cron_expression="0 8 * * *",
        recipient_emails=[],
        enabled=1,
        created_by="analyst_test",
    )
    db_session.add(report)
    db_session.commit()
    db_session.refresh(report)

    with _no_scheduler():
        r = client.delete(
            f"/api/v1/scheduled-reports/{report.id}",
            headers={"Authorization": f"Bearer {analyst_token}"},
        )
    assert r.status_code == 204


def test_delete_scheduled_not_found(client, analyst_token):
    with _no_scheduler():
        r = client.delete(
            "/api/v1/scheduled-reports/nonexistent",
            headers={"Authorization": f"Bearer {analyst_token}"},
        )
    assert r.status_code == 404


def test_run_now_not_found(client, analyst_token):
    r = client.post(
        "/api/v1/scheduled-reports/nonexistent/run-now",
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 404
