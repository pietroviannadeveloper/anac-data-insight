import re
import uuid
from pathlib import Path


def sanitize_filename(filename: str) -> str:
    """
    Sanitize a filename by:
    - Extracting stem and extension separately
    - Replacing non-word characters with underscores in the stem
    - Truncating stem to 100 characters
    - Prepending an 8-char UUID hex prefix for uniqueness
    """
    name = Path(filename).stem
    ext = Path(filename).suffix.lower()
    name = re.sub(r"[^\w\-]", "_", name)
    name = name[:100]
    return f"{uuid.uuid4().hex[:8]}_{name}{ext}"
