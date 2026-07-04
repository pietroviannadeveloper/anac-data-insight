"""Data quality validation run on uploaded spreadsheets before persisting an Analysis.

Separates findings into blocking `errors` (upload is rejected unless the
caller passes `force=true`) and non-blocking `warnings`/`suggestions` (the
analysis proceeds normally, the report is just stored alongside it).
"""
from __future__ import annotations

import polars as pl
from sqlalchemy.orm import Session

from app.services.classifier import normalize_col
from app.services.dictionary_lookup import normalize as dict_normalize

_REQUIRED_GROUPS_CICLOS = {
    "atividade": ["atividade", "atv", "acao", "inspecao", "auditoria", "vistoria", "fiscaliz"],
    "gerencia": ["gerencia", "gerente", "setor", "unidade", "divisao", "area"],
    "cidade": ["cidade", "local", "municipio", "aeroporto", "aerodro"],
}
_MES_SUBSTRINGS = ["mes", "periodo", "competencia", "ciclo"]

_EMPTY_VALUES = {"", "indefinido", "a definir", "-", "n/a", "none", "nan"}


def _find_col(df: pl.DataFrame, substrings: list[str]) -> str | None:
    for col in df.columns:
        col_norm = normalize_col(col)
        if any(s in col_norm for s in substrings):
            return col
    return None


def _is_empty(val) -> bool:
    if val is None:
        return True
    return str(val).strip().lower() in _EMPTY_VALUES


def validate_quality(df: pl.DataFrame, detected_type: str, db: Session) -> dict:
    """Run quality checks for `df` and return a report dict.

    `errors` are blocking; `warnings`/`suggestions` are informational only.
    """
    errors: list[dict] = []
    warnings: list[dict] = []
    suggestions: list[str] = []
    total = len(df)

    if total == 0:
        errors.append({"code": "empty_file", "message": "A planilha não contém nenhuma linha de dados."})
        return _build_report(errors, warnings, suggestions, total)

    if detected_type == "ciclos":
        _validate_ciclos(df, db, errors, warnings, suggestions, total)
    else:
        _validate_generic(df, warnings, total)

    return _build_report(errors, warnings, suggestions, total)


def _validate_ciclos(df: pl.DataFrame, db: Session, errors: list[dict], warnings: list[dict],
                      suggestions: list[str], total: int) -> None:
    cols = {name: _find_col(df, subs) for name, subs in _REQUIRED_GROUPS_CICLOS.items()}
    missing = [name for name, col in cols.items() if col is None]
    if missing:
        errors.append({
            "code": "missing_required_columns",
            "message": f"Colunas obrigatórias ausentes: {', '.join(missing)}.",
        })
        return  # row-level checks need the identification columns

    item_col = cols["atividade"]
    cidade_col = cols["cidade"]
    gerencia_col = cols["gerencia"]
    mes_col = _find_col(df, _MES_SUBSTRINGS)

    empty_counts = {name: 0 for name in cols}
    seen_keys: dict[tuple, int] = {}
    cidade_values: set[str] = set()
    gerencia_values: set[str] = set()

    for i in range(total):
        for name, col in cols.items():
            if _is_empty(df[col][i]):
                empty_counts[name] += 1

        cidade_val = df[cidade_col][i]
        gerencia_val = df[gerencia_col][i]
        if not _is_empty(cidade_val):
            cidade_values.add(str(cidade_val).strip())
        if not _is_empty(gerencia_val):
            gerencia_values.add(str(gerencia_val).strip())

        key = (
            str(df[item_col][i]).strip().lower() if not _is_empty(df[item_col][i]) else "",
            str(cidade_val).strip().lower() if not _is_empty(cidade_val) else "",
            str(df[mes_col][i]).strip().lower() if mes_col and not _is_empty(df[mes_col][i]) else "",
        )
        seen_keys[key] = seen_keys.get(key, 0) + 1

    for name, count in empty_counts.items():
        if count > 0:
            warnings.append({
                "code": "empty_required_field",
                "message": f"{count} linha(s) com '{name}' não preenchido.",
                "affected_rows": count,
            })

    duplicate_count = sum(c - 1 for c in seen_keys.values() if c > 1)
    if duplicate_count > 0:
        warnings.append({
            "code": "duplicate_activities",
            "message": f"{duplicate_count} linha(s) com atividade/cidade/mês duplicados.",
            "affected_rows": duplicate_count,
        })

    _check_dictionary_divergence(db, "cidade", cidade_values, warnings, suggestions)
    _check_dictionary_divergence(db, "gerencia", gerencia_values, warnings, suggestions)


def _check_dictionary_divergence(db: Session, category: str, values: set[str],
                                  warnings: list[dict], suggestions: list[str]) -> None:
    from app.models.dictionary import DictionaryEntry

    has_entries = db.query(DictionaryEntry).filter(
        DictionaryEntry.category == category, DictionaryEntry.active == 1,
    ).first() is not None
    if not has_entries:
        return  # nothing to compare against yet — don't warn on an empty dictionary

    unknown = sorted(v for v in values if dict_normalize(category, v, db) is None)
    if unknown:
        preview = ", ".join(unknown[:5]) + ("..." if len(unknown) > 5 else "")
        warnings.append({
            "code": f"unknown_{category}",
            "message": f"{len(unknown)} valor(es) de {category} não cadastrados no dicionário de dados: {preview}.",
            "affected_rows": len(unknown),
        })
        suggestions.append(
            f"Cadastre os valores de {category} divergentes no Dicionário de Dados (em /admin) ou corrija a planilha."
        )


def _validate_generic(df: pl.DataFrame, warnings: list[dict], total: int) -> None:
    duplicate_count = total - len(df.unique())
    if duplicate_count > 0:
        warnings.append({
            "code": "duplicate_rows",
            "message": f"{duplicate_count} linha(s) totalmente duplicada(s).",
            "affected_rows": duplicate_count,
        })


def _build_report(errors: list[dict], warnings: list[dict], suggestions: list[str], total_rows: int) -> dict:
    score = max(0, 100 - 20 * len(errors) - 5 * len(warnings))
    return {
        "score": score,
        "errors": errors,
        "warnings": warnings,
        "suggestions": suggestions,
        "total_rows": total_rows,
    }
