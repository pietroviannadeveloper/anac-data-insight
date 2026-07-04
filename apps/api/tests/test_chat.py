"""Tests for chat.py routes."""
import pytest
from unittest.mock import patch, AsyncMock, MagicMock


def _no_ai_keys():
    """Patch settings to remove AI keys so the mock path is taken."""
    return patch.multiple(
        "app.core.config.settings",
        gemini_api_key=None,
        openai_api_key=None,
    )


def test_chat_with_question(client, viewer_token):
    with _no_ai_keys():
        r = client.post(
            "/api/v1/chat",
            json={"question": "Quantas atividades existem?"},
            headers={"Authorization": f"Bearer {viewer_token}"},
        )
    assert r.status_code == 200
    data = r.json()
    assert "answer" in data
    assert "context_used" in data


def test_chat_empty_question(client, viewer_token):
    r = client.post(
        "/api/v1/chat",
        json={"question": "   "},
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 400


def test_chat_unauthenticated(client):
    r = client.post(
        "/api/v1/chat",
        json={"question": "Quantas atividades?"},
    )
    assert r.status_code == 401


def test_chat_answer_present(client, viewer_token):
    with _no_ai_keys():
        r = client.post(
            "/api/v1/chat",
            json={"question": "Qual é a taxa de execução?"},
            headers={"Authorization": f"Bearer {viewer_token}"},
        )
    assert r.status_code == 200
    data = r.json()
    assert "answer" in data
    assert len(data["answer"]) > 0


def test_chat_with_analysis_id_not_found(client, admin_token):
    r = client.post(
        "/api/v1/chat",
        json={"question": "Detalhes?", "analysis_id": "nonexistent-analysis-id"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 404


def test_chat_page_ptamensal(client, viewer_token):
    with _no_ai_keys():
        r = client.post(
            "/api/v1/chat/page",
            json={
                "question": "Como está o andamento do PTA?",
                "page_type": "ptamensal",
                "context": {"total_planejado": 100, "total_realizado": 60, "taxa_execucao": 60.0},
            },
            headers={"Authorization": f"Bearer {viewer_token}"},
        )
    assert r.status_code == 200
    data = r.json()
    assert "answer" in data
    assert "provider" in data


def test_chat_page_pta_historico(client, viewer_token):
    with _no_ai_keys():
        r = client.post(
            "/api/v1/chat/page",
            json={
                "question": "Qual é a tendência?",
                "page_type": "pta_historico",
                "context": {"years": [2023, 2024], "taxa_execucao": [80.0, 85.0]},
            },
            headers={"Authorization": f"Bearer {viewer_token}"},
        )
    assert r.status_code == 200
    data = r.json()
    assert "answer" in data


def test_chat_page_empty_question(client, viewer_token):
    r = client.post(
        "/api/v1/chat/page",
        json={
            "question": "",
            "page_type": "ptamensal",
            "context": {},
        },
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 400


def test_chat_page_unauthenticated(client):
    r = client.post(
        "/api/v1/chat/page",
        json={
            "question": "Como está o PTA?",
            "page_type": "ptamensal",
            "context": {},
        },
    )
    assert r.status_code == 401


def test_chat_page_unknown_page_type_falls_back(client, viewer_token):
    """Unknown page_type should fall back gracefully (uses default prompt)."""
    with _no_ai_keys():
        r = client.post(
            "/api/v1/chat/page",
            json={
                "question": "Como está?",
                "page_type": "unknown_page",
                "context": {"key": "value"},
            },
            headers={"Authorization": f"Bearer {viewer_token}"},
        )
    assert r.status_code == 200


def test_chat_with_existing_activities(client, admin_token, db_session):
    """Test chat builds context when activities exist."""
    from app.models.analysis import Analysis, CicloActivity
    analysis = Analysis(
        original_filename="context_test.xlsx",
        stored_filename="ctx_test.xlsx",
        file_type="xlsx",
        detected_type="ciclos",
        status="completed",
        total_rows=3,
        total_columns=10,
        indicators={"taxa_execucao": 75.0},
    )
    db_session.add(analysis)
    db_session.flush()
    for i in range(3):
        db_session.add(CicloActivity(
            analysis_id=str(analysis.id),
            atividade=f"Atividade {i}",
            gerencia="GTAP",
            regulado=f"Empresa {i}",
            status=["realizado", "agendado", "sem-agendamento"][i],
            sem_giaso=0, sem_pcdp=0, sem_processo=0, local_indefinido=0,
        ))
    db_session.commit()

    with _no_ai_keys():
        r = client.post(
            "/api/v1/chat",
            json={"question": "Qual a taxa de execução?"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
    assert r.status_code == 200
    data = r.json()
    assert "answer" in data


def test_chat_with_analysis_id(client, admin_token, db_session):
    """Test chat scoped to a specific analysis."""
    from app.models.analysis import Analysis, CicloActivity
    analysis = Analysis(
        original_filename="scoped_test.xlsx",
        stored_filename="sc_test.xlsx",
        file_type="xlsx",
        detected_type="ciclos",
        status="completed",
        total_rows=1,
        total_columns=5,
        indicators={},
    )
    db_session.add(analysis)
    db_session.flush()
    db_session.add(CicloActivity(
        analysis_id=str(analysis.id),
        atividade="Auditoria",
        gerencia="GTAP",
        status="realizado",
        sem_giaso=0, sem_pcdp=0, sem_processo=0, local_indefinido=0,
    ))
    db_session.commit()

    with _no_ai_keys():
        r = client.post(
            "/api/v1/chat",
            json={"question": "Resumo?", "analysis_id": str(analysis.id)},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
    assert r.status_code == 200
    assert r.json()["analysis_id"] == str(analysis.id)
