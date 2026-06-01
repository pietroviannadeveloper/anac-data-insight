"""
PDF Reader Service
==================
Extracts text and metadata from PDF files using pypdf (pure Python).
"""

from __future__ import annotations

from pathlib import Path


def extract_pdf(path: Path) -> dict:
    """
    Extract text and metadata from a PDF file.

    Returns a dict with:
        pages       - number of pages
        word_count  - total word count
        char_count  - total character count
        text        - full extracted text (truncated to 50k chars)
        pages_text  - list of per-page text (up to 20 pages)
        title       - document title from metadata (if any)
        author      - document author from metadata (if any)
    """
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    num_pages = len(reader.pages)

    meta = reader.metadata or {}
    title  = str(meta.get("/Title",  "") or "").strip() or None
    author = str(meta.get("/Author", "") or "").strip() or None

    pages_text: list[str] = []
    for page in reader.pages[:20]:
        try:
            text = page.extract_text() or ""
        except Exception:
            text = ""
        pages_text.append(text.strip())

    full_text = "\n\n".join(pages_text)
    word_count = len(full_text.split())
    char_count = len(full_text)

    return {
        "pages":      num_pages,
        "word_count": word_count,
        "char_count": char_count,
        "text":       full_text[:50_000],
        "pages_text": pages_text,
        "title":      title,
        "author":     author,
    }


def summarize_pdf_indicators(extracted: dict) -> dict:
    """
    Build a flat indicators dict suitable for storage in Analysis.indicators.
    Does NOT include the raw text to avoid bloating the JSON column.
    """
    return {
        "pages":      extracted["pages"],
        "word_count": extracted["word_count"],
        "char_count": extracted["char_count"],
        "title":      extracted["title"],
        "author":     extracted["author"],
        "text_preview": extracted["text"][:4000] if extracted["text"] else None,
    }
