"""
Alert Checker Service
=====================
Evaluates active AlertRules against a completed analysis and creates AlertEvent
records for any triggered rules. Optionally sends email to all users who have
an email configured.
"""

from __future__ import annotations

import logging

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

_OPERATORS = {
    "lt":  lambda v, t: v < t,
    "gt":  lambda v, t: v > t,
    "lte": lambda v, t: v <= t,
    "gte": lambda v, t: v >= t,
    "eq":  lambda v, t: v == t,
}


async def check_and_fire(
    analysis_id: str,
    detected_type: str,
    original_filename: str,
    indicators: dict | None,
    db: Session,
    base_url: str = "http://localhost:3000",
) -> list[dict]:
    """
    Check all enabled AlertRules against the given analysis indicators.
    Creates AlertEvent rows for each triggered rule and sends email notifications.

    Returns list of triggered rule dicts.
    """
    from app.models.analysis import AlertRule, AlertEvent
    from app.models.user import User
    from app.services.email_service import send_email, alert_fired_html

    if not indicators:
        return []

    rules = db.query(AlertRule).filter(AlertRule.enabled == 1).all()
    triggered: list[dict] = []

    for rule in rules:
        # Check if rule applies to this analysis type
        applies_to = rule.analysis_types or []
        if applies_to and detected_type not in applies_to:
            continue

        raw_val = indicators.get(rule.metric)
        if raw_val is None:
            continue

        try:
            val = float(raw_val)
            thr = float(rule.threshold)
        except (TypeError, ValueError):
            continue

        op_fn = _OPERATORS.get(rule.operator)
        if not op_fn:
            continue

        if op_fn(val, thr):
            event = AlertEvent(
                analysis_id=analysis_id,
                rule_id=rule.id,
                rule_label=rule.label,
                metric=rule.metric,
                triggered_value=int(val),
                threshold=int(thr),
                operator=rule.operator,
            )
            db.add(event)
            triggered.append({
                "rule_id": rule.id,
                "label": rule.label,
                "metric": rule.metric,
                "operator": rule.operator,
                "threshold": int(thr),
                "triggered_value": int(val),
            })

    if triggered:
        db.commit()

        # Send email to all users with an email configured
        emails = [
            u.email for u in db.query(User).filter(
                User.email.isnot(None),
                User.email != "",
                User.is_active == True,
            ).all()
        ]
        if emails:
            analysis_url = f"{base_url}/analises/{analysis_id}"
            for t in triggered:
                html = alert_fired_html(
                    filename=original_filename,
                    rule_label=t["label"],
                    metric=t["metric"],
                    operator=t["operator"],
                    threshold=t["threshold"],
                    triggered_value=t["triggered_value"],
                    analysis_url=analysis_url,
                )
                try:
                    await send_email(
                        to=emails,
                        subject=f"[ANAC Data Insight] Alerta: {t['label']}",
                        html=html,
                    )
                except Exception as exc:
                    logger.warning("Email de alerta não enviado: %s", exc)

    return triggered
