"""Tests for ciclo_analyzer service — 13 required cases from context.md."""
import polars as pl
import pytest

from app.services.ciclo_analyzer import analyze_ciclos


def _make_df(**kwargs) -> pl.DataFrame:
    """Build a minimal ciclo DataFrame with given column overrides.

    Repeats single-value defaults to match the length of provided kwargs.
    """
    # Find desired row count from kwargs
    nrows = 1
    for v in kwargs.values():
        if hasattr(v, "__len__"):
            nrows = max(nrows, len(v))

    def _expand(val):
        if hasattr(val, "__len__") and not isinstance(val, str):
            return list(val)
        return [val] * nrows

    defaults = {
        "item": list(map(str, range(1, nrows + 1))),
        "atividade": [f"Fiscalização {i}" for i in range(1, nrows + 1)],
        "gerencia": ["GTAP"] * nrows,
        "setor": ["INSPETORIA"] * nrows,
        "regulado": ["CIA AÉREA"] * nrows,
        "cidade": ["Brasília"] * nrows,
        "mes": ["Jan"] * nrows,
        "mes_agendado": ["Jan"] * nrows,
        "mes_realizado": ["Jan"] * nrows,
        "giaso": ["G-123"] * nrows,
        "pcdp": ["PCDP-001"] * nrows,
        "processo": ["P-001"] * nrows,
        "prioridade": ["Alta"] * nrows,
    }
    for k, v in kwargs.items():
        defaults[k] = _expand(v)
    return pl.DataFrame(defaults)


# ── 1. Planilha vazia ────────────────────────────────────────────────────────

def test_empty_spreadsheet():
    df = pl.DataFrame({
        "item": [], "atividade": [], "gerencia": [], "setor": [], "regulado": [],
        "cidade": [], "mes": [], "mes_agendado": [], "mes_realizado": [],
        "giaso": [], "pcdp": [], "processo": [], "prioridade": [],
    })
    result = analyze_ciclos(df)
    assert result["total_atividades"] == 0
    assert result["taxa_execucao"] == 0.0
    assert result["taxa_agendamento"] == 0.0


# ── 2. Todas realizadas ──────────────────────────────────────────────────────

def test_all_realized():
    df = _make_df(
        item=["1", "2"],
        atividade=["A", "B"],
        mes_agendado=["Jan", "Fev"],
        mes_realizado=["Jan", "Fev"],
    )
    r = analyze_ciclos(df)
    assert r["realizadas"] == 2
    assert r["agendadas"] == 0
    assert r["sem_agendamento"] == 0
    assert r["taxa_execucao"] == 100.0


# ── 3. Todas agendadas ───────────────────────────────────────────────────────

def test_all_scheduled():
    df = _make_df(
        item=["1", "2"],
        atividade=["A", "B"],
        mes_agendado=["Jan", "Fev"],
        mes_realizado=[None, None],
    )
    r = analyze_ciclos(df)
    assert r["realizadas"] == 0
    assert r["agendadas"] == 2
    assert r["sem_agendamento"] == 0
    assert r["taxa_execucao"] == 0.0


# ── 4. Todas sem agendamento ─────────────────────────────────────────────────

def test_all_unscheduled():
    df = _make_df(
        item=["1", "2"],
        atividade=["A", "B"],
        mes_agendado=[None, None],
        mes_realizado=[None, None],
    )
    r = analyze_ciclos(df)
    assert r["sem_agendamento"] == 2
    assert r["realizadas"] == 0
    assert r["agendadas"] == 0


# ── 5. Sem GIASO ─────────────────────────────────────────────────────────────

def test_sem_giaso():
    df = _make_df(
        item=["1", "2"],
        atividade=["A", "B"],
        giaso=["G-001", None],
    )
    r = analyze_ciclos(df)
    assert r["sem_giaso"] == 1


# ── 6. Sem PCDP ──────────────────────────────────────────────────────────────

def test_sem_pcdp():
    df = _make_df(
        item=["1", "2"],
        atividade=["A", "B"],
        pcdp=[None, "P-002"],
    )
    r = analyze_ciclos(df)
    assert r["sem_pcdp"] == 1


# ── 7. Sem processo ──────────────────────────────────────────────────────────

def test_sem_processo():
    df = _make_df(
        item=["1", "2"],
        atividade=["A", "B"],
        processo=["P-001", None],
    )
    r = analyze_ciclos(df)
    assert r["sem_processo"] == 1


# ── 8. Cidade indefinida ─────────────────────────────────────────────────────

def test_cidade_indefinida():
    df = _make_df(
        item=["1", "2"],
        atividade=["A", "B"],
        cidade=["Brasília", "indefinido"],
    )
    r = analyze_ciclos(df)
    assert r["locais_indefinidos"] == 1


# ── 9. PCDP duplicada ────────────────────────────────────────────────────────

def test_pcdp_duplicada():
    df = _make_df(
        item=["1", "2"],
        atividade=["A", "B"],
        pcdp=["PCDP-001", "PCDP-001"],
    )
    r = analyze_ciclos(df)
    assert r["pcdp_duplicada"] >= 1


# ── 10. Múltiplas PCDPs para mesma atividade/regulado ────────────────────────

def test_multiplas_pcdps():
    df = _make_df(
        item=["1", "2"],
        atividade=["FISCAL", "FISCAL"],
        regulado=["CIA", "CIA"],
        pcdp=["P-001", "P-002"],
        mes_realizado=["Jan", "Jan"],
    )
    r = analyze_ciclos(df)
    assert r["multiplas_pcdps"] >= 1


# ── 11. Colunas opcionais ausentes ───────────────────────────────────────────

def test_optional_columns_absent():
    df = pl.DataFrame({
        "atividade": ["A"],
        "mes_realizado": ["Jan"],
        "mes_agendado": ["Jan"],
    })
    r = analyze_ciclos(df)
    assert r["total_atividades"] == 1
    assert r["realizadas"] == 1


# ── 12. Valores com espaços em branco ────────────────────────────────────────

def test_whitespace_values():
    df = _make_df(
        giaso=["  "],
        pcdp=["   "],
        processo=["  "],
        cidade=["  "],
        mes_realizado=["Jan"],
    )
    r = analyze_ciclos(df)
    assert r["sem_giaso"] == 1
    assert r["sem_pcdp"] == 1
    assert r["sem_processo"] == 1
    assert r["locais_indefinidos"] == 1


# ── 13. Valores nulos ────────────────────────────────────────────────────────

def test_null_values():
    df = _make_df(
        giaso=[None],
        pcdp=[None],
        processo=[None],
        cidade=[None],
        mes_realizado=[None],
        mes_agendado=[None],
    )
    r = analyze_ciclos(df)
    assert r["sem_giaso"] == 1
    assert r["sem_pcdp"] == 1
    assert r["sem_processo"] == 1
    assert r["locais_indefinidos"] == 1
    assert r["sem_agendamento"] == 1


# ── Divisão por zero ─────────────────────────────────────────────────────────

def test_no_division_by_zero():
    df = pl.DataFrame({"atividade": pl.Series([], dtype=pl.Utf8)})
    r = analyze_ciclos(df)
    assert r["taxa_execucao"] == 0.0
    assert r["taxa_agendamento"] == 0.0
