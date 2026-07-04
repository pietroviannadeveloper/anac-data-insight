"""
PTA (Plano de Trabalho Anual) historical analysis routes.
All endpoints require admin role.
"""

from __future__ import annotations

import io
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.dependencies import require_admin
from app.db.database import get_db
from app.models.pta import PTASnapshot
from app.models.pta_planning import PTAPlanning
from app.services.pta_loader import load_snapshots, _top_atividades, _top_empresas
from app.services.ciclo_analyzer import analyze_ciclos

router = APIRouter(tags=["PTA"])


@router.get("/pta/snapshots")
async def list_pta_snapshots(
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    """Return all PTA snapshots ordered by year and tipo."""
    rows = (
        db.query(PTASnapshot)
        .order_by(PTASnapshot.year.asc(), PTASnapshot.tipo_ciclo.asc())
        .all()
    )
    return [
        {
            "id": r.id,
            "year": r.year,
            "tipo_ciclo": r.tipo_ciclo,
            "source_file": r.source_file,
            "total_rows": r.total_rows,
            "indicators": r.indicators,
            "is_seed": bool(r.is_seed),
            "loaded_at": r.loaded_at.isoformat() if r.loaded_at else None,
        }
        for r in rows
    ]


@router.post("/pta/seed", status_code=201)
async def seed_pta(
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    """
    (Re)load historical PTA data from docs/historicoPTA/ CSVs.
    Existing seed records are replaced; non-seed records are preserved.
    """
    snapshots = load_snapshots()
    if not snapshots:
        raise HTTPException(
            status_code=422,
            detail="Nenhum arquivo PTA válido encontrado em docs/historicoPTA/.",
        )

    # Remove existing seed records then re-insert
    db.query(PTASnapshot).filter(PTASnapshot.is_seed == 1).delete(synchronize_session=False)
    db.flush()

    created = 0
    for s in snapshots:
        db.add(
            PTASnapshot(
                year=s["year"],
                tipo_ciclo=s["tipo_ciclo"],
                source_file=s["source_file"],
                indicators=s["indicators"],
                total_rows=s["total_rows"],
                is_seed=1,
            )
        )
        created += 1

    db.commit()
    return {"message": f"{created} snapshot(s) carregado(s) com sucesso.", "count": created}


@router.get("/pta/compare")
async def compare_pta(
    year_a: int,
    tipo_a: str,
    year_b: int,
    tipo_b: str,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    """
    Compare two PTA snapshots. tipo_a must equal tipo_b (same ciclo type).
    Returns both snapshots' indicators side-by-side.
    """
    if tipo_a != tipo_b:
        raise HTTPException(
            status_code=422,
            detail="A comparação deve ser feita entre o mesmo tipo de ciclo (Base vs Base, Desempenho vs Desempenho).",
        )

    def _fetch(year: int, tipo: str) -> PTASnapshot:
        row = (
            db.query(PTASnapshot)
            .filter(PTASnapshot.year == year, PTASnapshot.tipo_ciclo == tipo)
            .first()
        )
        if not row:
            raise HTTPException(
                status_code=404,
                detail=f"Snapshot não encontrado: {tipo} {year}.",
            )
        return row

    snap_a = _fetch(year_a, tipo_a)
    snap_b = _fetch(year_b, tipo_b)

    # Planejar PTA is only enabled when the two years are at most 2 apart
    can_plan = abs(snap_b.year - snap_a.year) <= 2

    return {
        "tipo_ciclo": tipo_a,
        "can_plan_pta": can_plan,
        "a": {
            "year": snap_a.year,
            "source_file": snap_a.source_file,
            "total_rows": snap_a.total_rows,
            "indicators": snap_a.indicators,
        },
        "b": {
            "year": snap_b.year,
            "source_file": snap_b.source_file,
            "total_rows": snap_b.total_rows,
            "indicators": snap_b.indicators,
        },
    }


@router.get("/pta/snapshot/{tipo}/{year}")
async def get_pta_snapshot(
    tipo: str,
    year: int,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    """Return a single PTA snapshot by tipo and year."""
    row = (
        db.query(PTASnapshot)
        .filter(PTASnapshot.tipo_ciclo == tipo, PTASnapshot.year == year)
        .first()
    )
    if not row:
        raise HTTPException(
            status_code=404,
            detail=f"Snapshot não encontrado: {tipo} {year}.",
        )
    return {
        "id": row.id,
        "year": row.year,
        "tipo_ciclo": row.tipo_ciclo,
        "source_file": row.source_file,
        "total_rows": row.total_rows,
        "indicators": row.indicators,
        "is_seed": bool(row.is_seed),
        "loaded_at": row.loaded_at.isoformat() if row.loaded_at else None,
    }


@router.post("/pta/planejar")
async def planejar_pta(
    ano_referencia: int = Form(...),
    ciclo_base: Optional[UploadFile] = File(None),
    desempenho: Optional[UploadFile] = File(None),
    nao_informadas: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    """
    Recebe até 3 arquivos do PTA vigente + um ano de referência histórico.
    Retorna escopo comparativo: top/bottom empresas e atividades, e sugestões para o próximo ano.
    """
    import polars as pl

    # ── lê os arquivos enviados ────────────────────────────────────────────────
    def _read_upload(upload: Optional[UploadFile]) -> Optional[pl.DataFrame]:
        if not upload or not upload.filename:
            return None
        raw = upload.file.read()
        for enc in ("latin-1", "cp1252", "utf-8"):
            try:
                df = pl.read_csv(io.BytesIO(raw), separator=";", encoding=enc,
                                 infer_schema_length=0, ignore_errors=True)
                if df.height > 0:
                    return df
            except Exception:
                continue
        return None

    frames: dict[str, pl.DataFrame] = {}
    for label, upload in [
        ("CICLO_BASE", ciclo_base),
        ("CICLO_DESEMPENHO", desempenho),
        ("NAO_PROGRAMADA", nao_informadas),
    ]:
        df = _read_upload(upload)
        if df is not None:
            frames[label] = df

    if not frames:
        raise HTTPException(status_code=422,
                            detail="Envie pelo menos um arquivo (Ciclo Base, Desempenho ou Não Informadas).")

    # ── analisa cada tipo separadamente ───────────────────────────────────────
    por_tipo: dict[str, dict] = {}
    for tipo, df in frames.items():
        try:
            ind = analyze_ciclos(df)
            ind["top_atividades"]    = _top_atividades(df, 30)
            ind["bottom_atividades"] = _top_atividades(df, 30)   # será reordenado abaixo
            ind["top_empresas"]      = _top_empresas(df, 30)
            ind["bottom_empresas"]   = _top_empresas(df, 30)

            # bottom = menos atividades totais
            ind["bottom_atividades"] = sorted(
                _top_atividades(df, 200), key=lambda x: x["total"]
            )[:20]
            ind["bottom_empresas"] = sorted(
                _top_empresas(df, 200), key=lambda x: x["total"]
            )[:20]
        except Exception as exc:
            ind = {"erro": str(exc)}
        por_tipo[tipo] = ind

    # ── consolida todos os tipos em um único DataFrame ─────────────────────────
    all_df = pl.concat(list(frames.values()), how="diagonal")
    try:
        consolidado = analyze_ciclos(all_df)
        top_atv_geral    = _top_atividades(all_df, 20)
        bottom_atv_geral = sorted(_top_atividades(all_df, 200), key=lambda x: x["total"])[:20]
        top_emp_geral    = _top_empresas(all_df, 20)
        bottom_emp_geral = sorted(_top_empresas(all_df, 200), key=lambda x: x["total"])[:20]
    except Exception as exc:
        raise HTTPException(status_code=500,
                            detail=f"Erro ao consolidar arquivos: {exc}")

    # ── carrega referência histórica do banco ──────────────────────────────────
    ref_rows = (
        db.query(PTASnapshot)
        .filter(PTASnapshot.year == ano_referencia)
        .all()
    )
    if not ref_rows:
        raise HTTPException(status_code=404,
                            detail=f"Ano de referência {ano_referencia} não encontrado. Execute o seed primeiro.")

    # consolida indicadores do ano de referência
    ref_ind: dict[str, dict] = {r.tipo_ciclo: (r.indicators or {}) for r in ref_rows}
    ref_total = sum(r.total_rows for r in ref_rows)

    # ── comparativo de empresas (vigente vs referência) ────────────────────────
    def _empresa_set(ind_list: list, tipo: Optional[str] = None) -> dict[str, int]:
        out: dict[str, int] = {}
        if tipo:
            items = (ref_ind.get(tipo) or {}).get("top_empresas", [])
        else:
            items = ind_list
        for e in items:
            out[e["empresa"]] = e["total"]
        return out

    ref_empresas: dict[str, int] = {}
    for ti in ref_ind.values():
        for e in ti.get("top_empresas", []):
            ref_empresas[e["empresa"]] = ref_empresas.get(e["empresa"], 0) + e["total"]

    vig_empresas: dict[str, int] = {e["empresa"]: e["total"] for e in top_emp_geral}
    vig_empresas.update({e["empresa"]: e["total"] for e in bottom_emp_geral})

    novas_empresas   = [e for e in vig_empresas if e not in ref_empresas]
    ausentes_empresas = [e for e in ref_empresas if e not in vig_empresas]

    # ── sugestões automáticas ──────────────────────────────────────────────────
    taxa_vig = consolidado.get("taxa_execucao", 0)
    taxa_ref_total = sum(
        (ri.get("taxa_execucao", 0) * ri.get("total_atividades", 0))
        for ri in ref_ind.values()
    )
    ref_total_atv = sum(ri.get("total_atividades", 0) for ri in ref_ind.values())
    taxa_ref = round(taxa_ref_total / ref_total_atv, 2) if ref_total_atv else 0

    sugestoes = []
    if taxa_vig < taxa_ref - 5:
        sugestoes.append(f"Taxa de execução ({taxa_vig:.1f}%) caiu {taxa_ref - taxa_vig:.1f}pp em relação a {ano_referencia} ({taxa_ref:.1f}%). Revisar empresas com mais sem-agendamento.")
    elif taxa_vig > taxa_ref + 5:
        sugestoes.append(f"Taxa de execução ({taxa_vig:.1f}%) cresceu {taxa_vig - taxa_ref:.1f}pp em relação a {ano_referencia}. Manter estratégia.")
    if novas_empresas:
        sugestoes.append(f"{len(novas_empresas)} empresa(s) nova(s) no ano vigente: {', '.join(novas_empresas[:5])}{'...' if len(novas_empresas) > 5 else ''}.")
    if ausentes_empresas:
        sugestoes.append(f"{len(ausentes_empresas)} empresa(s) do histórico não aparece(m) no ano vigente: {', '.join(ausentes_empresas[:5])}{'...' if len(ausentes_empresas) > 5 else ''}.")
    if consolidado.get("sem_giaso", 0) > 0:
        sugestoes.append(f"{consolidado['sem_giaso']} atividade(s) sem GIASO — priorizar regularização antes do próximo PTA.")
    if consolidado.get("pendencias_criticas", 0) > 0:
        sugestoes.append(f"{consolidado['pendencias_criticas']} pendência(s) crítica(s) identificada(s). Resolver antes de fechar o escopo do próximo ano.")

    resultado = {
        "ano_vigente": {
            "total_rows": len(all_df),
            "tipos_carregados": list(frames.keys()),
            "indicadores": consolidado,
            "por_tipo": por_tipo,
            "top_atividades": top_atv_geral,
            "bottom_atividades": bottom_atv_geral,
            "top_empresas": top_emp_geral,
            "bottom_empresas": bottom_emp_geral,
        },
        "ano_referencia": {
            "year": ano_referencia,
            "total_rows": ref_total,
            "taxa_execucao": taxa_ref,
            "indicadores_por_tipo": ref_ind,
        },
        "comparativo": {
            "novas_empresas": novas_empresas,
            "empresas_ausentes": ausentes_empresas,
            "variacao_taxa_execucao": round(taxa_vig - taxa_ref, 2),
        },
        "sugestoes": sugestoes,
    }

    # ── persiste o escopo ──────────────────────────────────────────────────────
    planning = PTAPlanning(
        ano_referencia=ano_referencia,
        tipos_carregados=list(frames.keys()),
        resultado=resultado,
        created_by=_,
    )
    db.add(planning)
    db.commit()
    db.refresh(planning)

    return {**resultado, "id": planning.id, "created_at": planning.created_at.isoformat()}


@router.get("/pta/planejamentos")
async def list_planejamentos(
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    """List all saved PTA planning scopes, newest first."""
    rows = (
        db.query(PTAPlanning)
        .order_by(PTAPlanning.created_at.desc())
        .all()
    )
    return [
        {
            "id": r.id,
            "label": r.label,
            "ano_referencia": r.ano_referencia,
            "tipos_carregados": r.tipos_carregados,
            "created_by": r.created_by,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "taxa_execucao": (r.resultado or {}).get("ano_vigente", {}).get("indicadores", {}).get("taxa_execucao"),
            "total_rows": (r.resultado or {}).get("ano_vigente", {}).get("total_rows"),
            "sugestoes_count": len((r.resultado or {}).get("sugestoes", [])),
        }
        for r in rows
    ]


@router.get("/pta/planejamentos/{planning_id}")
async def get_planejamento(
    planning_id: str,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    """Return the full result of a saved planning scope."""
    row = db.query(PTAPlanning).filter(PTAPlanning.id == planning_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Planejamento não encontrado.")
    return {
        "id": row.id,
        "label": row.label,
        "ano_referencia": row.ano_referencia,
        "tipos_carregados": row.tipos_carregados,
        "created_by": row.created_by,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        **(row.resultado or {}),
    }


@router.patch("/pta/planejamentos/{planning_id}")
async def rename_planejamento(
    planning_id: str,
    body: dict,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    """Rename / add a label to a saved planning scope."""
    row = db.query(PTAPlanning).filter(PTAPlanning.id == planning_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Planejamento não encontrado.")
    row.label = body.get("label", row.label)
    db.commit()
    return {"ok": True, "label": row.label}


@router.delete("/pta/planejamentos/{planning_id}", status_code=204)
async def delete_planejamento(
    planning_id: str,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    """Delete a saved planning scope."""
    row = db.query(PTAPlanning).filter(PTAPlanning.id == planning_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Planejamento não encontrado.")
    db.delete(row)
    db.commit()


@router.get("/pta/available-years")
async def pta_available_years(
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    """Return distinct years and types present in the database."""
    rows = db.query(PTASnapshot.year, PTASnapshot.tipo_ciclo).order_by(PTASnapshot.year).all()
    by_type: dict[str, list[int]] = {}
    for year, tipo in rows:
        by_type.setdefault(tipo, [])
        if year not in by_type[tipo]:
            by_type[tipo].append(year)
    return by_type
