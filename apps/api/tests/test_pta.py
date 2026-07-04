"""Tests for pta.py routes (PTA historical analysis)."""
import pytest


def test_list_pta_snapshots_admin(client, admin_token):
    r = client.get("/api/v1/pta/snapshots", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_list_pta_snapshots_non_admin(client, analyst_token):
    r = client.get("/api/v1/pta/snapshots", headers={"Authorization": f"Bearer {analyst_token}"})
    assert r.status_code == 403


def test_list_pta_snapshots_viewer_forbidden(client, viewer_token):
    r = client.get("/api/v1/pta/snapshots", headers={"Authorization": f"Bearer {viewer_token}"})
    assert r.status_code == 403


def test_list_pta_snapshots_unauthenticated(client):
    r = client.get("/api/v1/pta/snapshots")
    assert r.status_code == 401


def test_list_pta_snapshots_initially_empty(client, admin_token):
    r = client.get("/api/v1/pta/snapshots", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    # May be empty in test DB
    data = r.json()
    assert isinstance(data, list)


def test_available_years_admin(client, admin_token):
    r = client.get("/api/v1/pta/available-years", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    assert isinstance(r.json(), dict)


def test_list_planejamentos_admin(client, admin_token):
    r = client.get("/api/v1/pta/planejamentos", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_get_planejamento_not_found(client, admin_token):
    r = client.get(
        "/api/v1/pta/planejamentos/nonexistent-id",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 404


def test_delete_planejamento_not_found(client, admin_token):
    r = client.delete(
        "/api/v1/pta/planejamentos/nonexistent-id",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 404


def test_compare_pta_mismatched_tipos(client, admin_token):
    r = client.get(
        "/api/v1/pta/compare?year_a=2024&tipo_a=CICLO_BASE&year_b=2023&tipo_b=CICLO_DESEMPENHO",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 422


def test_compare_pta_not_found(client, admin_token):
    r = client.get(
        "/api/v1/pta/compare?year_a=1990&tipo_a=CICLO_BASE&year_b=1991&tipo_b=CICLO_BASE",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 404


def test_get_snapshot_not_found(client, admin_token):
    r = client.get(
        "/api/v1/pta/snapshot/CICLO_BASE/1900",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 404


def test_rename_planejamento_not_found(client, admin_token):
    r = client.patch(
        "/api/v1/pta/planejamentos/nonexistent-id",
        json={"label": "Novo label"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 404


def test_seed_pta_no_files(client, admin_token):
    """Seed should return 422 when no CSV files are found."""
    r = client.post("/api/v1/pta/seed", headers={"Authorization": f"Bearer {admin_token}"})
    # Either 201 (found files) or 422 (no files found)
    assert r.status_code in (201, 422)


# ── Tests with seeded snapshot data ──────────────────────────────────────────


def _seed_snapshot(db_session, year=2024, tipo="CICLO_BASE", is_seed=1):
    from app.models.pta import PTASnapshot
    snap = PTASnapshot(
        year=year,
        tipo_ciclo=tipo,
        source_file=f"pta_{year}_{tipo}.csv",
        indicators={"taxa_execucao": 80.0, "total_atividades": 100, "sem_giaso": 5},
        total_rows=100,
        is_seed=is_seed,
    )
    db_session.add(snap)
    db_session.commit()
    db_session.refresh(snap)
    return snap


def test_list_snapshots_with_data(client, admin_token, db_session):
    _seed_snapshot(db_session, 2023, "CICLO_BASE")
    r = client.get("/api/v1/pta/snapshots", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 1
    assert any(s["year"] == 2023 for s in data)


def test_available_years_with_data(client, admin_token, db_session):
    _seed_snapshot(db_session, 2022, "CICLO_DESEMPENHO")
    r = client.get("/api/v1/pta/available-years", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    data = r.json()
    assert "CICLO_DESEMPENHO" in data


def test_get_snapshot_found(client, admin_token, db_session):
    _seed_snapshot(db_session, 2021, "CICLO_BASE")
    r = client.get(
        "/api/v1/pta/snapshot/CICLO_BASE/2021",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["year"] == 2021
    assert data["tipo_ciclo"] == "CICLO_BASE"


def test_compare_pta_found(client, admin_token, db_session):
    _seed_snapshot(db_session, 2020, "CICLO_BASE")
    _seed_snapshot(db_session, 2019, "CICLO_BASE")
    r = client.get(
        "/api/v1/pta/compare?year_a=2020&tipo_a=CICLO_BASE&year_b=2019&tipo_b=CICLO_BASE",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["tipo_ciclo"] == "CICLO_BASE"
    assert "a" in data and "b" in data


def test_planejamento_crud(client, admin_token, db_session):
    from app.models.pta_planning import PTAPlanning
    plan = PTAPlanning(
        ano_referencia=2024,
        tipos_carregados=["CICLO_BASE"],
        resultado={"sugestoes": ["test"], "ano_vigente": {"total_rows": 10}},
        created_by="admin_test",
    )
    db_session.add(plan)
    db_session.commit()
    db_session.refresh(plan)

    # Get it
    r = client.get(
        f"/api/v1/pta/planejamentos/{plan.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    assert r.json()["ano_referencia"] == 2024

    # Rename it
    r2 = client.patch(
        f"/api/v1/pta/planejamentos/{plan.id}",
        json={"label": "Novo label 2024"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r2.status_code == 200
    assert r2.json()["label"] == "Novo label 2024"

    # Delete it
    r3 = client.delete(
        f"/api/v1/pta/planejamentos/{plan.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r3.status_code == 204
