"""Integration tests for the quality-validation gate in /upload-and-analyze."""
import io


def _csv_bytes(text: str) -> bytes:
    return text.encode("utf-8")


def test_upload_valid_ciclos_file_returns_quality_report(client, analyst_token):
    csv_content = _csv_bytes(
        "Atividade;Gerencia;Cidade;Mes;Realizado;Agendado\n"
        "Inspeção 1;GPA;Brasília;Janeiro;2026-01-10;\n"
        "Inspeção 2;GPA;Recife;Fevereiro;;2026-02-10\n"
    )
    r = client.post(
        "/api/v1/upload-and-analyze",
        files={"file": ("ciclos.csv", io.BytesIO(csv_content), "text/csv")},
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["quality_report"] is not None
    assert data["quality_report"]["errors"] == []


def test_upload_generic_file_has_no_required_column_gate(client, analyst_token):
    csv_content = _csv_bytes("Coluna A;Coluna B\nx;y\n")
    r = client.post(
        "/api/v1/upload-and-analyze",
        files={"file": ("generico.csv", io.BytesIO(csv_content), "text/csv")},
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    # Classified as "generic" (no ciclos column signals) — the required-column
    # gate only applies to "ciclos", so this succeeds with an empty error list.
    assert r.status_code == 201, r.text
    assert r.json()["quality_report"]["errors"] == []


def test_upload_force_bypasses_blocking_errors(client, analyst_token, monkeypatch):
    from app.services import quality_validator

    def _fake_validate(df, detected_type, db):
        return {"score": 0, "errors": [{"code": "fake", "message": "erro forçado"}], "warnings": [], "suggestions": [], "total_rows": len(df)}

    monkeypatch.setattr("app.routes.upload.validate_quality", _fake_validate)

    csv_content = _csv_bytes("Coluna A;Coluna B\nx;y\n")

    r_blocked = client.post(
        "/api/v1/upload-and-analyze",
        files={"file": ("bloqueado.csv", io.BytesIO(csv_content), "text/csv")},
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r_blocked.status_code == 422
    assert r_blocked.json()["detail"]["quality_report"]["errors"]

    r_forced = client.post(
        "/api/v1/upload-and-analyze?force=true",
        files={"file": ("bloqueado2.csv", io.BytesIO(csv_content), "text/csv")},
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r_forced.status_code == 201, r_forced.text
    assert r_forced.json()["quality_report"]["errors"]
