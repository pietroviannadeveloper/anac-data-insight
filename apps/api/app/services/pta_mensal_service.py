"""
PTA Mensal Service
==================
Parses uploaded PTA vigente spreadsheets and computes BI indicators.

Lógica de colunas da planilha:
  Mes          = mês ORIGINAL planejado no PTA (baseline)
  MesAgendado  = quando foi efetivamente agendado (pode diferir do Mes)
  MesRealizado = quando foi realizado
  GIASO        = servidor responsável pela atividade
"""

from __future__ import annotations

import io
import re
import unicodedata
from datetime import date as _date
from typing import Optional

import polars as pl

from app.services.ciclo_analyzer import _normalize, _norm_cols, _find_col, _is_empty


_MONTH_MAP = {
    "jan": 1, "fev": 2, "mar": 3, "abr": 4, "mai": 5, "jun": 6,
    "jul": 7, "ago": 8, "set": 9, "out": 10, "nov": 11, "dez": 12,
}

# PCDP válida: número/ano  ex. "278/2025", "1468/2025"
_PCDP_VALIDA = re.compile(r"^\d+/\d{4}", re.IGNORECASE)

_EXTRA_COL_PATTERNS: dict[str, list[str]] = {
    "servidor": ["servidor", "responsavel", "fiscal", "tecnico", "agente"],
}


def _to_month_num(value: Optional[str]) -> Optional[int]:
    if not value:
        return None
    v = value.strip().lower()
    try:
        n = int(re.sub(r"[^\d]", "", v))
        if 1 <= n <= 12:
            return n
    except (ValueError, TypeError):
        pass
    for k, m in _MONTH_MAP.items():
        if v.startswith(k):
            return m
    return None


def _classify_pcdp(pcdp: Optional[str]) -> str:
    """Classifica o tipo de PCDP."""
    if not pcdp or not pcdp.strip():
        return "vazia"
    p = pcdp.strip()
    pl = p.lower()
    if "cancelad" in pl:
        return "cancelada"
    if "remota" in pl or "grc" in pl or "ead" in pl:
        return "remota"
    if _PCDP_VALIDA.match(p):
        return "valida"
    return "especial"


def parse_spreadsheet(raw: bytes, filename: str) -> pl.DataFrame:
    """Lê bytes como CSV ou Excel e retorna DataFrame."""
    name_lower = filename.lower()
    if name_lower.endswith((".xlsx", ".xls")):
        try:
            return pl.read_excel(io.BytesIO(raw), infer_schema_length=0)
        except Exception:
            pass
    for enc in ("latin-1", "cp1252", "utf-8"):
        for sep in (";", ",", "\t"):
            try:
                df = pl.read_csv(
                    io.BytesIO(raw),
                    separator=sep,
                    encoding=enc,
                    infer_schema_length=0,
                    ignore_errors=True,
                )
                if df.height > 0 and df.width > 1:
                    return df
            except Exception:
                continue
    return pl.DataFrame()


def _find_extra_col(mapping: dict[str, str], logical: str) -> Optional[str]:
    patterns = _EXTRA_COL_PATTERNS.get(logical, [logical])
    for col_norm, col_real in mapping.items():
        for p in patterns:
            if p in col_norm:
                return col_real
    return None


def process_upload(raw: bytes, filename: str, tipo: str) -> dict:
    """
    Processa bytes da planilha e retorna:
      - activities: list[dict] — uma linha por atividade
      - indicators: dict — indicadores BI agregados
    """
    df = parse_spreadsheet(raw, filename)
    if df.is_empty():
        return {"activities": [], "indicators": {}, "total_rows": 0}

    mapping = _norm_cols(df)

    col_item      = _find_col(mapping, "item")
    col_atividade = _find_col(mapping, "atividade")
    col_gerencia  = _find_col(mapping, "gerencia")
    col_setor     = _find_col(mapping, "setor")
    col_regulado  = _find_col(mapping, "regulado")
    col_cidade    = _find_col(mapping, "cidade")
    col_mes       = _find_col(mapping, "mes")       # mês original do PTA
    col_agendado  = _find_col(mapping, "agendado")  # MesAgendado
    col_realizado = _find_col(mapping, "realizado") # MesRealizado
    col_giaso     = _find_col(mapping, "giaso")
    col_pcdp      = _find_col(mapping, "pcdp")
    col_processo  = _find_col(mapping, "processo")
    col_prioridade = _find_col(mapping, "prioridade")
    col_servidor  = _find_extra_col(mapping, "servidor")

    def _val(row: dict, col: Optional[str]) -> Optional[str]:
        if not col:
            return None
        v = str(row.get(col, "") or "").strip()
        return v if v else None

    _empty_vals = {"", "indefinido", "a definir", "-", "n/a"}

    activities: list[dict] = []
    for row in df.to_dicts():
        mes_orig = _val(row, col_mes)       # ex: "Jun"
        agend    = _val(row, col_agendado)  # ex: "Jun"
        realiz   = _val(row, col_realizado) # ex: "Set"

        if realiz:
            status = "realizado"
        elif agend:
            status = "agendado"
        else:
            status = "sem-agendamento"

        # mes_num: quando aconteceu/está previsto (MesRealizado > MesAgendado > Mes)
        mes_num = _to_month_num(realiz) or _to_month_num(agend) or _to_month_num(mes_orig)

        # mes_original_num: mês do plano original (coluna Mes)
        mes_original_num = _to_month_num(mes_orig) or mes_num

        # remanejado: Mes != MesAgendado (quando ambos preenchidos)
        remanejado = 0
        if mes_orig and agend and mes_orig.strip().lower() != agend.strip().lower():
            remanejado = 1

        giaso_val    = _val(row, col_giaso)
        pcdp_val     = _val(row, col_pcdp)
        proc_val     = _val(row, col_processo)
        cidade_val   = _val(row, col_cidade) or ""

        # GIASO é o servidor; coluna explícita de servidor tem prioridade
        servidor_val = _val(row, col_servidor) or giaso_val

        pcdp_tipo    = _classify_pcdp(pcdp_val)
        local_indef  = 1 if cidade_val.lower() in _empty_vals or not cidade_val else 0

        activities.append({
            "item":             _val(row, col_item),
            "atividade":        _val(row, col_atividade),
            "gerencia":         _val(row, col_gerencia),
            "setor":            _val(row, col_setor),
            "regulado":         _val(row, col_regulado),
            "cidade":           _val(row, col_cidade),
            "servidor":         servidor_val,
            "mes":              mes_orig,
            "mes_agendado":     agend,
            "mes_realizado":    realiz,
            "mes_num":          mes_num,
            "mes_original_num": mes_original_num,
            "giaso":            giaso_val,
            "processo":         proc_val,
            "pcdp":             pcdp_val,
            "pcdp_tipo":        pcdp_tipo,
            "prioridade":       _val(row, col_prioridade),
            "status":           status,
            "remanejado":       remanejado,
            "sem_giaso":        0 if giaso_val else 1,
            "sem_pcdp":         0 if pcdp_val else 1,
            "sem_pcdp_valida":  0 if pcdp_tipo == "valida" else 1,
            "sem_processo":     0 if proc_val else 1,
            "local_indefinido": local_indef,
            "tipo_ciclo":       tipo,
        })

    indicators = compute_bi_summary(activities)
    return {"activities": activities, "indicators": indicators, "total_rows": len(activities)}


def compute_bi_summary(activities: list[dict]) -> dict:
    """Agrega indicadores BI a partir da lista de atividades."""
    total = len(activities)
    if total == 0:
        return {
            "total_planejado": 0, "total_realizado": 0, "total_agendado": 0,
            "total_sem_agendamento": 0, "taxa_execucao": 0.0, "taxa_agendamento": 0.0,
        }

    realizadas  = sum(1 for a in activities if a.get("status") == "realizado")
    agendadas   = sum(1 for a in activities if a.get("status") == "agendado")
    sem_agend   = sum(1 for a in activities if a.get("status") == "sem-agendamento")
    remanejados = sum(1 for a in activities if a.get("remanejado", 0))

    # ── por mês ──────────────────────────────────────────────────────────────
    # planejado: usa mês ORIGINAL do PTA (coluna Mes)
    # realizado: usa mês em que foi feito (MesRealizado)
    planejado_por_mes: dict[int, int] = {}
    realizado_por_mes: dict[int, int] = {}
    agendado_por_mes:  dict[int, int] = {}

    for a in activities:
        orig = a.get("mes_original_num")
        mn   = a.get("mes_num")
        st   = a.get("status", "")

        if orig:
            planejado_por_mes[orig] = planejado_por_mes.get(orig, 0) + 1
        if st == "realizado" and mn:
            realizado_por_mes[mn] = realizado_por_mes.get(mn, 0) + 1
        if st == "agendado" and mn:
            agendado_por_mes[mn] = agendado_por_mes.get(mn, 0) + 1

    # ── por gerência ─────────────────────────────────────────────────────────
    por_gerencia: dict[str, dict] = {}
    for a in activities:
        g = a.get("gerencia") or "Não informada"
        if g not in por_gerencia:
            por_gerencia[g] = {"total": 0, "realizado": 0, "agendado": 0, "remanejado": 0}
        por_gerencia[g]["total"] += 1
        if a.get("status") == "realizado":
            por_gerencia[g]["realizado"] += 1
        elif a.get("status") == "agendado":
            por_gerencia[g]["agendado"] += 1
        if a.get("remanejado", 0):
            por_gerencia[g]["remanejado"] += 1

    # ── por cidade ───────────────────────────────────────────────────────────
    por_cidade: dict[str, int] = {}
    for a in activities:
        c = a.get("cidade") or "Não informada"
        por_cidade[c] = por_cidade.get(c, 0) + 1

    # ── por servidor (GIASO) ─────────────────────────────────────────────────
    mes_atual = _date.today().month
    por_servidor: dict[str, dict] = {}
    for a in activities:
        s = a.get("servidor") or "Não informado"
        if s not in por_servidor:
            por_servidor[s] = {
                "total": 0, "realizado": 0, "agendado": 0,
                "sem_agendamento": 0, "remanejado": 0,
                "_cidades_mv": set(),   # cidades no mês vigente
            }
        por_servidor[s]["total"] += 1
        st = a.get("status", "")
        if st == "realizado":
            por_servidor[s]["realizado"] += 1
        elif st == "agendado":
            por_servidor[s]["agendado"] += 1
        else:
            por_servidor[s]["sem_agendamento"] += 1
        if a.get("remanejado", 0):
            por_servidor[s]["remanejado"] += 1
        # coleta cidades do mês vigente (mes_num ou mes_original_num == mes_atual)
        mn  = a.get("mes_num")
        mon = a.get("mes_original_num")
        if mn == mes_atual or mon == mes_atual:
            cidade = (a.get("cidade") or "").strip()
            if cidade:
                por_servidor[s]["_cidades_mv"].add(cidade)

    # ── pcdp stats (mes_atual já definido acima) ─────────────────────────────
    pcdp_counter: dict[str, int] = {}
    pcdp_tipo_counter: dict[str, int] = {"valida": 0, "remota": 0, "cancelada": 0, "especial": 0, "vazia": 0}
    for a in activities:
        pt = a.get("pcdp_tipo") or "vazia"
        pcdp_tipo_counter[pt] = pcdp_tipo_counter.get(pt, 0) + 1
        if a.get("pcdp") and pt == "valida":
            p = a["pcdp"].strip()
            pcdp_counter[p] = pcdp_counter.get(p, 0) + 1

    pcdp_duplicadas = sum(1 for v in pcdp_counter.values() if v > 1)
    por_pcdp = sorted(
        [{"pcdp": k, "total": v} for k, v in pcdp_counter.items()],
        key=lambda x: -x["total"]
    )[:50]

    # ── mês vigente ──────────────────────────────────────────────────────────
    ativ_mes_vigente = [a for a in activities if a.get("mes_num") == mes_atual or a.get("mes_original_num") == mes_atual]
    realizadas_mv  = sum(1 for a in ativ_mes_vigente if a.get("status") == "realizado")
    agendadas_mv   = sum(1 for a in ativ_mes_vigente if a.get("status") == "agendado")
    sem_agend_mv   = sum(1 for a in ativ_mes_vigente if a.get("status") == "sem-agendamento")

    # situação do cronograma (acumulado até mês atual vs planejado)
    planejado_ate_agora = sum(v for m, v in planejado_por_mes.items() if m <= mes_atual)
    realizado_ate_agora = sum(v for m, v in realizado_por_mes.items() if m <= mes_atual)

    situacao = "dentro_do_previsto"
    if planejado_ate_agora > 0:
        ratio = realizado_ate_agora / planejado_ate_agora
        if ratio > 1.05:
            situacao = "adiantado"
        elif ratio < 0.85:
            situacao = "atrasado"

    return {
        # totais gerais
        "total_planejado":        total,
        "total_realizado":        realizadas,
        "total_agendado":         agendadas,
        "total_sem_agendamento":  sem_agend,
        "total_remanejados":      remanejados,
        "taxa_execucao":          round(realizadas / total * 100, 2) if total else 0.0,
        "taxa_agendamento":       round((realizadas + agendadas) / total * 100, 2) if total else 0.0,
        # por mês (usando colunas corretas)
        "planejado_por_mes":      {str(k): v for k, v in sorted(planejado_por_mes.items())},
        "realizado_por_mes":      {str(k): v for k, v in sorted(realizado_por_mes.items())},
        "agendado_por_mes":       {str(k): v for k, v in sorted(agendado_por_mes.items())},
        # breakdowns
        "por_gerencia": [
            {"gerencia": k, **v, "taxa": round(v["realizado"] / v["total"] * 100, 1) if v["total"] else 0}
            for k, v in sorted(por_gerencia.items(), key=lambda x: -x[1]["total"])
        ],
        "por_cidade": [
            {"cidade": k, "total": v}
            for k, v in sorted(por_cidade.items(), key=lambda x: -x[1])[:20]
        ],
        "por_servidor": [
            {
                "servidor": k,
                "total":    v["total"],
                "realizado": v["realizado"],
                "agendado":  v["agendado"],
                "sem_agendamento": v["sem_agendamento"],
                "remanejado": v["remanejado"],
                "taxa": round(v["realizado"] / v["total"] * 100, 1) if v["total"] else 0,
                "cidades_mes_vigente": sorted(v["_cidades_mv"]) if v["_cidades_mv"] else [],
            }
            for k, v in sorted(por_servidor.items(), key=lambda x: -x[1]["total"])
            if k != "Não informado"
        ][:30],
        # cronograma
        "planejado_ate_mes_atual":  planejado_ate_agora,
        "realizado_ate_mes_atual":  realizado_ate_agora,
        "situacao_cronograma":      situacao,
        # pendências
        "sem_giaso":                sum(a.get("sem_giaso", 0) for a in activities),
        "sem_pcdp":                 sum(a.get("sem_pcdp", 0) for a in activities),
        "sem_pcdp_valida":          sum(a.get("sem_pcdp_valida", 0) for a in activities),
        "sem_processo":             sum(a.get("sem_processo", 0) for a in activities),
        "locais_indefinidos":       sum(a.get("local_indefinido", 0) for a in activities),
        # pcdp
        "pcdp_por_tipo":            pcdp_tipo_counter,
        "total_com_pcdp_valida":    pcdp_tipo_counter.get("valida", 0),
        "unique_pcdps":             len(pcdp_counter),
        "pcdp_duplicadas":          pcdp_duplicadas,
        "por_pcdp":                 por_pcdp,
        # mês vigente
        "mes_vigente":                    mes_atual,
        "total_mes_vigente":              len(set(id(a) for a in ativ_mes_vigente)),
        "realizadas_mes_vigente":         realizadas_mv,
        "agendadas_mes_vigente":          agendadas_mv,
        "sem_agendamento_mes_vigente":    sem_agend_mv,
    }
