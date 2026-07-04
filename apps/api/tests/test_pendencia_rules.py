"""Tests for app/services/pendencia_rules.py."""
from app.models.analysis import CicloActivity
from app.services.pendencia_rules import classify_severity, describe, is_pendencia


def _activity(**overrides) -> CicloActivity:
    defaults = dict(
        status="realizado", sem_giaso=0, sem_pcdp=0, sem_processo=0, local_indefinido=0,
    )
    defaults.update(overrides)
    return CicloActivity(**defaults)


def test_is_pendencia_false_when_clean():
    assert is_pendencia(_activity()) is False


def test_is_pendencia_true_for_single_flag():
    assert is_pendencia(_activity(sem_giaso=1)) is True


def test_is_pendencia_true_for_sem_agendamento():
    assert is_pendencia(_activity(status="sem-agendamento")) is True


def test_severity_baixa_when_clean():
    assert classify_severity(_activity()) == "baixa"


def test_severity_media_for_one_flag():
    assert classify_severity(_activity(sem_giaso=1)) == "media"


def test_severity_alta_for_two_flags():
    assert classify_severity(_activity(sem_giaso=1, sem_pcdp=1)) == "alta"


def test_severity_alta_for_sem_agendamento_alone():
    assert classify_severity(_activity(status="sem-agendamento")) == "alta"


def test_severity_critica_for_three_flags():
    assert classify_severity(_activity(sem_giaso=1, sem_pcdp=1, sem_processo=1)) == "critica"


def test_severity_critica_for_sem_agendamento_plus_two_flags():
    assert classify_severity(_activity(status="sem-agendamento", sem_giaso=1, sem_pcdp=1)) == "critica"


def test_describe_mentions_active_flags():
    motivo, recomendacao = describe(_activity(sem_giaso=1, sem_pcdp=1))
    assert "GIASO" in motivo
    assert "PCDP" in motivo
    assert "GIASO" in recomendacao
    assert "PCDP" in recomendacao


def test_describe_mentions_sem_agendamento():
    motivo, recomendacao = describe(_activity(status="sem-agendamento"))
    assert "agendamento" in motivo
    assert "Agendar" in recomendacao
