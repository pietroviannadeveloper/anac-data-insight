"""
PDF Report Service
==================
Generates an executive PDF report for a completed ciclos analysis.
Uses reportlab (pure Python, no system dependencies).
"""

from __future__ import annotations

import io
import textwrap
from datetime import datetime
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, PageBreak,
    Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY

# ── ANAC brand colours ────────────────────────────────────────────────────────
ANAC_BLUE   = colors.HexColor("#003A70")
ANAC_LIGHT  = colors.HexColor("#1a5fa8")
ANAC_ACCENT = colors.HexColor("#0077cc")
GREY_DARK   = colors.HexColor("#1e293b")
GREY_MID    = colors.HexColor("#475569")
GREY_LIGHT  = colors.HexColor("#f1f5f9")
RED_SOFT    = colors.HexColor("#dc2626")
AMBER_SOFT  = colors.HexColor("#d97706")
GREEN_SOFT  = colors.HexColor("#16a34a")
WHITE       = colors.white

PAGE_W, PAGE_H = A4
MARGIN = 2 * cm


# ── Styles ────────────────────────────────────────────────────────────────────
def _make_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "cover_title": ParagraphStyle("cover_title", fontSize=22, leading=28,
            textColor=WHITE, alignment=TA_CENTER, fontName="Helvetica-Bold"),
        "cover_sub": ParagraphStyle("cover_sub", fontSize=12, leading=16,
            textColor=colors.HexColor("#93c5fd"), alignment=TA_CENTER),
        "cover_meta": ParagraphStyle("cover_meta", fontSize=9, leading=13,
            textColor=colors.HexColor("#cbd5e1"), alignment=TA_CENTER),
        "section": ParagraphStyle("section", fontSize=13, leading=17,
            textColor=ANAC_BLUE, fontName="Helvetica-Bold", spaceAfter=6),
        "body": ParagraphStyle("body", fontSize=9, leading=13,
            textColor=GREY_DARK, alignment=TA_JUSTIFY, spaceAfter=4),
        "body_small": ParagraphStyle("body_small", fontSize=8, leading=12,
            textColor=GREY_MID),
        "label": ParagraphStyle("label", fontSize=8, leading=11,
            textColor=GREY_MID, fontName="Helvetica-Bold"),
        "value_big": ParagraphStyle("value_big", fontSize=20, leading=24,
            textColor=ANAC_BLUE, fontName="Helvetica-Bold", alignment=TA_CENTER),
        "value_label": ParagraphStyle("value_label", fontSize=7.5, leading=10,
            textColor=GREY_MID, alignment=TA_CENTER),
        "alert_error": ParagraphStyle("alert_error", fontSize=8.5, leading=12,
            textColor=RED_SOFT, fontName="Helvetica-Bold"),
        "alert_warn": ParagraphStyle("alert_warn", fontSize=8.5, leading=12,
            textColor=AMBER_SOFT, fontName="Helvetica-Bold"),
        "alert_info": ParagraphStyle("alert_info", fontSize=8.5, leading=12,
            textColor=ANAC_ACCENT, fontName="Helvetica-Bold"),
        "alert_body": ParagraphStyle("alert_body", fontSize=8, leading=12,
            textColor=GREY_DARK),
        "ia_text": ParagraphStyle("ia_text", fontSize=9, leading=14,
            textColor=GREY_DARK, alignment=TA_JUSTIFY, spaceAfter=6),
        "bullet": ParagraphStyle("bullet", fontSize=8.5, leading=13,
            textColor=GREY_DARK, leftIndent=12, spaceAfter=3,
            bulletIndent=4, bulletFontName="Helvetica", bulletFontSize=9),
    }


# ── Page template ─────────────────────────────────────────────────────────────
def _header_footer(canvas, doc):
    canvas.saveState()
    if doc.page > 1:
        canvas.setFillColor(ANAC_BLUE)
        canvas.rect(0, PAGE_H - 1.1 * cm, PAGE_W, 1.1 * cm, fill=1, stroke=0)
        canvas.setFont("Helvetica-Bold", 8)
        canvas.setFillColor(WHITE)
        canvas.drawString(MARGIN, PAGE_H - 0.7 * cm, "ANAC — Relatório Executivo de Análise")
        canvas.drawRightString(PAGE_W - MARGIN, PAGE_H - 0.7 * cm,
                               f"Página {doc.page}")
        canvas.setStrokeColor(ANAC_LIGHT)
        canvas.setLineWidth(0.3)
        canvas.line(MARGIN, 1.3 * cm, PAGE_W - MARGIN, 1.3 * cm)
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(GREY_MID)
        canvas.drawString(MARGIN, 0.8 * cm,
                          "Documento gerado automaticamente pelo ANAC Data Insight")
    canvas.restoreState()


# ── Helper builders ───────────────────────────────────────────────────────────
def _hr(styles) -> HRFlowable:
    return HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e2e8f0"),
                      spaceAfter=8, spaceBefore=4)


def _section_title(text: str, styles: dict) -> list:
    return [Spacer(1, 0.3 * cm), Paragraph(text, styles["section"]), _hr(styles)]


def _kpi_table(kpis: list[tuple[str, str, str]], styles: dict) -> Table:
    """kpis = [(value, label, color_hex), ...]"""
    cell_w = (PAGE_W - 2 * MARGIN) / len(kpis)
    data = [[
        [Paragraph(v, styles["value_big"]), Paragraph(l, styles["value_label"])]
        for v, l, _ in kpis
    ]]
    tbl = Table(data, colWidths=[cell_w] * len(kpis), rowHeights=[2 * cm])
    tbl.setStyle(TableStyle([
        ("ALIGN",       (0, 0), (-1, -1), "CENTER"),
        ("VALIGN",      (0, 0), (-1, -1), "MIDDLE"),
        ("GRID",        (0, 0), (-1, -1), 0.3, colors.HexColor("#e2e8f0")),
        ("BACKGROUND",  (0, 0), (-1, -1), GREY_LIGHT),
        ("ROUNDEDCORNERS", [4]),
    ]))
    return tbl


def _indicators_table(ind: dict, styles: dict) -> Table:
    rows = [
        [Paragraph("Indicador", styles["label"]), Paragraph("Valor", styles["label"])],
        ["Total de atividades", str(ind.get("total_atividades", 0))],
        ["Realizadas", str(ind.get("realizadas", 0))],
        ["Agendadas", str(ind.get("agendadas", 0))],
        ["Sem agendamento", str(ind.get("sem_agendamento", 0))],
        ["Taxa de execução", f"{ind.get('taxa_execucao', 0):.1f}%"],
        ["Taxa de agendamento", f"{ind.get('taxa_agendamento', 0):.1f}%"],
        ["Sem GIASO", str(ind.get("sem_giaso", 0))],
        ["Sem PCDP", str(ind.get("sem_pcdp", 0))],
        ["Sem processo", str(ind.get("sem_processo", 0))],
        ["Locais indefinidos", str(ind.get("locais_indefinidos", 0))],
        ["PCDP duplicada", str(ind.get("pcdp_duplicada", 0))],
        ["Múltiplas PCDPs", str(ind.get("multiplas_pcdps", 0))],
        [Paragraph("Pendências críticas", styles["label"]),
         Paragraph(str(ind.get("pendencias_criticas", 0)), styles["label"])],
    ]
    col_w = [(PAGE_W - 2 * MARGIN) * 0.65, (PAGE_W - 2 * MARGIN) * 0.35]
    tbl = Table(rows, colWidths=col_w)
    tbl.setStyle(TableStyle([
        ("FONTNAME",    (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",    (0, 0), (-1, -1), 8.5),
        ("LEADING",     (0, 0), (-1, -1), 13),
        ("TEXTCOLOR",   (0, 0), (-1, 0), WHITE),
        ("BACKGROUND",  (0, 0), (-1, 0), ANAC_BLUE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [WHITE, GREY_LIGHT]),
        ("BACKGROUND",  (0, -1), (-1, -1), colors.HexColor("#fee2e2")),
        ("TEXTCOLOR",   (0, -1), (-1, -1), RED_SOFT),
        ("ALIGN",       (1, 0), (1, -1), "CENTER"),
        ("GRID",        (0, 0), (-1, -1), 0.3, colors.HexColor("#cbd5e1")),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING",  (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return tbl


def _by_type_table(by_type: dict, styles: dict) -> Table | None:
    if not by_type:
        return None
    LABELS = {
        "CICLO_BASE":       "Ciclo Base",
        "CICLO_DESEMPENHO": "Desempenho",
        "NAO_PROGRAMADA":   "Não Programadas",
        "INDEFINIDO":       "Indefinido",
    }
    header = [Paragraph(c, styles["label"]) for c in
              ["Tipo", "Total", "Realizadas", "Agendadas", "Sem Agend.", "Tx. Execução"]]
    rows = [header]
    for tipo, ind in by_type.items():
        rows.append([
            LABELS.get(tipo, tipo),
            str(ind.get("total_atividades", 0)),
            str(ind.get("realizadas", 0)),
            str(ind.get("agendadas", 0)),
            str(ind.get("sem_agendamento", 0)),
            f"{ind.get('taxa_execucao', 0):.1f}%",
        ])
    col_w_total = PAGE_W - 2 * MARGIN
    col_ws = [col_w_total * f for f in [0.28, 0.12, 0.14, 0.14, 0.16, 0.16]]
    tbl = Table(rows, colWidths=col_ws)
    tbl.setStyle(TableStyle([
        ("FONTNAME",    (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",    (0, 0), (-1, -1), 8.5),
        ("LEADING",     (0, 0), (-1, -1), 12),
        ("TEXTCOLOR",   (0, 0), (-1, 0), WHITE),
        ("BACKGROUND",  (0, 0), (-1, 0), ANAC_LIGHT),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, GREY_LIGHT]),
        ("ALIGN",       (1, 0), (-1, -1), "CENTER"),
        ("GRID",        (0, 0), (-1, -1), 0.3, colors.HexColor("#cbd5e1")),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING",  (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return tbl


# ── Cover page ────────────────────────────────────────────────────────────────
def _build_cover(filename: str, created_at: datetime | None,
                 total_rows: int, styles: dict) -> list:
    story = []
    story.append(Spacer(1, 3 * cm))

    # Blue banner
    banner_data = [[Paragraph("ANAC Data Insight", styles["cover_title"])]]
    banner = Table(banner_data,
                   colWidths=[PAGE_W - 2 * MARGIN],
                   rowHeights=[1.6 * cm])
    banner.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), ANAC_BLUE),
        ("ALIGN",      (0, 0), (-1, -1), "CENTER"),
        ("VALIGN",     (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 16),
        ("RIGHTPADDING", (0, 0), (-1, -1), 16),
    ]))
    story.append(banner)
    story.append(Spacer(1, 0.6 * cm))
    story.append(Paragraph("Relatório Executivo de Análise", styles["cover_sub"]))
    story.append(Spacer(1, 1.5 * cm))

    # File info box
    date_str = created_at.strftime("%d/%m/%Y %H:%M") if created_at else "—"
    info_data = [
        [Paragraph("Arquivo:", styles["label"]),
         Paragraph(filename, styles["body"])],
        [Paragraph("Data da análise:", styles["label"]),
         Paragraph(date_str, styles["body"])],
        [Paragraph("Total de registros:", styles["label"]),
         Paragraph(f"{total_rows:,}".replace(",", "."), styles["body"])],
    ]
    info_tbl = Table(info_data, colWidths=[(PAGE_W - 2 * MARGIN) * 0.35,
                                            (PAGE_W - 2 * MARGIN) * 0.65])
    info_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GREY_LIGHT),
        ("GRID",       (0, 0), (-1, -1), 0.3, colors.HexColor("#e2e8f0")),
        ("LEFTPADDING",  (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING",   (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 7),
    ]))
    story.append(info_tbl)
    story.append(Spacer(1, 2 * cm))

    generated = datetime.now().strftime("%d/%m/%Y às %H:%M")
    story.append(Paragraph(
        f"Gerado automaticamente em {generated}", styles["cover_meta"]))
    story.append(Paragraph(
        "Documento de uso interno — ANAC", styles["cover_meta"]))

    return story


# ── PDF-document body ─────────────────────────────────────────────────────────
def _build_pdf_doc_body(
    story: list,
    ind: dict,
    ai_summary: dict[str, Any] | None,
    styles: dict,
) -> None:
    """Build report body for a PDF-document analysis (not a ciclos spreadsheet)."""
    pages      = ind.get("pages", 0)
    word_count = ind.get("word_count", 0)
    char_count = ind.get("char_count", 0)
    title      = ind.get("title") or ""
    author     = ind.get("author") or ""
    preview    = ind.get("text_preview") or ""

    # KPI cards
    story.extend(_section_title("Informações do Documento", styles))
    kpis = [
        (str(pages),                          "Páginas",   ANAC_BLUE.hexval()),
        (f"{word_count:,}".replace(",", "."), "Palavras",  ANAC_LIGHT.hexval()),
        (f"{char_count:,}".replace(",", "."), "Caracteres", ANAC_ACCENT.hexval()),
    ]
    story.append(_kpi_table(kpis, styles))
    story.append(Spacer(1, 0.4 * cm))

    # Metadata table
    if title or author:
        story.extend(_section_title("Metadados", styles))
        meta_rows: list = []
        if title:
            meta_rows.append([Paragraph("Título", styles["label"]),
                               Paragraph(title, styles["body"])])
        if author:
            meta_rows.append([Paragraph("Autor", styles["label"]),
                               Paragraph(author, styles["body"])])
        col_w = [(PAGE_W - 2 * MARGIN) * 0.25, (PAGE_W - 2 * MARGIN) * 0.75]
        tbl = Table(meta_rows, colWidths=col_w)
        tbl.setStyle(TableStyle([
            ("FONTSIZE",    (0, 0), (-1, -1), 8.5),
            ("LEADING",     (0, 0), (-1, -1), 13),
            ("BACKGROUND",  (0, 0), (-1, -1), GREY_LIGHT),
            ("GRID",        (0, 0), (-1, -1), 0.3, colors.HexColor("#cbd5e1")),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING",  (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(tbl)
        story.append(Spacer(1, 0.4 * cm))

    # Text preview (first 800 chars)
    if preview:
        story.extend(_section_title("Prévia do Conteúdo", styles))
        excerpt = preview[:800].replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        story.append(Paragraph(excerpt + ("…" if len(preview) > 800 else ""), styles["body"]))
        story.append(Spacer(1, 0.4 * cm))

    # AI summary
    if ai_summary:
        resumo        = ai_summary.get("resumo_executivo") or ""
        achados       = ai_summary.get("principais_achados") or []
        riscos        = ai_summary.get("riscos_operacionais") or []
        recomendacoes = ai_summary.get("recomendacoes") or []

        if resumo or achados or riscos or recomendacoes:
            story.extend(_section_title("Resumo Executivo — Inteligência Artificial", styles))

        if resumo:
            story.append(Paragraph(resumo, styles["ia_text"]))

        def _bullets(items: list, title: str) -> list:
            if not items:
                return []
            out = [Paragraph(f"<b>{title}</b>", styles["body"])]
            for item in items:
                text = item if isinstance(item, str) else str(item)
                out.append(Paragraph(f"• {text}", styles["bullet"]))
            out.append(Spacer(1, 0.2 * cm))
            return out

        story.extend(_bullets(achados,       "Principais Achados"))
        story.extend(_bullets(riscos,         "Riscos Identificados"))
        story.extend(_bullets(recomendacoes,  "Recomendações"))


# ── Main builder ──────────────────────────────────────────────────────────────
def generate_pdf(
    *,
    filename: str,
    created_at: datetime | None,
    total_rows: int,
    indicators: dict[str, Any] | None,
    alerts: list[dict] | None,
    ai_summary: dict[str, Any] | None,
    analysis_type: str = "ciclos",
) -> bytes:
    """
    Generate an executive PDF report and return it as bytes.

    Args:
        filename:    Original file name of the analysis.
        created_at:  Analysis creation datetime.
        total_rows:  Total rows processed.
        indicators:  Dict from analyze_ciclos_with_breakdown (includes 'by_type').
        alerts:      List of alert dicts with keys: type, category, message, count.
        ai_summary:  Dict from AIAnalysis with resumo_executivo, principais_achados, etc.

    Returns:
        PDF as bytes.
    """
    buf = io.BytesIO()
    styles = _make_styles()

    doc = BaseDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=1.5 * cm,
        bottomMargin=1.8 * cm,
    )
    content_frame = Frame(
        MARGIN, 1.8 * cm,
        PAGE_W - 2 * MARGIN,
        PAGE_H - 3.5 * cm,
        id="normal",
    )
    cover_frame = Frame(
        MARGIN, MARGIN,
        PAGE_W - 2 * MARGIN,
        PAGE_H - 2 * MARGIN,
        id="cover",
    )
    doc.addPageTemplates([
        PageTemplate(id="cover_tpl", frames=[cover_frame]),
        PageTemplate(id="body_tpl",  frames=[content_frame], onPage=_header_footer),
    ])

    story: list = []

    # ── Cover ──────────────────────────────────────────────────────────────
    story.extend(_build_cover(filename, created_at, total_rows, styles))
    story.append(PageBreak())

    ind = indicators or {}

    if analysis_type == "pdf":
        _build_pdf_doc_body(story, ind, ai_summary, styles)
        doc.build(story)
        return buf.getvalue()

    # ── KPI cards (ciclos / generic) ───────────────────────────────────────
    story.extend(_section_title("Indicadores Principais", styles))
    kpis = [
        (str(ind.get("total_atividades", 0)),  "Total de Atividades", ANAC_BLUE.hexval()),
        (f"{float(ind.get('taxa_execucao', 0)):.1f}%", "Taxa de Execução", GREEN_SOFT.hexval()),
        (str(ind.get("realizadas", 0)),         "Realizadas",          GREEN_SOFT.hexval()),
        (str(ind.get("pendencias_criticas", 0)),"Pendências Críticas", RED_SOFT.hexval()),
    ]
    story.append(_kpi_table(kpis, styles))
    story.append(Spacer(1, 0.4 * cm))

    # ── Full indicators table ───────────────────────────────────────────────
    story.extend(_section_title("Detalhamento dos Indicadores", styles))
    story.append(_indicators_table(ind, styles))
    story.append(Spacer(1, 0.4 * cm))

    # ── Breakdown by type ───────────────────────────────────────────────────
    by_type = ind.get("by_type")
    if by_type:
        story.extend(_section_title("Resultado por Tipo de Ciclo", styles))
        tbl = _by_type_table(by_type, styles)
        if tbl:
            story.append(tbl)
            story.append(Spacer(1, 0.4 * cm))

    # ── Alerts ─────────────────────────────────────────────────────────────
    if alerts:
        story.extend(_section_title("Alertas e Pendências", styles))
        _alert_style = {
            "error":   styles["alert_error"],
            "warning": styles["alert_warn"],
            "info":    styles["alert_info"],
        }
        _alert_prefix = {"error": "● CRÍTICO", "warning": "▲ ATENÇÃO", "info": "ℹ INFO"}
        for alert in alerts:
            atype = alert.get("type", "info")
            category = alert.get("category", "")
            message  = alert.get("message", "")
            count    = alert.get("count", 0)
            prefix   = _alert_prefix.get(atype, "")
            sty      = _alert_style.get(atype, styles["alert_info"])
            story.append(KeepTogether([
                Paragraph(f"{prefix} — {category} ({count} ocorrência{'s' if count != 1 else ''})", sty),
                Paragraph(message, styles["alert_body"]),
                Spacer(1, 0.2 * cm),
            ]))

    # ── AI Summary ─────────────────────────────────────────────────────────
    if ai_summary:
        resumo = ai_summary.get("resumo_executivo") or ""
        achados = ai_summary.get("principais_achados") or []
        riscos = ai_summary.get("riscos_operacionais") or []
        recomendacoes = ai_summary.get("recomendacoes") or []

        if resumo or achados or riscos or recomendacoes:
            story.extend(_section_title("Resumo Executivo — Inteligência Artificial", styles))

        if resumo:
            story.append(Paragraph(resumo, styles["ia_text"]))

        def _bullet_list(items: list, title: str):
            if not items:
                return []
            out = [Paragraph(f"<b>{title}</b>", styles["body"])]
            for item in items:
                text = item if isinstance(item, str) else str(item)
                out.append(Paragraph(f"• {text}", styles["bullet"]))
            out.append(Spacer(1, 0.2 * cm))
            return out

        story.extend(_bullet_list(achados,        "Principais Achados"))
        story.extend(_bullet_list(riscos,          "Riscos Operacionais"))
        story.extend(_bullet_list(recomendacoes,   "Recomendações"))

        doc.build(story)
    return buf.getvalue()
