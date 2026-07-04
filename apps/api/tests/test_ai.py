"""Tests for ai.py routes."""
import pytest
from unittest.mock import patch
from app.models.analysis import Analysis, AIAnalysis


def _make_analysis(db_session, filename="ai_test.xlsx") -> Analysis:
    a = Analysis(
        original_filename=filename,
        stored_filename=filename,
        file_type="xlsx",
        detected_type="ciclos",
        status="completed",
        total_rows=10,
        total_columns=5,
    )
    db_session.add(a)
    db_session.commit()
    db_session.refresh(a)
    return a


def _no_ai_keys():
    return patch.multiple("app.core.config.settings", gemini_api_key=None, openai_api_key=None)


# ── ai_status ─────────────────────────────────────────────────────────────────

def test_ai_status_no_keys(client, viewer_token):
    with _no_ai_keys():
        r = client.get(
            "/api/v1/ai/status",
            headers={"Authorization": f"Bearer {viewer_token}"},
        )
    assert r.status_code == 200
    data = r.json()
    assert data["provider"] == "none"
    assert data["available"] is False


def test_ai_status_gemini(client, viewer_token):
    with patch.multiple("app.core.config.settings", gemini_api_key="test-key", gemini_model="gemini-pro"):
        r = client.get(
            "/api/v1/ai/status",
            headers={"Authorization": f"Bearer {viewer_token}"},
        )
    assert r.status_code == 200
    data = r.json()
    assert data["provider"] == "gemini"
    assert data["available"] is True


def test_ai_status_unauthenticated(client):
    r = client.get("/api/v1/ai/status")
    assert r.status_code == 401


# ── get_ai_summary ────────────────────────────────────────────────────────────

def test_get_ai_summary_not_found(client, viewer_token, db_session):
    a = _make_analysis(db_session, "no_ai_yet.xlsx")
    r = client.get(
        f"/api/v1/analyses/{a.id}/ai-summary",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 404


def test_get_ai_summary_found(client, viewer_token, db_session):
    a = _make_analysis(db_session, "has_ai.xlsx")
    ai = AIAnalysis(
        analysis_id=str(a.id),
        resumo_executivo="Taxa de execução: 80%",
        principais_achados=["Dado 1"],
        riscos_operacionais=[],
        recomendacoes=["Recomendação 1"],
        plano_acao=[],
        perguntas_sugeridas=[],
    )
    db_session.add(ai)
    db_session.commit()

    r = client.get(
        f"/api/v1/analyses/{a.id}/ai-summary",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert "resumo_executivo" in data or "analysis_id" in data


def test_get_ai_summary_unauthenticated(client, db_session):
    a = _make_analysis(db_session, "unauth_ai.xlsx")
    r = client.get(f"/api/v1/analyses/{a.id}/ai-summary")
    assert r.status_code == 401


# ── delete_ai_summary ─────────────────────────────────────────────────────────

def test_delete_ai_summary_exists(client, analyst_token, db_session):
    a = _make_analysis(db_session, "del_ai.xlsx")
    ai = AIAnalysis(
        analysis_id=str(a.id),
        resumo_executivo="Para deletar",
        principais_achados=[],
        riscos_operacionais=[],
        recomendacoes=[],
        plano_acao=[],
        perguntas_sugeridas=[],
    )
    db_session.add(ai)
    db_session.commit()

    r = client.delete(
        f"/api/v1/analyses/{a.id}/ai-summary",
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 204


def test_delete_ai_summary_not_exists(client, analyst_token, db_session):
    a = _make_analysis(db_session, "del_ai_ne.xlsx")
    r = client.delete(
        f"/api/v1/analyses/{a.id}/ai-summary",
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 204


def test_delete_ai_summary_viewer_forbidden(client, viewer_token, db_session):
    a = _make_analysis(db_session, "del_ai_v.xlsx")
    r = client.delete(
        f"/api/v1/analyses/{a.id}/ai-summary",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 403


def test_delete_ai_summary_unauthenticated(client, db_session):
    a = _make_analysis(db_session, "del_ai_u.xlsx")
    r = client.delete(f"/api/v1/analyses/{a.id}/ai-summary")
    assert r.status_code == 401


# ── generate_ai_summary ───────────────────────────────────────────────────────

def test_generate_ai_summary_not_found(client, analyst_token):
    with _no_ai_keys():
        r = client.post(
            "/api/v1/analyses/nonexistent-id/ai-summary",
            headers={"Authorization": f"Bearer {analyst_token}"},
        )
    assert r.status_code == 404


def test_generate_ai_summary_no_activities(client, analyst_token, db_session):
    a = _make_analysis(db_session, "gen_ai_no_act.xlsx")
    with _no_ai_keys():
        r = client.post(
            f"/api/v1/analyses/{a.id}/ai-summary",
            headers={"Authorization": f"Bearer {analyst_token}"},
        )
    # With no AI keys and no context it should return 200 with mock message
    assert r.status_code in (200, 201, 422)


def test_generate_ai_summary_viewer_forbidden(client, viewer_token, db_session):
    a = _make_analysis(db_session, "gen_ai_v.xlsx")
    r = client.post(
        f"/api/v1/analyses/{a.id}/ai-summary",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 403
