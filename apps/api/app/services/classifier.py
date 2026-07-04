"""
Spreadsheet Classifier  (Python ≥ 3.9 compatible)
======================
Detects whether a spreadsheet is a ciclo-type (fiscal cycle) based on
column name patterns, accepting variations with accents, spaces, and
different naming conventions.

Also classifies individual rows as CICLO_BASE, CICLO_DESEMPENHO,
NAO_PROGRAMADA or INDEFINIDO based on the Item column prefix.
"""

from __future__ import annotations

import re
import unicodedata
import polars as pl
from typing import Literal

SpreadsheetType = Literal["ciclos", "generic", "unknown"]
TipoCiclo = Literal["CICLO_BASE", "CICLO_DESEMPENHO", "NAO_PROGRAMADA", "INDEFINIDO"]

# Bumped whenever the column-signal patterns or row classification rules change,
# so audit trails can record which ruleset produced a given Analysis.
CLASSIFIER_VERSION = "1.0"

# Regex patterns for row-level classification (case-insensitive)
_RE_DESEMPENHO   = re.compile(r"^\s*D[\s.\-_/]*[A-Za-z0-9]+", re.IGNORECASE)
_RE_NAO_PROGRAMADA = re.compile(r"^\s*N[\s.\-_/]*\d+", re.IGNORECASE)


def normalize_col(c: str) -> str:
    """Lowercase, remove spaces/underscores/hyphens, strip accents."""
    c = c.lower().replace(" ", "").replace("_", "").replace("-", "")
    c = unicodedata.normalize("NFKD", c)
    return "".join(ch for ch in c if not unicodedata.combining(ch))


# Each group is a set of substrings — a column matches the group if it
# contains ANY of the substrings after normalization.
_SIGNAL_GROUPS = {
    "realizado":  ["realiz", "mesrealiz", "datarealiz", "dtreali"],
    "agendado":   ["agend", "mesagend", "dataagend", "dtagend", "previsto", "planejado"],
    "atividade":  ["atividade", "atv", "acao", "inspecao", "auditoria", "vistoria", "fiscaliz"],
    "gerencia":   ["gerencia", "gerente", "setor", "unidade", "divisao", "area"],
    "regulado":   ["regulado", "fiscalizado", "operador", "empresa", "aeroporto", "aerodro"],
    "giaso":      ["giaso"],
    "pcdp":       ["pcdp"],
    "processo":   ["processo", "proc"],
    "mes":        ["^mes$", "periodo", "competencia", "ciclo"],
}


def _col_matches(col_norm: str, substrings: list[str]) -> bool:
    for s in substrings:
        if s.startswith("^") and s.endswith("$"):
            if col_norm == s[1:-1]:
                return True
        elif s in col_norm:
            return True
    return False


def _matched_groups(df: pl.DataFrame) -> set[str]:
    """Return which signal groups have at least one matching column."""
    cols_norm = [normalize_col(c) for c in df.columns]
    matched = set()
    for group, substrings in _SIGNAL_GROUPS.items():
        if any(_col_matches(c, substrings) for c in cols_norm):
            matched.add(group)
    return matched


def classify_spreadsheet(df: pl.DataFrame) -> SpreadsheetType:
    """
    Detect spreadsheet type from column name patterns.

    A spreadsheet is classified as 'ciclos' when it has strong scheduling
    signals (realizado + agendado) OR a combination of operational columns
    typical of ANAC fiscal cycle sheets.
    """
    matched = _matched_groups(df)

    # Strong signal: has both scheduling columns
    has_scheduling = "realizado" in matched and "agendado" in matched

    # Moderate signal: has GIASO or PCDP (very specific to ciclos)
    has_specific = bool(matched & {"giaso", "pcdp"})

    # Broad signal: has activity + management + period columns
    has_broad = len(matched & {"atividade", "gerencia", "regulado", "mes"}) >= 3

    if has_scheduling or has_specific or has_broad:
        return "ciclos"
    return "generic"


def classify_row_type(item_value: str | None) -> tuple[TipoCiclo, str]:
    """
    Classify a single row as CICLO_BASE, CICLO_DESEMPENHO, NAO_PROGRAMADA or INDEFINIDO
    based on the value of the Item column.

    Returns (tipo_ciclo, criterio_classificacao).
    """
    if item_value is None or not item_value.strip():
        return "INDEFINIDO", "Coluna Item ausente ou vazia"

    val = item_value.strip()

    if _RE_DESEMPENHO.match(val):
        return "CICLO_DESEMPENHO", f"Item inicia com 'D': {val}"

    if _RE_NAO_PROGRAMADA.match(val):
        return "NAO_PROGRAMADA", f"Item inicia com 'N' seguido de número: {val}"

    if val[0].isdigit():
        return "CICLO_BASE", f"Item numérico (ciclo base): {val}"

    return "INDEFINIDO", f"Padrão de Item não reconhecido: {val}"
