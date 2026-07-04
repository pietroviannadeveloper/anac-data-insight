"""Tests for dictionary.py routes and dictionary_lookup service."""
import pytest


def test_list_entries_authenticated(client, viewer_token):
    r = client.get("/api/v1/dictionary", headers={"Authorization": f"Bearer {viewer_token}"})
    assert r.status_code == 200
    data = r.json()
    assert "items" in data
    assert "categories" in data


def test_list_entries_unauthenticated(client):
    r = client.get("/api/v1/dictionary")
    assert r.status_code == 401


def test_create_entry_admin(client, admin_token):
    r = client.post(
        "/api/v1/dictionary",
        json={
            "category": "gerencia",
            "canonical_value": "Gerência de Planejamento",
            "aliases": ["GPA", "G. Planejamento"],
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 201
    data = r.json()
    assert data["canonical_value"] == "Gerência de Planejamento"
    assert "GPA" in data["aliases"]


def test_create_entry_analyst_forbidden(client, analyst_token):
    r = client.post(
        "/api/v1/dictionary",
        json={"category": "cidade", "canonical_value": "Brasília", "aliases": []},
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 403


def test_create_entry_invalid_category(client, admin_token):
    r = client.post(
        "/api/v1/dictionary",
        json={"category": "invalido", "canonical_value": "X", "aliases": []},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 400


def test_create_entry_empty_value(client, admin_token):
    r = client.post(
        "/api/v1/dictionary",
        json={"category": "cidade", "canonical_value": "   ", "aliases": []},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 400


def test_list_entries_filter_by_category(client, admin_token):
    # Uses admin_token for every call in this test: the login endpoint sets an
    # httpOnly cookie that takes precedence over the Bearer header (see
    # dependencies._extract_token), so mixing two logins in one TestClient
    # session would silently swap the active user mid-test.
    client.post(
        "/api/v1/dictionary",
        json={"category": "cidade", "canonical_value": "Brasília", "aliases": ["BSB"]},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    client.post(
        "/api/v1/dictionary",
        json={"category": "gerencia", "canonical_value": "Gerência X", "aliases": []},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    r = client.get(
        "/api/v1/dictionary",
        params={"category": "cidade"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    items = r.json()["items"]
    assert all(i["category"] == "cidade" for i in items)
    assert any(i["canonical_value"] == "Brasília" for i in items)


def test_update_entry(client, admin_token, db_session):
    from app.models.dictionary import DictionaryEntry
    entry = DictionaryEntry(category="cidade", canonical_value="Old", aliases=[], created_by="admin_test")
    db_session.add(entry)
    db_session.commit()
    db_session.refresh(entry)

    r = client.patch(
        f"/api/v1/dictionary/{entry.id}",
        json={"canonical_value": "New", "aliases": ["N"]},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    assert r.json()["canonical_value"] == "New"
    assert r.json()["aliases"] == ["N"]


def test_update_entry_not_found(client, admin_token):
    r = client.patch(
        "/api/v1/dictionary/nonexistent",
        json={"canonical_value": "New"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 404


def test_delete_entry(client, admin_token, db_session):
    from app.models.dictionary import DictionaryEntry
    entry = DictionaryEntry(category="cidade", canonical_value="To delete", aliases=[], created_by="admin_test")
    db_session.add(entry)
    db_session.commit()
    db_session.refresh(entry)

    r = client.delete(
        f"/api/v1/dictionary/{entry.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 204


def test_delete_entry_not_found(client, admin_token):
    r = client.delete(
        "/api/v1/dictionary/nonexistent",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 404


def test_normalize_matches_canonical_value(db_session):
    from app.models.dictionary import DictionaryEntry
    from app.services.dictionary_lookup import normalize

    db_session.add(DictionaryEntry(category="gerencia", canonical_value="Gerência de Planejamento", aliases=["GPA"]))
    db_session.commit()

    assert normalize("gerencia", "gerência de planejamento", db_session) == "Gerência de Planejamento"


def test_normalize_matches_alias(db_session):
    from app.models.dictionary import DictionaryEntry
    from app.services.dictionary_lookup import normalize

    db_session.add(DictionaryEntry(category="gerencia", canonical_value="Gerência de Planejamento", aliases=["GPA"]))
    db_session.commit()

    assert normalize("gerencia", "gpa", db_session) == "Gerência de Planejamento"


def test_normalize_unknown_returns_none(db_session):
    from app.services.dictionary_lookup import normalize

    assert normalize("gerencia", "Inexistente", db_session) is None


def test_normalize_empty_value_returns_none(db_session):
    from app.services.dictionary_lookup import normalize

    assert normalize("gerencia", "", db_session) is None


def test_normalize_ignores_inactive_entries(db_session):
    from app.models.dictionary import DictionaryEntry
    from app.services.dictionary_lookup import normalize

    db_session.add(DictionaryEntry(category="cidade", canonical_value="Recife-Inativo", aliases=["REC-INATIVO"], active=0))
    db_session.commit()

    assert normalize("cidade", "REC-INATIVO", db_session) is None
