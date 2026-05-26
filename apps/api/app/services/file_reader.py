import polars as pl
from pathlib import Path

ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls"}


def _detect_separator(file_path: Path) -> str:
    """Detect CSV separator by reading the first line and counting delimiters."""
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        first_line = f.readline()
    counts = {sep: first_line.count(sep) for sep in (";", "\t", ",")}
    return max(counts, key=counts.get)  # type: ignore[arg-type]


def read_file(file_path: Path) -> pl.DataFrame:
    """Read CSV or Excel file into a Polars DataFrame."""
    suffix = file_path.suffix.lower()
    if suffix == ".csv":
        sep = _detect_separator(file_path)
        return pl.read_csv(
            file_path,
            separator=sep,
            infer_schema_length=1000,
            ignore_errors=True,
            truncate_ragged_lines=True,
        )
    elif suffix in {".xlsx", ".xls"}:
        return pl.read_excel(file_path)
    raise ValueError(f"Unsupported file type: {suffix}")


def get_preview(df: pl.DataFrame, n: int = 5) -> dict:
    """Return first n rows as dict for preview."""
    return {
        "columns": df.columns,
        "dtypes": [str(d) for d in df.dtypes],
        "rows": df.head(n).to_dicts(),
        "total_rows": len(df),
        "total_columns": len(df.columns),
    }
