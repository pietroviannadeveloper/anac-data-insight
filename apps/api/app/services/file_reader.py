"""
File reading service.

Handles CSV (any separator, any common encoding) and Excel (.xlsx / .xls).
Normalises the content to UTF-8 before passing to Polars so accented
characters and semicolon-delimited Brazilian spreadsheets work correctly.
"""

import io
from pathlib import Path

import polars as pl

ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls"}

# Treated as "empty" when reading CSVs
_NULL_VALUES = ["N/A", "NA", "n/a", "na", "NULL", "null", "Null", "#N/A", "#NA", ""]

# Encoding candidates tried in order (most common Brazilian spreadsheets)
_ENCODINGS = ("utf-8-sig", "utf-8", "latin-1", "cp1252", "iso-8859-1")


def _decode(raw: bytes) -> tuple[str, str]:
    """Decode raw bytes using the first encoding that succeeds."""
    for enc in _ENCODINGS:
        try:
            return raw.decode(enc), enc
        except (UnicodeDecodeError, LookupError):
            continue
    # Last resort: latin-1 never raises but may produce garbled text
    return raw.decode("latin-1", errors="replace"), "latin-1-fallback"


def _detect_separator(first_line: str) -> str:
    """Pick the delimiter that appears most in the header line."""
    counts = {sep: first_line.count(sep) for sep in (";", "\t", ",")}
    return max(counts, key=counts.get)  # type: ignore[arg-type]


def read_file(file_path: Path) -> pl.DataFrame:
    """Read a CSV or Excel file into a Polars DataFrame.

    Automatically detects:
    - CSV encoding (UTF-8, Latin-1, CP-1252, …)
    - CSV delimiter (, ; or tab)
    - Null value placeholders (N/A, NA, null, …)
    """
    suffix = file_path.suffix.lower()

    if suffix == ".csv":
        raw = file_path.read_bytes()
        text, _enc = _decode(raw)

        first_line = text.split("\n")[0]
        sep = _detect_separator(first_line)

        # Re-encode as UTF-8 so Polars always receives clean text
        utf8_bytes = text.encode("utf-8")

        return pl.read_csv(
            io.BytesIO(utf8_bytes),
            separator=sep,
            infer_schema_length=1000,
            ignore_errors=True,
            truncate_ragged_lines=True,
            null_values=_NULL_VALUES,
        )

    if suffix in {".xlsx", ".xls"}:
        # openpyxl / xlrd handle encoding internally
        return pl.read_excel(file_path, engine="openpyxl" if suffix == ".xlsx" else "xlsx2csv")

    raise ValueError(f"Formato não suportado: {suffix}")


def get_preview(df: pl.DataFrame, n: int = 5) -> dict:
    """Return the first n rows as a serialisable dict."""
    return {
        "columns": df.columns,
        "dtypes": [str(d) for d in df.dtypes],
        "rows": df.head(n).to_dicts(),
        "total_rows": len(df),
        "total_columns": len(df.columns),
    }
