"""Tests for the analytical audit trail (GET /analyses/{id}/audit-trail
and the enriched extra_data written on analysis_created / export actions)."""
import io
import json


def test_upload_writes_enriched_analysis_created_audit(client, analyst_token, db_session):
    from app.models.user import AuditLog

    csv_content = (
        "Atividade;Gerencia;Cidade;Mes\nInspeção 1;GPA;Brasília;Janeiro\n"
    ).encode("utf-8")
    r = client.post(
        "/api/v1/upload-and-analyze",
        files={"file": ("auditoria.csv", io.BytesIO(csv_content), "text/csv")},
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 201, r.text
    analysis_id = r.json()["id"]

    log = (
        db_session.query(AuditLog)
        .filter(AuditLog.entity_type == "analysis", AuditLog.entity_id == analysis_id,
                AuditLog.action == "analysis_created")
        .first()
    )
    assert log is not None
    meta = json.loads(log.extra_data)
    assert meta["classifier_version"] == "1.0"
    assert len(meta["file_hash"]) == 64  # sha256 hex digest
    assert meta["total_rows"] == 1


def test_audit_trail_lists_chronological_events(client, analyst_token):
    csv_content = (
        "Atividade;Gerencia;Cidade;Mes\nInspeção 1;GPA;Brasília;Janeiro\n"
    ).encode("utf-8")
    r = client.post(
        "/api/v1/upload-and-analyze",
        files={"file": ("trilha.csv", io.BytesIO(csv_content), "text/csv")},
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    analysis_id = r.json()["id"]

    client.get(
        f"/api/v1/analyses/{analysis_id}/export/excel",
        headers={"Authorization": f"Bearer {analyst_token}"},
    )

    trail_r = client.get(
        f"/api/v1/analyses/{analysis_id}/audit-trail",
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert trail_r.status_code == 200
    actions = [e["action"] for e in trail_r.json()]
    assert actions == ["analysis_created", "excel_exported"]


def test_audit_trail_analysis_not_found(client, analyst_token):
    r = client.get(
        "/api/v1/analyses/nonexistent/audit-trail",
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 404


def test_audit_trail_unauthenticated(client):
    r = client.get("/api/v1/analyses/some-id/audit-trail")
    assert r.status_code == 401
