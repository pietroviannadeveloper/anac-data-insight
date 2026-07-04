"""Integration test for GET /analyses/{id}/export/pptx."""
import io


def test_export_pptx_for_completed_analysis(client, analyst_token):
    csv_content = (
        "Atividade;Gerencia;Cidade;Mes\nInspeção 1;GPA;Brasília;Janeiro\n"
    ).encode("utf-8")
    upload_r = client.post(
        "/api/v1/upload-and-analyze",
        files={"file": ("briefing.csv", io.BytesIO(csv_content), "text/csv")},
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    analysis_id = upload_r.json()["id"]

    r = client.get(
        f"/api/v1/analyses/{analysis_id}/export/pptx",
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    assert len(r.content) > 0


def test_export_pptx_analysis_not_found(client, analyst_token):
    r = client.get(
        "/api/v1/analyses/nonexistent/export/pptx",
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 404


def test_export_pptx_not_completed(client, analyst_token, db_session):
    from app.models.analysis import Analysis

    analysis = Analysis(
        original_filename="pending.xlsx", stored_filename="x_pending.xlsx",
        file_type="xlsx", detected_type="ciclos", status="pending",
        total_rows=0, total_columns=0,
    )
    db_session.add(analysis)
    db_session.commit()
    db_session.refresh(analysis)

    r = client.get(
        f"/api/v1/analyses/{analysis.id}/export/pptx",
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 400
