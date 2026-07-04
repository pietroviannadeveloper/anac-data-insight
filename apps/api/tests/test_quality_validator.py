"""Tests for app/services/quality_validator.py."""
import polars as pl

from app.services.quality_validator import validate_quality


def _isolated_session():
    """A genuinely-empty in-memory DB session.

    The shared `db_session` fixture is session-scoped across the whole test
    run and other test modules commit DictionaryEntry rows into it, so it
    can't reliably represent an "empty dictionary" state for these tests.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import StaticPool
    from app.db.database import Base
    from app.models import dictionary  # noqa: F401

    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


def test_empty_dataframe_is_blocking():
    df = pl.DataFrame({"Atividade": [], "Gerencia": [], "Cidade": []})
    report = validate_quality(df, "ciclos", db=None)
    assert report["score"] == 80  # 100 - 20 per blocking error
    assert any(e["code"] == "empty_file" for e in report["errors"])


def test_ciclos_missing_required_columns_is_blocking(db_session):
    df = pl.DataFrame({"Coluna A": ["x"], "Coluna B": ["y"]})
    report = validate_quality(df, "ciclos", db_session)
    assert report["errors"]
    assert report["errors"][0]["code"] == "missing_required_columns"
    assert report["score"] < 100


def test_ciclos_valid_dataframe_no_errors():
    df = pl.DataFrame({
        "Atividade": ["Inspeção 1", "Inspeção 2"],
        "Gerencia": ["GPA", "GPA"],
        "Cidade": ["Brasília", "Recife"],
        "Mes": ["Janeiro", "Fevereiro"],
    })
    session = _isolated_session()
    report = validate_quality(df, "ciclos", session)
    session.close()
    assert report["errors"] == []
    assert report["score"] == 100


def test_ciclos_empty_required_field_is_warning(db_session):
    df = pl.DataFrame({
        "Atividade": ["Inspeção 1", "Inspeção 2"],
        "Gerencia": ["GPA", ""],
        "Cidade": ["Brasília", "Recife"],
    })
    report = validate_quality(df, "ciclos", db_session)
    assert report["errors"] == []
    assert any(w["code"] == "empty_required_field" for w in report["warnings"])
    assert report["score"] < 100


def test_ciclos_duplicate_activities_is_warning(db_session):
    df = pl.DataFrame({
        "Atividade": ["Inspeção 1", "Inspeção 1"],
        "Gerencia": ["GPA", "GPA"],
        "Cidade": ["Brasília", "Brasília"],
        "Mes": ["Janeiro", "Janeiro"],
    })
    report = validate_quality(df, "ciclos", db_session)
    assert any(w["code"] == "duplicate_activities" for w in report["warnings"])


def test_ciclos_dictionary_divergence_warns_when_dictionary_has_entries(db_session):
    from app.models.dictionary import DictionaryEntry
    db_session.add(DictionaryEntry(category="cidade", canonical_value="Brasília", aliases=["BSB"]))
    db_session.commit()

    df = pl.DataFrame({
        "Atividade": ["Inspeção 1"],
        "Gerencia": ["GPA"],
        "Cidade": ["Cidade Inexistente"],
    })
    report = validate_quality(df, "ciclos", db_session)
    assert any(w["code"] == "unknown_cidade" for w in report["warnings"])
    assert report["suggestions"]


def test_ciclos_no_divergence_warning_when_dictionary_empty():
    df = pl.DataFrame({
        "Atividade": ["Inspeção 1"],
        "Gerencia": ["GPA"],
        "Cidade": ["Qualquer Cidade"],
    })
    session = _isolated_session()
    report = validate_quality(df, "ciclos", session)
    session.close()
    assert not any(w["code"].startswith("unknown_") for w in report["warnings"])


def test_ciclos_known_alias_does_not_warn(db_session):
    from app.models.dictionary import DictionaryEntry
    db_session.add(DictionaryEntry(category="cidade", canonical_value="Brasília", aliases=["BSB"]))
    db_session.commit()

    df = pl.DataFrame({
        "Atividade": ["Inspeção 1"],
        "Gerencia": ["GPA"],
        "Cidade": ["BSB"],
    })
    report = validate_quality(df, "ciclos", db_session)
    assert not any(w["code"] == "unknown_cidade" for w in report["warnings"])


def test_generic_duplicate_rows_is_warning(db_session):
    df = pl.DataFrame({
        "Coluna A": ["x", "x"],
        "Coluna B": ["y", "y"],
    })
    report = validate_quality(df, "generic", db_session)
    assert any(w["code"] == "duplicate_rows" for w in report["warnings"])


def test_generic_no_duplicates_no_warnings(db_session):
    df = pl.DataFrame({
        "Coluna A": ["x", "z"],
        "Coluna B": ["y", "w"],
    })
    report = validate_quality(df, "generic", db_session)
    assert report["warnings"] == []
    assert report["score"] == 100
