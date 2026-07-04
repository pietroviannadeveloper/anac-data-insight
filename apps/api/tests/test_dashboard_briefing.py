"""Tests for GET /dashboard/briefing."""
import io


def _upload_ciclos(client, token, filename="briefing_data.csv"):
    csv_content = (
        "Atividade;Gerencia;Cidade;Mes;Realizado;Agendado;GIASO;PCDP;Processo\n"
        "Inspeção 1;GPA;Brasília;Janeiro;2026-01-10;;G1;P1;PR1\n"
        "Inspeção 2;GPA;Brasília;Fevereiro;;;;;\n"
    ).encode("utf-8")
    r = client.post(
        "/api/v1/upload-and-analyze",
        files={"file": (filename, io.BytesIO(csv_content), "text/csv")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_briefing_returns_kpis_and_pendencias(client, analyst_token):
    _upload_ciclos(client, analyst_token)
    r = client.get(
        "/api/v1/dashboard/briefing",
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert "kpis" in data
    assert "pendencias_criticas" in data
    assert data["pendencias_criticas"]["total"] >= 1
    assert data["kpis"]["total_activities"] >= 2


def test_briefing_filter_by_gerencia(client, analyst_token):
    _upload_ciclos(client, analyst_token, filename="briefing_gerencia.csv")
    r = client.get(
        "/api/v1/dashboard/briefing",
        params={"gerencia": "GPA"},
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 200
    assert r.json()["kpis"]["total_activities"] >= 1


def test_briefing_unauthenticated(client):
    r = client.get("/api/v1/dashboard/briefing")
    assert r.status_code == 401


def test_briefing_comparison_with_period(client, analyst_token):
    _upload_ciclos(client, analyst_token, filename="briefing_periodo.csv")
    r = client.get(
        "/api/v1/dashboard/briefing",
        params={"date_from": "2026-01-01", "date_to": "2026-12-31"},
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 200
    assert "comparison" in r.json()


def test_briefing_origem_ciclo_excludes_pta_mensal(client, analyst_token, db_session):
    from app.models.analysis import PendenciaTracking
    from app.models.pta_mensal import PTAMensalActivity, PTAMensalUpload

    _upload_ciclos(client, analyst_token, filename="briefing_origem_ciclo.csv")

    upload = PTAMensalUpload(tipo="CICLO_BASE", year=2026, total_rows=1)
    db_session.add(upload)
    db_session.commit()
    db_session.refresh(upload)
    activity = PTAMensalActivity(
        upload_id=upload.id, atividade="PTA isolado", gerencia="GCO", cidade="Recife",
        status="sem-agendamento", sem_giaso=1, sem_pcdp=1, sem_processo=1,
    )
    db_session.add(activity)
    db_session.commit()
    db_session.refresh(activity)
    db_session.add(PendenciaTracking(source_type="pta_mensal", source_id=activity.id, severity="critica"))
    db_session.commit()

    r_combined = client.get(
        "/api/v1/dashboard/briefing",
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    r_ciclo_only = client.get(
        "/api/v1/dashboard/briefing", params={"origem": "ciclo"},
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r_combined.status_code == 200
    assert r_ciclo_only.status_code == 200
    assert r_ciclo_only.json()["kpis"]["pendencias_criticas"] < r_combined.json()["kpis"]["pendencias_criticas"]

    # cleanup so other test modules don't see this PTAMensalUpload as residual state
    db_session.query(PendenciaTracking).filter(PendenciaTracking.source_id == activity.id).delete()
    db_session.query(PTAMensalActivity).filter(PTAMensalActivity.id == activity.id).delete()
    db_session.query(PTAMensalUpload).filter(PTAMensalUpload.id == upload.id).delete()
    db_session.commit()


def test_briefing_invalid_origem(client, analyst_token):
    r = client.get(
        "/api/v1/dashboard/briefing", params={"origem": "invalido"},
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 400


def test_briefing_sem_historico_nao_calcula_comparacao(client, analyst_token):
    _upload_ciclos(client, analyst_token, filename="briefing_sem_historico.csv")
    r = client.get(
        "/api/v1/dashboard/briefing", params={"incluir_historico": "false"},
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 200
    comparison = r.json()["comparison"]
    assert comparison["average_execution_rate_previous"] is None
    assert comparison["delta"] is None
