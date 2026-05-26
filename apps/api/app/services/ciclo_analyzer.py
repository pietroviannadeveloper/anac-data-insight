"""
Ciclo Analyzer Service
======================
Computes operational indicators from a ciclo-type spreadsheet.
"""

from __future__ import annotations

import unicodedata
import polars as pl


_EMPTY_VALUES = {"", "indefinido", "a definir", "a definir ", "indefinido ", "-", "n/a"}


def _normalize(c: str) -> str:
    c = c.lower().replace(" ", "").replace("_", "")
    c = unicodedata.normalize("NFKD", c)
    return "".join(ch for ch in c if not unicodedata.combining(ch))


def _norm_cols(df: pl.DataFrame) -> dict[str, str]:
    """Map normalized column names back to actual DataFrame column names."""
    return {_normalize(c): c for c in df.columns}


# Aliases accepted for each logical column (checked via substring match)
_COL_PATTERNS: dict[str, list[str]] = {
    "realizado":  ["realiz", "mesrealiz", "datarealiz", "dtreali"],
    "agendado":   ["agend", "mesagend", "dataagend", "dtagend", "previsto", "planejado"],
    "atividade":  ["atividade", "atv"],
    "gerencia":   ["gerencia"],
    "regulado":   ["regulado", "fiscalizado", "operador", "empresa"],
    "giaso":      ["giaso"],
    "pcdp":       ["pcdp"],
    "processo":   ["processo", "proc"],
    "cidade":     ["cidade", "local", "municipio", "aeroporto", "aerodro"],
    "item":       ["item", "numero", "num", "seq"],
    "mes":        ["^mes$", "periodo", "competencia"],
    "prioridade": ["prioridade", "prior"],
    "setor":      ["setor", "divisao", "area"],
}


def _find_col(mapping: dict[str, str], logical: str) -> str | None:
    """Find the actual column name matching a logical field via pattern."""
    patterns = _COL_PATTERNS.get(logical, [logical])
    for col_norm, col_real in mapping.items():
        for p in patterns:
            if p.startswith("^") and p.endswith("$"):
                if col_norm == p[1:-1]:
                    return col_real
            elif p in col_norm:
                return col_real
    return None


def _is_empty(series: pl.Series) -> pl.Series:
    return series.is_null() | series.cast(pl.Utf8).str.strip_chars().str.to_lowercase().is_in(list(_EMPTY_VALUES))


def analyze_ciclos(df: pl.DataFrame) -> dict:
    """
    Analyse a ciclo-type Polars DataFrame and return a dict of indicators.

    Args:
        df: Polars DataFrame already classified as 'ciclos' type.

    Returns:
        Dictionary with all indicator keys defined in CicloIndicators TypeScript type.
    """
    mapping = _norm_cols(df)
    total = len(df)

    # --- Column resolution ---
    col_realizado = _find_col(mapping, "realizado")
    col_agendado  = _find_col(mapping, "agendado")
    col_giaso     = _find_col(mapping, "giaso")
    col_pcdp      = _find_col(mapping, "pcdp")
    col_processo  = _find_col(mapping, "processo")
    col_cidade    = _find_col(mapping, "cidade")
    col_atividade = _find_col(mapping, "atividade")
    col_regulado  = _find_col(mapping, "regulado")

    # --- Status detection ---
    if col_realizado and col_agendado:
        realizado_filled = ~_is_empty(df[col_realizado])
        agendado_filled = ~_is_empty(df[col_agendado])
        realizadas = int(realizado_filled.sum())
        agendadas = int((agendado_filled & ~realizado_filled).sum())
        sem_agendamento = total - realizadas - agendadas
    elif col_realizado:
        realizado_filled = ~_is_empty(df[col_realizado])
        realizadas = int(realizado_filled.sum())
        agendadas = 0
        sem_agendamento = total - realizadas
    else:
        realizadas = 0
        agendadas = 0
        sem_agendamento = total

    # --- Pendência flags ---
    sem_giaso = int(_is_empty(df[col_giaso]).sum()) if col_giaso else 0
    sem_pcdp = int(_is_empty(df[col_pcdp]).sum()) if col_pcdp else 0
    sem_processo = int(_is_empty(df[col_processo]).sum()) if col_processo else 0

    if col_cidade:
        locais_indefinidos = int(_is_empty(df[col_cidade]).sum())
    else:
        locais_indefinidos = 0

    # --- Aggregate PCDP rules ---
    pcdp_duplicada = 0
    multiplas_pcdps = 0

    if col_pcdp:
        pcdp_series = df[col_pcdp].cast(pl.Utf8).str.strip_chars()
        valid_pcdp = pcdp_series.filter(~_is_empty(pcdp_series))

        # PCDPs that appear in more than one row
        if len(valid_pcdp) > 0:
            counts = (
                df.with_columns(pl.col(col_pcdp).cast(pl.Utf8).str.strip_chars().alias("_pcdp"))
                .filter(~_is_empty(pl.Series("x", df[col_pcdp].cast(pl.Utf8).to_list())))
                .group_by("_pcdp")
                .agg(pl.len().alias("n"))
            )
            pcdp_duplicada = counts.filter(pl.col("n") > 1).height

        # Same atividade+regulado pair with more than one distinct PCDP
        if col_atividade and col_regulado:
            pair_pcdp = (
                df.with_columns([
                    pl.col(col_atividade).cast(pl.Utf8).str.strip_chars().alias("_atv"),
                    pl.col(col_regulado).cast(pl.Utf8).str.strip_chars().alias("_reg"),
                    pl.col(col_pcdp).cast(pl.Utf8).str.strip_chars().alias("_pcdp"),
                ])
                .filter(~_is_empty(pl.Series("x", df[col_pcdp].cast(pl.Utf8).to_list())))
                .group_by(["_atv", "_reg"])
                .agg(pl.col("_pcdp").n_unique().alias("n_pcdps"))
            )
            multiplas_pcdps = pair_pcdp.filter(pl.col("n_pcdps") > 1).height

    # --- Summary indicators ---
    taxa_execucao = round((realizadas / total * 100), 2) if total > 0 else 0.0
    taxa_agendamento = round(((realizadas + agendadas) / total * 100), 2) if total > 0 else 0.0
    pendencias_criticas = sem_giaso + pcdp_duplicada + multiplas_pcdps

    return {
        "total_atividades": total,
        "realizadas": realizadas,
        "agendadas": agendadas,
        "sem_agendamento": sem_agendamento,
        "sem_giaso": sem_giaso,
        "sem_pcdp": sem_pcdp,
        "sem_processo": sem_processo,
        "locais_indefinidos": locais_indefinidos,
        "pcdp_duplicada": pcdp_duplicada,
        "multiplas_pcdps": multiplas_pcdps,
        "taxa_execucao": taxa_execucao,
        "taxa_agendamento": taxa_agendamento,
        "pendencias_criticas": pendencias_criticas,
    }
