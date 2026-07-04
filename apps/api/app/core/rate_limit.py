"""
Rate limiting via FastAPI Depends — compatível com Python 3.9 + FastAPI 0.111.
Usa um dicionário em memória simples (adequado para processo único).
Em produção com múltiplos workers, substituir por Redis.
"""

from __future__ import annotations

import time
from collections import defaultdict
from threading import Lock
from typing import Callable

from fastapi import HTTPException, Request


class _InMemoryRateLimiter:
    """Sliding window rate limiter em memória."""

    def __init__(self) -> None:
        self._store: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()

    def is_allowed(self, key: str, max_requests: int, window_seconds: int) -> bool:
        now = time.monotonic()
        cutoff = now - window_seconds
        with self._lock:
            calls = self._store[key]
            # remove chamadas fora da janela
            self._store[key] = [t for t in calls if t > cutoff]
            if len(self._store[key]) >= max_requests:
                return False
            self._store[key].append(now)
            return True


_limiter = _InMemoryRateLimiter()


def rate_limit(max_requests: int, window_seconds: int = 60) -> Callable:
    """
    Dependência FastAPI que bloqueia quando o IP ultrapassa o limite.

    Uso:
        @router.post("/rota")
        async def handler(_: None = Depends(rate_limit(5, 60))):
            ...
    """

    async def dependency(request: Request) -> None:
        ip = request.client.host if request.client else "unknown"
        path = request.url.path
        key = f"{ip}:{path}"
        if not _limiter.is_allowed(key, max_requests, window_seconds):
            raise HTTPException(
                status_code=429,
                detail=f"Muitas requisições. Aguarde e tente novamente.",
                headers={"Retry-After": str(window_seconds)},
            )

    return dependency
