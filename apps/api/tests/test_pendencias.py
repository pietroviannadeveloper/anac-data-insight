"""Tests for pendencias.py routes."""
import pytest


@pytest.fixture(autouse=True)
def _cleanup_pta_mensal(db_session):
    """PTAMensalUpload is global (no per-test scoping like Analysis), so tests
    that create one here would otherwise leak into test_pta_mensal.py's
    "empty db" assumptions. Bulk deletes bypass ORM cascade, so clean up
    dependent rows explicitly and in order."""
    yield
    from app.models.analysis import PendenciaHistorico, PendenciaTracking
    from app.models.pta_mensal import PTAMensalActivity, PTAMensalUpload

    pend_ids = [r[0] for r in db_session.query(PendenciaTracking.id).filter(PendenciaTracking.source_type == "pta_mensal").all()]
    if pend_ids:
        db_session.query(PendenciaHistorico).filter(PendenciaHistorico.pendencia_id.in_(pend_ids)).delete(synchronize_session=False)
        db_session.query(PendenciaTracking).filter(PendenciaTracking.id.in_(pend_ids)).delete(synchronize_session=False)
    db_session.query(PTAMensalActivity).delete(synchronize_session=False)
    db_session.query(PTAMensalUpload).delete(synchronize_session=False)
    db_session.commit()


def _make_pendencia(db_session, **overrides):
    from app.models.analysis import Analysis, CicloActivity, PendenciaTracking

    analysis = Analysis(
        original_filename="ciclos.xlsx", stored_filename="abc_ciclos.xlsx",
        file_type="xlsx", detected_type="ciclos", status="completed",
        total_rows=1, total_columns=10,
    )
    db_session.add(analysis)
    db_session.commit()
    db_session.refresh(analysis)

    activity_kwargs = dict(
        analysis_id=analysis.id, atividade="Inspeção 1", gerencia="GPA",
        setor="Setor A", cidade="Brasília", mes="Janeiro", status="sem-agendamento",
        sem_giaso=1, sem_pcdp=0, sem_processo=0, local_indefinido=0, tipo_ciclo="CICLO_BASE",
    )
    activity_kwargs.update(overrides.pop("activity", {}))
    activity = CicloActivity(**activity_kwargs)
    db_session.add(activity)
    db_session.commit()
    db_session.refresh(activity)

    pendencia = PendenciaTracking(
        source_type="ciclo",
        source_id=activity.id,
        severity=overrides.pop("severity", "alta"),
        **overrides,
    )
    db_session.add(pendencia)
    db_session.commit()
    db_session.refresh(pendencia)
    return pendencia, activity, analysis


def _make_pta_mensal_pendencia(db_session, **overrides):
    from app.models.analysis import PendenciaTracking
    from app.models.pta_mensal import PTAMensalActivity, PTAMensalUpload

    upload = PTAMensalUpload(tipo="CICLO_BASE", year=2026, total_rows=1)
    db_session.add(upload)
    db_session.commit()
    db_session.refresh(upload)

    activity_kwargs = dict(
        upload_id=upload.id, atividade="Inspeção PTA Mensal", gerencia="GCO",
        setor="Setor B", cidade="Recife", mes="Março", status="sem-agendamento",
        sem_giaso=1, sem_pcdp=1, sem_processo=0, local_indefinido=0, tipo_ciclo="CICLO_BASE",
    )
    activity_kwargs.update(overrides.pop("activity", {}))
    activity = PTAMensalActivity(**activity_kwargs)
    db_session.add(activity)
    db_session.commit()
    db_session.refresh(activity)

    pendencia = PendenciaTracking(
        source_type="pta_mensal",
        source_id=activity.id,
        severity=overrides.pop("severity", "alta"),
        **overrides,
    )
    db_session.add(pendencia)
    db_session.commit()
    db_session.refresh(pendencia)
    return pendencia, activity, upload


def test_list_pendencias_authenticated(client, viewer_token, db_session):
    _make_pendencia(db_session)
    r = client.get("/api/v1/pendencias", headers={"Authorization": f"Bearer {viewer_token}"})
    assert r.status_code == 200
    data = r.json()
    assert "items" in data
    assert data["total"] >= 1
    item = data["items"][0]
    assert "motivo" in item
    assert "recomendacao" in item


def test_list_pendencias_unauthenticated(client):
    r = client.get("/api/v1/pendencias")
    assert r.status_code == 401


def test_list_pendencias_filter_by_severity(client, viewer_token, db_session):
    _make_pendencia(db_session, severity="critica")
    r = client.get(
        "/api/v1/pendencias", params={"severity": "critica"},
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 200
    assert all(i["severity"] == "critica" for i in r.json()["items"])


def test_list_pendencias_filter_by_gerencia(client, viewer_token, db_session):
    _make_pendencia(db_session, activity={"gerencia": "Gerência Filtrável Única"})
    r = client.get(
        "/api/v1/pendencias", params={"gerencia": "Filtrável"},
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) >= 1
    assert all("Filtrável" in i["gerencia"] for i in items)


def test_update_pendencia_status_analyst(client, analyst_token, db_session):
    pendencia, _, _ = _make_pendencia(db_session)
    r = client.patch(
        f"/api/v1/pendencias/{pendencia.id}",
        json={"status": "em_tratamento", "assigned_to": "analyst_test"},
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "em_tratamento"
    assert data["assigned_to"] == "analyst_test"


def test_update_pendencia_viewer_forbidden(client, viewer_token, db_session):
    pendencia, _, _ = _make_pendencia(db_session)
    r = client.patch(
        f"/api/v1/pendencias/{pendencia.id}",
        json={"status": "resolvido"},
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 403


def test_update_pendencia_invalid_status(client, analyst_token, db_session):
    pendencia, _, _ = _make_pendencia(db_session)
    r = client.patch(
        f"/api/v1/pendencias/{pendencia.id}",
        json={"status": "status_invalido"},
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 400


def test_update_pendencia_not_found(client, analyst_token):
    r = client.patch(
        "/api/v1/pendencias/nonexistent",
        json={"status": "resolvido"},
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 404


def test_pendencia_historico_records_status_change(client, analyst_token, db_session):
    pendencia, _, _ = _make_pendencia(db_session)
    client.patch(
        f"/api/v1/pendencias/{pendencia.id}",
        json={"status": "em_analise", "resolution_note": "Em verificação"},
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    r = client.get(
        f"/api/v1/pendencias/{pendencia.id}/historico",
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 200
    entries = r.json()
    assert len(entries) == 1
    assert entries[0]["new_status"] == "em_analise"
    assert entries[0]["old_status"] == "novo"


def test_pendencia_historico_not_found(client, analyst_token):
    r = client.get(
        "/api/v1/pendencias/nonexistent/historico",
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 404


def test_list_pendencias_includes_pta_mensal_origin(client, viewer_token, db_session):
    _make_pta_mensal_pendencia(db_session, activity={"gerencia": "Gerência PTA Única"})
    r = client.get(
        "/api/v1/pendencias", params={"gerencia": "Gerência PTA Única"},
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) == 1
    assert items[0]["origem"] == "pta_mensal"
    assert items[0]["origem_id"] is not None  # upload_id


def test_list_pendencias_filter_by_origem_ciclo(client, viewer_token, db_session):
    _make_pendencia(db_session, activity={"gerencia": "Gerência Origem Teste"})
    _make_pta_mensal_pendencia(db_session, activity={"gerencia": "Gerência Origem Teste"})
    r = client.get(
        "/api/v1/pendencias",
        params={"gerencia": "Gerência Origem Teste", "origem": "ciclo"},
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) == 1
    assert items[0]["origem"] == "ciclo"


def test_list_pendencias_invalid_origem(client, viewer_token):
    r = client.get(
        "/api/v1/pendencias", params={"origem": "invalido"},
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 400


def test_update_pta_mensal_pendencia(client, analyst_token, db_session):
    pendencia, _, _ = _make_pta_mensal_pendencia(db_session)
    r = client.patch(
        f"/api/v1/pendencias/{pendencia.id}",
        json={"status": "em_tratamento"},
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "em_tratamento"
    assert data["origem"] == "pta_mensal"


def test_filtros_returns_available_gerencias_e_cidades(client, viewer_token, db_session):
    _make_pendencia(db_session, activity={"gerencia": "Gerência Filtros Ciclo", "cidade": "Cidade Filtros Ciclo"})
    _make_pta_mensal_pendencia(db_session, activity={"gerencia": "Gerência Filtros PTA", "cidade": "Cidade Filtros PTA"})

    r = client.get("/api/v1/pendencias/filtros", headers={"Authorization": f"Bearer {viewer_token}"})
    assert r.status_code == 200
    data = r.json()
    assert "Gerência Filtros Ciclo" in data["gerencias"]
    assert "Gerência Filtros PTA" in data["gerencias"]
    assert "Cidade Filtros Ciclo" in data["cidades"]
    assert "Cidade Filtros PTA" in data["cidades"]


def test_filtros_scoped_by_origem(client, viewer_token, db_session):
    _make_pendencia(db_session, activity={"gerencia": "Gerência Só Ciclo"})
    _make_pta_mensal_pendencia(db_session, activity={"gerencia": "Gerência Só PTA"})

    r = client.get("/api/v1/pendencias/filtros", params={"origem": "ciclo"}, headers={"Authorization": f"Bearer {viewer_token}"})
    assert r.status_code == 200
    data = r.json()
    assert "Gerência Só Ciclo" in data["gerencias"]
    assert "Gerência Só PTA" not in data["gerencias"]


def test_filtros_invalid_origem(client, viewer_token):
    r = client.get("/api/v1/pendencias/filtros", params={"origem": "invalido"}, headers={"Authorization": f"Bearer {viewer_token}"})
    assert r.status_code == 400


def test_filtros_unauthenticated(client):
    r = client.get("/api/v1/pendencias/filtros")
    assert r.status_code == 401
