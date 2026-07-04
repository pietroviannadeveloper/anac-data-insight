"""Tests for utils/file_validation.py."""
from app.utils.file_validation import validate_file_bytes


def test_csv_valid():
    ok, msg = validate_file_bytes("data.csv", b"col1,col2\nval1,val2")
    assert ok is True
    assert msg == ""


def test_csv_empty():
    ok, msg = validate_file_bytes("data.csv", b"")
    assert ok is False
    assert "vazio" in msg.lower()


def test_xlsx_valid_magic():
    ok, msg = validate_file_bytes("report.xlsx", b"PK\x03\x04" + b"\x00" * 10)
    assert ok is True


def test_xlsx_invalid_magic():
    ok, msg = validate_file_bytes("report.xlsx", b"NOTPK" + b"\x00" * 10)
    assert ok is False
    assert ".xlsx" in msg


def test_xls_valid_magic():
    ok, msg = validate_file_bytes("legacy.xls", b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + b"\x00" * 8)
    assert ok is True


def test_xls_invalid_magic():
    ok, msg = validate_file_bytes("legacy.xls", b"GARBAGE" + b"\x00" * 8)
    assert ok is False


def test_pdf_valid_magic():
    ok, msg = validate_file_bytes("doc.pdf", b"%PDF-1.4")
    assert ok is True


def test_pdf_invalid_magic():
    ok, msg = validate_file_bytes("doc.pdf", b"NOT_PDF")
    assert ok is False


def test_no_filename():
    ok, msg = validate_file_bytes("", b"data")
    assert ok is False
    assert "ausente" in msg.lower()


def test_disallowed_extension():
    ok, msg = validate_file_bytes("script.exe", b"MZ")
    assert ok is False
    assert "não permitida" in msg.lower()


def test_no_extension():
    ok, msg = validate_file_bytes("nodotfile", b"data")
    assert ok is False
