"""Tests for approvals.py routes."""
import pytest


def _make_analysis(db_session, **overrides):
    from app.models.analysis import Analysis

    defaults = dict(
        original_filename="ciclos.xlsx", stored_filename="abc_ciclos.xlsx",
        file_type="xlsx", detected_type="ciclos", status="completed",
        total_rows=1, total_columns=10,
    )
    defaults.update(overrides)
    analysis = Analysis(**defaults)
    db_session.add(analysis)
    db_session.commit()
    db_session.refresh(analysis)
    return analysis


def test_new_analysis_defaults_to_rascunho(db_session):
    analysis = _make_analysis(db_session)
    assert analysis.approval_status == "rascunho"


def test_submit_analyst(client, analyst_token, db_session):
    analysis = _make_analysis(db_session)
    r = client.post(
        f"/api/v1/analyses/{analysis.id}/submit",
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 200
    assert r.json()["approval_status"] == "em_validacao"


def test_submit_viewer_forbidden(client, viewer_token, db_session):
    analysis = _make_analysis(db_session)
    r = client.post(
        f"/api/v1/analyses/{analysis.id}/submit",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 403


def test_submit_from_aprovado_rejected(client, analyst_token, db_session):
    analysis = _make_analysis(db_session, approval_status="aprovado")
    r = client.post(
        f"/api/v1/analyses/{analysis.id}/submit",
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 400


def test_approve_admin(client, admin_token, db_session):
    analysis = _make_analysis(db_session, approval_status="em_validacao")
    r = client.post(
        f"/api/v1/analyses/{analysis.id}/approve",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    assert r.json()["approval_status"] == "aprovado"


def test_approve_analyst_forbidden(client, analyst_token, db_session):
    analysis = _make_analysis(db_session, approval_status="em_validacao")
    r = client.post(
        f"/api/v1/analyses/{analysis.id}/approve",
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 403


def test_approve_from_rascunho_rejected(client, admin_token, db_session):
    analysis = _make_analysis(db_session)
    r = client.post(
        f"/api/v1/analyses/{analysis.id}/approve",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 400


def test_reject_requires_comment(client, admin_token, db_session):
    analysis = _make_analysis(db_session, approval_status="em_validacao")
    r = client.post(
        f"/api/v1/analyses/{analysis.id}/reject",
        json={"comment": "   "},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 400


def test_reject_admin_with_comment(client, admin_token, db_session):
    analysis = _make_analysis(db_session, approval_status="em_validacao")
    r = client.post(
        f"/api/v1/analyses/{analysis.id}/reject",
        json={"comment": "Dados inconsistentes"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    assert r.json()["approval_status"] == "rejeitado"


def test_resubmit_after_rejection(client, analyst_token, db_session):
    analysis = _make_analysis(db_session, approval_status="rejeitado")
    r = client.post(
        f"/api/v1/analyses/{analysis.id}/submit",
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 200
    assert r.json()["approval_status"] == "em_validacao"


def test_archive_admin(client, admin_token, db_session):
    analysis = _make_analysis(db_session, approval_status="aprovado")
    r = client.post(
        f"/api/v1/analyses/{analysis.id}/archive",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    assert r.json()["approval_status"] == "arquivado"


def test_archive_already_archived_rejected(client, admin_token, db_session):
    analysis = _make_analysis(db_session, approval_status="arquivado")
    r = client.post(
        f"/api/v1/analyses/{analysis.id}/archive",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 400


def test_approval_history_records_transitions(client, analyst_token, admin_token, db_session):
    analysis = _make_analysis(db_session)
    client.post(
        f"/api/v1/analyses/{analysis.id}/submit",
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    client.post(
        f"/api/v1/analyses/{analysis.id}/approve",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    r = client.get(
        f"/api/v1/analyses/{analysis.id}/approval-history",
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 200
    entries = r.json()
    assert [e["to_status"] for e in entries] == ["em_validacao", "aprovado"]
    assert entries[0]["from_status"] == "rascunho"


def test_submit_analysis_not_found(client, analyst_token):
    r = client.post(
        "/api/v1/analyses/nonexistent/submit",
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 404
