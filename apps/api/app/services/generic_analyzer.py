"""
Generic Spreadsheet Analyzer
=============================
Profiles any Excel/CSV file that was not classified as a ciclos spreadsheet.
Returns column-level statistics suitable for a generic report.
"""

from __future__ import annotations

import polars as pl


def analyze_generic(df: pl.DataFrame) -> dict:
    """
    Build a structural profile of any DataFrame.

    Returns:
        total_rows        - row count
        total_columns     - column count
        columns_profile   - per-column stats list
        numeric_summary   - basic stats for numeric columns
        empty_columns     - columns where all values are null/empty
        duplicate_rows    - approximate count of fully duplicated rows
    """
    total_rows = len(df)
    total_cols = len(df.columns)

    columns_profile: list[dict] = []
    numeric_summary: dict[str, dict] = {}
    empty_columns: list[str] = []

    for col in df.columns:
        series = df[col]
        dtype  = str(series.dtype)
        null_count = series.is_null().sum()
        non_null   = total_rows - int(null_count)

        # Unique count (cast to string to handle any type)
        try:
            unique_count = series.cast(pl.Utf8).n_unique()
        except Exception:
            unique_count = 0

        # Sample non-null values (up to 3)
        try:
            sample = (
                series.drop_nulls()
                .cast(pl.Utf8)
                .head(3)
                .to_list()
            )
        except Exception:
            sample = []

        profile: dict = {
            "name":        col,
            "dtype":       dtype,
            "non_null":    non_null,
            "null_count":  int(null_count),
            "null_pct":    round(int(null_count) / total_rows * 100, 1) if total_rows else 0.0,
            "unique":      int(unique_count),
            "sample":      sample,
        }
        columns_profile.append(profile)

        if non_null == 0:
            empty_columns.append(col)

        # Numeric stats
        if series.dtype in (pl.Int8, pl.Int16, pl.Int32, pl.Int64,
                            pl.UInt8, pl.UInt16, pl.UInt32, pl.UInt64,
                            pl.Float32, pl.Float64):
            try:
                numeric_summary[col] = {
                    "min":  series.min(),
                    "max":  series.max(),
                    "mean": round(float(series.mean() or 0), 2),
                    "sum":  series.sum(),
                }
            except Exception:
                pass

    # Duplicate rows (cast all to string and check)
    try:
        dup_count = int(total_rows - df.cast({c: pl.Utf8 for c in df.columns}).unique().height)
    except Exception:
        dup_count = 0

    return {
        "total_rows":      total_rows,
        "total_columns":   total_cols,
        "columns_profile": columns_profile,
        "numeric_summary": numeric_summary,
        "empty_columns":   empty_columns,
        "duplicate_rows":  dup_count,
    }
