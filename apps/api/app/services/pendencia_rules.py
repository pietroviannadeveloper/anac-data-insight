"""Severity classification and human-readable motivo/recomendação for pendências.

A pendência is tracked when an activity (CicloActivity or PTAMensalActivity —
both share the same flag/status attribute names) is missing GIASO, PCDP,
processo, has an undefined location, or has no scheduling at all.
"""
from __future__ import annotations

from typing import Any

_FLAG_LABELS: dict[str, str] = {
    "sem_giaso": "sem GIASO",
    "sem_pcdp": "sem PCDP",
    "sem_processo": "sem processo",
    "local_indefinido": "com local indefinido",
}

_FLAG_RECOMMENDATIONS: dict[str, str] = {
    "sem_giaso": "Regularizar o GIASO da atividade",
    "sem_pcdp": "Emitir ou vincular o PCDP correspondente",
    "sem_processo": "Abrir ou vincular o processo correspondente",
    "local_indefinido": "Definir a cidade/local da atividade",
}


def is_pendencia(activity: Any) -> bool:
    """Whether this activity qualifies for pendência tracking."""
    return bool(
        activity.sem_giaso or activity.sem_pcdp or activity.sem_processo
        or activity.local_indefinido or activity.status == "sem-agendamento"
    )


def _active_flags(activity: Any) -> list[str]:
    return [flag for flag in _FLAG_LABELS if getattr(activity, flag, 0)]


def classify_severity(activity: Any) -> str:
    flags = _active_flags(activity)
    sem_agendamento = activity.status == "sem-agendamento"

    if len(flags) >= 3 or (sem_agendamento and len(flags) >= 2):
        return "critica"
    if len(flags) == 2 or sem_agendamento:
        return "alta"
    if len(flags) == 1:
        return "media"
    return "baixa"


def describe(activity: Any) -> tuple[str, str]:
    """Return (motivo, recomendacao) describing why this activity is a pendência."""
    flags = _active_flags(activity)
    parts = [_FLAG_LABELS[f] for f in flags]
    if activity.status == "sem-agendamento":
        parts.append("sem agendamento")

    motivo = "Atividade " + " e ".join(parts) + "." if parts else "Atividade pendente de tratamento."

    recommendations = [_FLAG_RECOMMENDATIONS[f] for f in flags]
    if activity.status == "sem-agendamento":
        recommendations.append("Agendar a atividade")
    recomendacao = "; ".join(recommendations) + "." if recommendations else "Revisar a atividade."

    return motivo, recomendacao
