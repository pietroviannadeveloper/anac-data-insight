"""Lookup helpers for the institutional data dictionary.

Never rewrites ingested data automatically — only resolves a raw value to its
canonical form for callers (e.g. the quality validator) that want to flag
divergences as warnings/suggestions.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.dictionary import DictionaryEntry


def normalize(category: str, raw_value: str, db: Session) -> str | None:
    """Return the canonical value for `raw_value` in `category`, or None if unknown."""
    if not raw_value:
        return None
    needle = raw_value.strip().casefold()
    entries = db.query(DictionaryEntry).filter(
        DictionaryEntry.category == category,
        DictionaryEntry.active == 1,
    ).all()
    for entry in entries:
        if entry.canonical_value.strip().casefold() == needle:
            return entry.canonical_value
        for alias in entry.aliases or []:
            if alias.strip().casefold() == needle:
                return entry.canonical_value
    return None
