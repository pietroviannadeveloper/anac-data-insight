"""Tests for treated-data pagination and filtering."""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.analysis import Analysis, CicloActivity
from app.db.database import Base


def _seed_analysis_with_activities(session):
    analysis = Analysis(
        original_filename="test.xlsx",
        stored_filename="abc_test.xlsx",
        file_type="xlsx",
        detected_type="ciclos",
        status="completed",
        total_rows=5,
        total_columns=13,
        indicators={},
    )
    session.add(analysis)
    session.flush()

    activities = [
        CicloActivity(analysis_id=str(analysis.id), atividade=f"Ativ {i}",
                      gerencia="GTAP", status="realizado" if i % 2 == 0 else "agendado",
                      sem_giaso=1 if i == 0 else 0,
                      sem_pcdp=0, sem_processo=0, local_indefinido=0)
        for i in range(5)
    ]
    session.add_all(activities)
    session.commit()
    return str(analysis.id)


def test_pagination_total_pages(client, db_session, analyst_token):
    aid = _seed_analysis_with_activities(db_session)
    r = client.get(
        f"/api/v1/analyses/{aid}/treated-data?page=1&page_size=2",
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["total"] == 5
    assert data["total_pages"] == 3
    assert data["page_size"] == 2
    assert len(data["items"]) == 2


def test_filter_by_status(client, db_session, analyst_token):
    aid = _seed_analysis_with_activities(db_session)
    r = client.get(
        f"/api/v1/analyses/{aid}/treated-data?status=realizado",
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    data = r.json()
    assert all(item["status"] == "realizado" for item in data["items"])


def test_filter_sem_giaso(client, db_session, analyst_token):
    aid = _seed_analysis_with_activities(db_session)
    r = client.get(
        f"/api/v1/analyses/{aid}/treated-data?sem_giaso=1",
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    data = r.json()
    assert data["total"] == 1
    assert data["items"][0]["sem_giaso"] == 1


def test_search(client, db_session, analyst_token):
    aid = _seed_analysis_with_activities(db_session)
    r = client.get(
        f"/api/v1/analyses/{aid}/treated-data?search=Ativ 1",
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    data = r.json()
    assert data["total"] >= 1
    assert any("1" in (item["atividade"] or "") for item in data["items"])


def test_viewer_can_access_treated_data(client, db_session, viewer_token):
    aid = _seed_analysis_with_activities(db_session)
    r = client.get(
        f"/api/v1/analyses/{aid}/treated-data",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 200
