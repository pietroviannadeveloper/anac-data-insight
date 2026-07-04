"""Tests for pta_mensal.py routes."""
import pytest


def test_list_uploads_authenticated(client, viewer_token):
    r = client.get(
        "/api/v1/pta-mensal/uploads",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_list_uploads_unauthenticated(client):
    r = client.get("/api/v1/pta-mensal/uploads")
    assert r.status_code == 401


def test_list_uploads_admin(client, admin_token):
    r = client.get(
        "/api/v1/pta-mensal/uploads",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200


def test_summary_empty_db(client, viewer_token):
    r = client.get(
        "/api/v1/pta-mensal/summary",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["total_uploads"] == 0
    assert data["tipos_carregados"] == []


def test_summary_authenticated(client, analyst_token):
    r = client.get(
        "/api/v1/pta-mensal/summary",
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 200


def test_summary_with_tipo_param(client, viewer_token):
    r = client.get(
        "/api/v1/pta-mensal/summary?tipo=CICLO_BASE",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 200


def test_summary_unauthenticated(client):
    r = client.get("/api/v1/pta-mensal/summary")
    assert r.status_code == 401


def test_activities_empty_db(client, viewer_token):
    r = client.get(
        "/api/v1/pta-mensal/activities",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 200
    data = r.json()
    # Expect paginated response or list
    assert isinstance(data, (list, dict))


def test_activities_with_tipo_param(client, viewer_token):
    r = client.get(
        "/api/v1/pta-mensal/activities?tipo=CICLO_BASE",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 200


def test_activities_with_tipos_param(client, viewer_token):
    r = client.get(
        "/api/v1/pta-mensal/activities?tipos=CICLO_BASE&tipos=CICLO_DESEMPENHO",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 200


def test_activities_with_status_filter(client, viewer_token):
    r = client.get(
        "/api/v1/pta-mensal/activities?status=realizado",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 200


def test_activities_unauthenticated(client):
    r = client.get("/api/v1/pta-mensal/activities")
    assert r.status_code == 401


def test_upload_pta_mensal_viewer_forbidden(client, viewer_token):
    """Viewer role should not be allowed to upload (only admin/analyst via require_admin dep)."""
    import io
    r = client.post(
        "/api/v1/pta-mensal/upload",
        data={"tipo": "CICLO_BASE"},
        files={"file": ("test.csv", io.BytesIO(b"col1;col2\nval1;val2"), "text/csv")},
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 403


def test_upload_pta_mensal_unauthenticated(client):
    import io
    r = client.post(
        "/api/v1/pta-mensal/upload",
        data={"tipo": "CICLO_BASE"},
        files={"file": ("test.csv", io.BytesIO(b"col1;col2\nval1;val2"), "text/csv")},
    )
    assert r.status_code == 401


def test_delete_upload_not_found(client, admin_token):
    r = client.delete(
        "/api/v1/pta-mensal/uploads/nonexistent-id",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 404


# ── Tests with seeded data ───────────────────────────────────────────────────


def _seed_upload(db_session, tipo="CICLO_BASE", rows=2):
    from app.models.pta_mensal import PTAMensalUpload, PTAMensalActivity
    upload = PTAMensalUpload(
        tipo=tipo,
        year=2026,
        filename=f"{tipo}.csv",
        stored_filename=None,
        total_rows=rows,
        indicators={"total_planejado": rows, "total_realizado": 1},
        created_by="admin_test",
    )
    db_session.add(upload)
    db_session.flush()
    for i in range(rows):
        act = PTAMensalActivity(
            upload_id=upload.id,
            atividade=f"Atividade {i+1}",
            gerencia="GRTE-SP",
            cidade="São Paulo",
            servidor="João",
            mes_num=i + 1,
            mes_original_num=i + 1,
            status="realizado" if i == 0 else "sem-agendamento",
            tipo_ciclo=tipo,
            sem_giaso=0,
            sem_pcdp=0,
            sem_processo=0,
            local_indefinido=0,
        )
        db_session.add(act)
    db_session.commit()
    db_session.refresh(upload)
    return upload


def test_list_uploads_with_data(client, viewer_token, db_session):
    _seed_upload(db_session, "CICLO_BASE")
    r = client.get(
        "/api/v1/pta-mensal/uploads",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 200
    items = r.json()
    assert any(u["tipo"] == "CICLO_BASE" for u in items)


def test_summary_with_data(client, viewer_token, db_session):
    _seed_upload(db_session, "CICLO_DESEMPENHO", rows=3)
    r = client.get(
        "/api/v1/pta-mensal/summary",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["total_uploads"] >= 1
    assert "CICLO_DESEMPENHO" in data["tipos_carregados"]
    assert "consolidado" in data


def test_summary_with_tipo_filter(client, viewer_token, db_session):
    _seed_upload(db_session, "CONTROLE_PTA", rows=2)
    r = client.get(
        "/api/v1/pta-mensal/summary?tipo=CONTROLE_PTA",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert "consolidado" in data


def test_summary_with_tipos_multi_filter(client, viewer_token, db_session):
    _seed_upload(db_session, "CICLO_BASE", rows=2)
    _seed_upload(db_session, "CICLO_DESEMPENHO", rows=2)
    r = client.get(
        "/api/v1/pta-mensal/summary?tipos=CICLO_BASE&tipos=CICLO_DESEMPENHO",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert "consolidado" in data


def test_activities_with_data(client, viewer_token, db_session):
    _seed_upload(db_session, "PTA_FINAL", rows=3)
    r = client.get(
        "/api/v1/pta-mensal/activities",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 200


def test_activities_filter_by_gerencia(client, viewer_token, db_session):
    _seed_upload(db_session, "NAO_INFORMADA", rows=2)
    r = client.get(
        "/api/v1/pta-mensal/activities?gerencia=GRTE-SP",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 200


def test_delete_upload_existing(client, admin_token, db_session):
    upload = _seed_upload(db_session, "CICLO_BASE")
    r = client.delete(
        f"/api/v1/pta-mensal/uploads/{upload.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 204


def test_delete_upload_viewer_forbidden(client, viewer_token, db_session):
    upload = _seed_upload(db_session, "CICLO_BASE")
    r = client.delete(
        f"/api/v1/pta-mensal/uploads/{upload.id}",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 403


def test_export_activities_excel(client, viewer_token, db_session):
    _seed_upload(db_session, "CICLO_BASE", rows=2)
    r = client.get(
        "/api/v1/pta-mensal/activities/export",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 200
    assert "spreadsheetml" in r.headers.get("content-type", "") or "excel" in r.headers.get("content-type", "")


def test_export_activities_excel_empty(client, viewer_token):
    r = client.get(
        "/api/v1/pta-mensal/activities/export?tipo=NAO_INFORMADA",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 200


def test_activities_pagination(client, viewer_token, db_session):
    _seed_upload(db_session, "CICLO_BASE", rows=5)
    r = client.get(
        "/api/v1/pta-mensal/activities?page=1&page_size=2",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert "total" in data
    assert "page_size" in data


def test_activities_search_filter(client, viewer_token, db_session):
    _seed_upload(db_session, "CICLO_BASE", rows=2)
    r = client.get(
        "/api/v1/pta-mensal/activities?search=Atividade",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 200


def test_activities_mes_vigente_filter(client, viewer_token, db_session):
    _seed_upload(db_session, "CICLO_BASE", rows=3)
    r = client.get(
        "/api/v1/pta-mensal/activities?mes_vigente=true",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 200
