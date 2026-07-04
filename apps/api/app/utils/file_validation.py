"""
Validação de arquivos por magic bytes — não confia só na extensão.
"""

from __future__ import annotations

ALLOWED_SIGNATURES: dict[str, list[bytes]] = {
    # Excel moderno (.xlsx) — PK zip
    ".xlsx": [b"PK\x03\x04"],
    # Excel legado (.xls) — Compound Document
    ".xls":  [b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"],
    # CSV — texto puro (sem assinatura, qualquer byte ASCII/UTF imprimível é aceito)
    ".csv":  [],
    # PDF
    ".pdf":  [b"%PDF"],
}

ALLOWED_EXTENSIONS = set(ALLOWED_SIGNATURES.keys())


def validate_file_bytes(filename: str, data: bytes) -> tuple[bool, str]:
    """
    Retorna (True, "") se o arquivo é válido.
    Retorna (False, motivo) se for inválido.
    """
    if not filename:
        return False, "Nome de arquivo ausente."

    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        return False, f"Extensão '{ext}' não permitida. Use: {', '.join(sorted(ALLOWED_EXTENSIONS))}"

    # CSV não tem assinatura binária — aceitar qualquer conteúdo não-vazio
    if ext == ".csv":
        if not data:
            return False, "Arquivo CSV vazio."
        return True, ""

    # Para binários, verificar magic bytes
    sigs = ALLOWED_SIGNATURES[ext]
    if sigs:
        for sig in sigs:
            if data[: len(sig)] == sig:
                return True, ""
        return (
            False,
            f"O arquivo '{filename}' não corresponde ao formato esperado ({ext}). "
            "Verifique se o arquivo não está corrompido ou foi renomeado.",
        )

    return True, ""
