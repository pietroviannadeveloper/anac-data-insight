"""
Email Service
=============
Sends emails via SMTP using Python's built-in smtplib.
All functions are safe to call even when SMTP is not configured —
they simply log a warning and return without raising.
"""

from __future__ import annotations

import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from pathlib import Path

logger = logging.getLogger(__name__)


def _is_configured() -> bool:
    from app.core.config import settings
    return bool(settings.smtp_host and settings.smtp_user and settings.smtp_from)


def _send_sync(
    to: list[str],
    subject: str,
    html: str,
    attachment_path: str | None = None,
    attachment_name: str | None = None,
) -> None:
    from app.core.config import settings
    if not _is_configured():
        logger.debug("SMTP não configurado — email ignorado para: %s", to)
        return

    msg = MIMEMultipart("mixed")
    msg["From"]    = settings.smtp_from
    msg["To"]      = ", ".join(to)
    msg["Subject"] = subject
    msg.attach(MIMEText(html, "html", "utf-8"))

    if attachment_path and Path(attachment_path).exists():
        name = attachment_name or Path(attachment_path).name
        with open(attachment_path, "rb") as f:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(f.read())
        encoders.encode_base64(part)
        part.add_header("Content-Disposition", f'attachment; filename="{name}"')
        msg.attach(part)

    try:
        if settings.smtp_tls:
            server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15)
            server.ehlo()
            server.starttls()
        else:
            server = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=15)

        if settings.smtp_user and settings.smtp_password:
            server.login(settings.smtp_user, settings.smtp_password)

        server.sendmail(settings.smtp_from, to, msg.as_string())
        server.quit()
        logger.info("Email enviado para %s — assunto: %s", to, subject)
    except Exception as exc:
        logger.warning("Falha ao enviar email: %s", exc)


async def send_email(
    to: list[str],
    subject: str,
    html: str,
    attachment_path: str | None = None,
    attachment_name: str | None = None,
) -> None:
    """Async wrapper — runs SMTP in a thread pool so the event loop is not blocked."""
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(
        None,
        lambda: _send_sync(to, subject, html, attachment_path, attachment_name),
    )


def analysis_completed_html(
    filename: str,
    detected_type: str,
    total_rows: int,
    indicators: dict | None,
    analysis_url: str,
) -> str:
    taxa = ""
    pendencias = ""
    if indicators:
        t = indicators.get("taxa_execucao")
        p = indicators.get("pendencias_criticas")
        if t is not None:
            taxa = f"<p style='margin:4px 0'>Taxa de execução: <strong>{t}%</strong></p>"
        if p is not None:
            pendencias = f"<p style='margin:4px 0'>Pendências críticas: <strong>{p}</strong></p>"

    tipo_map = {"ciclos": "Ciclos de Fiscalização", "pdf": "Documento PDF", "generic": "Planilha Genérica"}
    tipo_label = tipo_map.get(detected_type, detected_type)

    return f"""
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f6f8;padding:32px">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
  <div style="background:#003A70;padding:24px 32px">
    <h2 style="color:#fff;margin:0;font-size:18px">ANAC Data Insight</h2>
    <p style="color:#93c5fd;margin:4px 0 0;font-size:13px">Análise concluída</p>
  </div>
  <div style="padding:24px 32px">
    <h3 style="color:#1e293b;margin:0 0 12px">{filename}</h3>
    <p style="color:#64748b;margin:0 0 4px;font-size:13px">Tipo: {tipo_label}</p>
    <p style="color:#64748b;margin:0 0 16px;font-size:13px">Registros: {total_rows:,}</p>
    {taxa}{pendencias}
    <a href="{analysis_url}" style="display:inline-block;margin-top:20px;background:#003A70;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px">
      Ver análise completa →
    </a>
  </div>
  <div style="padding:16px 32px;background:#f8fafc;font-size:11px;color:#94a3b8">
    Enviado automaticamente pelo ANAC Data Insight.
  </div>
</div></body></html>"""


def alert_fired_html(
    filename: str,
    rule_label: str,
    metric: str,
    operator: str,
    threshold: int,
    triggered_value: int,
    analysis_url: str,
) -> str:
    op_labels = {"lt": "<", "gt": ">", "lte": "≤", "gte": "≥", "eq": "="}
    op_label = op_labels.get(operator, operator)
    return f"""
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f6f8;padding:32px">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
  <div style="background:#dc2626;padding:24px 32px">
    <h2 style="color:#fff;margin:0;font-size:18px">⚠ Alerta disparado</h2>
    <p style="color:#fca5a5;margin:4px 0 0;font-size:13px">ANAC Data Insight</p>
  </div>
  <div style="padding:24px 32px">
    <h3 style="color:#1e293b;margin:0 0 8px">{rule_label}</h3>
    <p style="color:#64748b;margin:0 0 4px;font-size:13px">Arquivo: <strong>{filename}</strong></p>
    <p style="color:#64748b;margin:0 0 4px;font-size:13px">Métrica: <strong>{metric}</strong></p>
    <p style="color:#64748b;margin:0 0 16px;font-size:13px">
      Regra: {metric} {op_label} {threshold} — valor encontrado: <strong style="color:#dc2626">{triggered_value}</strong>
    </p>
    <a href="{analysis_url}" style="display:inline-block;margin-top:4px;background:#003A70;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px">
      Ver análise →
    </a>
  </div>
</div></body></html>"""
