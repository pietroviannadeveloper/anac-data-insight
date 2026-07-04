"""Integration test: pendências are auto-created from CicloActivity flags on upload."""
import io


def test_upload_ciclos_creates_pendencia_tracking(client, analyst_token, db_session):
    from app.models.analysis import PendenciaTracking

    csv_content = (
        "Atividade;Gerencia;Cidade;Mes;Realizado;Agendado;GIASO;PCDP;Processo\n"
        "Inspeção pendente;GPA;;Janeiro;;;;;\n"
        "Inspeção ok;GPA;Recife;Fevereiro;2026-02-10;;G123;P123;PR123\n"
    ).encode("utf-8")

    r = client.post(
        "/api/v1/upload-and-analyze",
        files={"file": ("ciclos_pendencias.csv", io.BytesIO(csv_content), "text/csv")},
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 201, r.text
    analysis_id = r.json()["id"]

    from app.models.analysis import CicloActivity

    pendencias = (
        db_session.query(PendenciaTracking)
        .join(CicloActivity, PendenciaTracking.source_id == CicloActivity.id)
        .filter(PendenciaTracking.source_type == "ciclo", CicloActivity.analysis_id == analysis_id)
        .all()
    )
    # Only the first row (missing city, no scheduling, no GIASO/PCDP/Processo) qualifies
    assert len(pendencias) == 1
    assert pendencias[0].severity == "critica"

    list_r = client.get(
        "/api/v1/pendencias", params={"analysis_id": analysis_id},
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert list_r.status_code == 200
    assert list_r.json()["total"] == 1
