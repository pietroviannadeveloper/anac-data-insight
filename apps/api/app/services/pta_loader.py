"""
PTA Loader Service
==================
Reads historical PTA CSV files from docs/historicoPTA/, computes indicators
for each year × tipo_ciclo combination, and persists PTASnapshot records.
"""

from __future__ import annotations

import re
import unicodedata
from pathlib import Path
from typing import Literal

import polars as pl

from app.services.ciclo_analyzer import analyze_ciclos, _norm_cols, _find_col, _is_empty

TipoCiclo = Literal["CICLO_BASE", "CICLO_DESEMPENHO", "NAO_PROGRAMADA"]

# Directory with historical CSVs — relative to the project root
_PTA_DIR = Path(__file__).resolve().parents[4] / "docs" / "historicoPTA"

_YEAR_RE = re.compile(r"(\d{4})")

_TIPO_PATTERNS: list[tuple[re.Pattern, TipoCiclo]] = [
    (re.compile(r"desempenho", re.IGNORECASE), "CICLO_DESEMPENHO"),
    (re.compile(r"n[aã]o[\s_-]*(?:programadas?|informadas?)", re.IGNORECASE), "NAO_PROGRAMADA"),
    (re.compile(r"ciclo[\s_-]*base", re.IGNORECASE), "CICLO_BASE"),
]


def _strip_accents(text: str) -> str:
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def _classify_filename(filename: str) -> tuple[TipoCiclo | None, int | None]:
    """Extract tipo and year from a CSV filename."""
    name = _strip_accents(filename.lower())
    tipo: TipoCiclo | None = None
    for pattern, t in _TIPO_PATTERNS:
        if pattern.search(name):
            tipo = t
            break
    m = _YEAR_RE.search(filename)
    year = int(m.group(1)) if m else None
    return tipo, year


def _read_csv(path: Path) -> pl.DataFrame:
    """Read a semicolon-delimited CSV trying common ANAC encodings."""
    for enc in ("latin-1", "cp1252", "utf-8"):
        try:
            df = pl.read_csv(
                path,
                separator=";",
                encoding=enc,
                infer_schema_length=0,
                ignore_errors=True,
            )
            if df.height > 0:
                return df
        except Exception:
            continue
    return pl.DataFrame()


def list_seed_files() -> list[dict]:
    """Return metadata for every parseable CSV in the historicoPTA directory."""
    results: list[dict] = []
    if not _PTA_DIR.exists():
        return results
    for f in sorted(_PTA_DIR.glob("*.csv")):
        tipo, year = _classify_filename(f.name)
        results.append({"filename": f.name, "tipo_ciclo": tipo, "year": year, "path": str(f)})
    return results


def _top_atividades(df: pl.DataFrame, top_n: int = 50) -> list[dict]:
    """Return the top N activities by number of realized rows."""
    mapping = _norm_cols(df)
    col_atv = _find_col(mapping, "atividade")
    col_real = _find_col(mapping, "realizado")
    if not col_atv:
        return []

    df2 = df.with_columns(
        pl.col(col_atv).cast(pl.Utf8).str.strip_chars().alias("_atv"),
    )
    if col_real:
        df2 = df2.with_columns(
            (~_is_empty(df[col_real])).cast(pl.Int32).alias("_realizado")
        )
    else:
        df2 = df2.with_columns(pl.lit(0).alias("_realizado"))

    agg = (
        df2.group_by("_atv")
        .agg([
            pl.len().alias("total"),
            pl.col("_realizado").sum().alias("realizadas"),
        ])
        .filter(pl.col("_atv").str.len_chars() > 0)
        .sort("realizadas", descending=True)
        .head(top_n)
    )
    return [
        {"atividade": r["_atv"], "realizadas": int(r["realizadas"]), "total": int(r["total"])}
        for r in agg.to_dicts()
    ]


def _top_empresas(df: pl.DataFrame, top_n: int = 50) -> list[dict]:
    """Return the top N regulated companies by total and realized activities."""
    mapping = _norm_cols(df)
    col_reg = _find_col(mapping, "regulado")
    col_real = _find_col(mapping, "realizado")
    if not col_reg:
        return []

    df2 = df.with_columns(
        pl.col(col_reg).cast(pl.Utf8).str.strip_chars().alias("_empresa"),
    )
    if col_real:
        df2 = df2.with_columns(
            (~_is_empty(df[col_real])).cast(pl.Int32).alias("_realizado")
        )
    else:
        df2 = df2.with_columns(pl.lit(0).alias("_realizado"))

    agg = (
        df2.group_by("_empresa")
        .agg([
            pl.len().alias("total"),
            pl.col("_realizado").sum().alias("realizadas"),
        ])
        .filter(pl.col("_empresa").str.len_chars() > 0)
        .sort("total", descending=True)
        .head(top_n)
    )
    return [
        {"empresa": r["_empresa"], "realizadas": int(r["realizadas"]), "total": int(r["total"])}
        for r in agg.to_dicts()
    ]


def load_snapshots() -> list[dict]:
    """
    Read all CSVs, compute indicators, and return a list of snapshot dicts
    ready to be upserted into the database.
    """
    snapshots: list[dict] = []
    for meta in list_seed_files():
        tipo: TipoCiclo | None = meta["tipo_ciclo"]
        year: int | None = meta["year"]
        if not tipo or not year:
            continue
        path = Path(meta["path"])
        df = _read_csv(path)
        if df.is_empty():
            continue
        try:
            indicators = analyze_ciclos(df)
            indicators["top_atividades"] = _top_atividades(df)
            indicators["top_empresas"] = _top_empresas(df)
        except Exception as exc:
            indicators = {"erro": str(exc)}
        snapshots.append(
            {
                "year": year,
                "tipo_ciclo": tipo,
                "source_file": meta["filename"],
                "indicators": indicators,
                "total_rows": df.height,
            }
        )
    return snapshots
