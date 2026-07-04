"""Regression test: the two-step /upload + POST /analyses flow must also
create PendenciaTracking rows, mirroring /upload-and-analyze (see
app/routes/analyses.py's separate _save_ciclo_activities)."""
import io


def test_create_analysis_creates_pendencia_tracking(client, analyst_token, db_session):
    from app.models.analysis import CicloActivity, PendenciaTracking

    # Note: this endpoint's _save_ciclo_activities (app/routes/analyses.py) looks
    # up the literal keys "mesrealizado"/"mesagendado", not the fuzzy
    # "realizado"/"agendado" patterns used by upload.py — so the header here
    # uses the combined column names that implementation actually recognizes.
    csv_content = (
        "Atividade;Gerencia;Cidade;Mes;MesRealizado;MesAgendado;GIASO;PCDP;Processo\n"
        "Inspeção pendente;GPA;;Janeiro;;;;;\n"
        "Inspeção ok;GPA;Recife;Fevereiro;2026-02-10;;G123;P123;PR123\n"
    ).encode("utf-8")

    upload_r = client.post(
        "/api/v1/upload",
        files={"file": ("ciclos_2step.csv", io.BytesIO(csv_content), "text/csv")},
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert upload_r.status_code == 200, upload_r.text
    upload_id = upload_r.json()["id"]

    create_r = client.post(
        "/api/v1/analyses",
        json={"upload_id": upload_id},
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert create_r.status_code == 201, create_r.text
    analysis_id = create_r.json()["id"]

    pendencias = (
        db_session.query(PendenciaTracking)
        .join(CicloActivity, PendenciaTracking.source_id == CicloActivity.id)
        .filter(PendenciaTracking.source_type == "ciclo", CicloActivity.analysis_id == analysis_id)
        .all()
    )
    assert len(pendencias) == 1
    assert pendencias[0].severity == "critica"
