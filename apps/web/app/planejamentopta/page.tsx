"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppHeader from "@/components/layout/AppHeader";
import AppFooter from "@/components/layout/AppFooter";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";
import {
  ArrowLeft, Upload, X, CheckCircle2, Loader2, AlertCircle,
  CalendarRange, TrendingUp, TrendingDown, Building2, Trophy,
  Lightbulb, BarChart2, FileSpreadsheet, Trash2, ChevronDown,
  ChevronUp, Clock, Pencil, Check,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlanningMeta {
  id: string; label: string | null; ano_referencia: number;
  tipos_carregados: string[]; created_by: string | null;
  created_at: string; taxa_execucao: number | null;
  total_rows: number | null; sugestoes_count: number;
}

interface ScopeResult {
  id?: string; created_at?: string;
  ano_vigente: {
    total_rows: number; tipos_carregados: string[];
    indicadores: Record<string, number>;
    top_atividades: { atividade: string; realizadas: number; total: number }[];
    bottom_atividades: { atividade: string; realizadas: number; total: number }[];
    top_empresas: { empresa: string; realizadas: number; total: number }[];
    bottom_empresas: { empresa: string; realizadas: number; total: number }[];
  };
  ano_referencia: { year: number; total_rows: number; taxa_execucao: number };
  comparativo: { novas_empresas: string[]; empresas_ausentes: string[]; variacao_taxa_execucao: number };
  sugestoes: string[];
}

type FileKey = "ciclo_base" | "desempenho" | "nao_informadas";

// ─── Constants ────────────────────────────────────────────────────────────────

const FILE_SLOTS: { key: FileKey; label: string; color: string }[] = [
  { key: "ciclo_base",     label: "Ciclo Base",    color: "blue"   },
  { key: "desempenho",     label: "Desempenho",    color: "purple" },
  { key: "nao_informadas", label: "Não Informadas",color: "orange" },
];

const TIPO_LABELS: Record<string, string> = {
  CICLO_BASE: "Base", CICLO_DESEMPENHO: "Desempenho", NAO_PROGRAMADA: "Não Inf.",
};

const COLOR: Record<string, { ring: string; bg: string; text: string }> = {
  blue:   { ring: "border-blue-500/50",   bg: "bg-blue-500/10",   text: "text-blue-300"   },
  purple: { ring: "border-purple-500/50", bg: "bg-purple-500/10", text: "text-purple-300" },
  orange: { ring: "border-orange-500/50", bg: "bg-orange-500/10", text: "text-orange-300" },
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function taxaColor(v?: number | null) {
  if (v == null) return "text-white/40";
  return v >= 80 ? "text-emerald-400" : v >= 60 ? "text-yellow-400" : "text-red-400";
}

function fmt(v?: number | null, unit = "") {
  if (v == null) return "—";
  return `${typeof v === "number" && unit === "%" ? v.toFixed(1) : v.toLocaleString("pt-BR")}${unit}`;
}

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── FileDropZone ─────────────────────────────────────────────────────────────

function FileDropZone({ slot, file, onFile, onRemove }: {
  slot: typeof FILE_SLOTS[number]; file: File | null;
  onFile: (f: File) => void; onRemove: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const c = COLOR[slot.color];

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
      onClick={() => !file && ref.current?.click()}
      className={`relative rounded-xl border-2 border-dashed transition-all cursor-pointer select-none
        ${file ? `border-solid ${c.ring} ${c.bg}` : drag ? `${c.ring} bg-white/6` : "border-white/15 hover:border-white/30 bg-white/3 hover:bg-white/5"}`}
    >
      <input ref={ref} type="file" accept=".csv,.xlsx,.xls" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      <div className="px-5 py-5">
        {file ? (
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <CheckCircle2 className={`w-5 h-5 shrink-0 ${c.text}`} />
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${c.text}`}>{slot.label}</p>
                <p className="text-xs text-white/40 truncate mt-0.5">{file.name}</p>
                <p className="text-xs text-white/25">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-center py-1">
            <FileSpreadsheet className={`w-7 h-7 ${drag ? c.text : "text-white/20"}`} />
            <p className="text-sm font-medium text-white/50">{slot.label}</p>
            <p className="text-xs text-white/25">Arraste ou clique · .csv .xlsx</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── RankList ─────────────────────────────────────────────────────────────────

function RankList({ title, icon, items, nameKey, accent }: {
  title: string; icon: React.ReactNode; accent: string;
  items: Record<string, string | number>[]; nameKey: string;
}) {
  const max = (items[0]?.total as number) ?? 1;
  return (
    <div className="bg-white/4 rounded-xl border border-white/8 overflow-hidden">
      <div className="px-5 py-3 border-b border-white/8 flex items-center gap-2">
        {icon}
        <span className="text-sm font-semibold text-white/80">{title}</span>
        <span className="ml-auto text-xs text-white/30">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-center text-white/30 text-sm py-6">Sem dados</p>
      ) : (
        <div className="divide-y divide-white/5 max-h-64 overflow-y-auto">
          {items.map((item, i) => {
            const total = item.total as number;
            const real  = item.realizadas as number;
            const p     = total > 0 ? (real / total) * 100 : 0;
            return (
              <div key={i} className="px-5 py-2.5 hover:bg-white/4 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-white/20 w-5 font-bold">#{i + 1}</span>
                  <span className="text-xs text-white/70 truncate flex-1" title={String(item[nameKey])}>
                    {String(item[nameKey])}
                  </span>
                  <span className="text-sm font-bold text-white tabular-nums">{total}</span>
                  <span className={`text-xs tabular-nums w-10 text-right ${taxaColor(p)}`}>{p.toFixed(0)}%</span>
                </div>
                <div className="pl-7 flex items-center gap-2">
                  <div className="flex-1 bg-white/8 rounded-full h-1 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(total / max) * 100}%`, backgroundColor: accent }} />
                  </div>
                  <span className="text-xs text-white/25">{real} real.</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── ScopeCard (saved planning) ───────────────────────────────────────────────

function ScopeCard({ meta, onDelete }: { meta: PlanningMeta; onDelete: () => void }) {
  const [open, setOpen]         = useState(false);
  const [detail, setDetail]     = useState<ScopeResult | null>(null);
  const [loadingD, setLoadingD] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [editLabel, setEditLabel]   = useState(false);
  const [labelVal, setLabelVal]     = useState(meta.label ?? "");
  const [saving, setSaving]         = useState(false);

  async function loadDetail() {
    if (detail) return;
    setLoadingD(true);
    try { setDetail(await api.get(`/api/v1/pta/planejamentos/${meta.id}`)); }
    catch {} finally { setLoadingD(false); }
  }

  async function handleExpand() {
    setOpen((v) => !v);
    if (!open) await loadDetail();
  }

  async function handleDelete() {
    if (!confirmDel) { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 4000); return; }
    setDeleting(true);
    try { await api.delete(`/api/v1/pta/planejamentos/${meta.id}`); onDelete(); }
    catch {} finally { setDeleting(false); }
  }

  async function handleSaveLabel() {
    setSaving(true);
    try { await api.patch(`/api/v1/pta/planejamentos/${meta.id}`, { label: labelVal }); }
    catch {} finally { setSaving(false); setEditLabel(false); }
  }

  const res = detail;
  const variacaoPP = res?.comparativo?.variacao_taxa_execucao ?? 0;

  return (
    <div className="bg-white/4 rounded-xl border border-white/8 overflow-hidden">
      {/* Header row */}
      <div className="px-5 py-4 flex items-center gap-4 flex-wrap">
        {/* label / name */}
        <div className="flex-1 min-w-0">
          {editLabel ? (
            <div className="flex items-center gap-2">
              <input value={labelVal} onChange={(e) => setLabelVal(e.target.value)}
                autoFocus onKeyDown={(e) => e.key === "Enter" && handleSaveLabel()}
                className="bg-white/8 border border-white/20 text-white text-sm rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400/50 flex-1" />
              <button onClick={handleSaveLabel} disabled={saving}
                className="text-emerald-400 hover:text-emerald-300 transition-colors">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </button>
              <button onClick={() => setEditLabel(false)} className="text-white/30 hover:text-white/60"><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <span className="text-sm font-semibold text-white truncate">
                {meta.label || `Escopo PTA — ref. ${meta.ano_referencia}`}
              </span>
              <button onClick={() => setEditLabel(true)}
                className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-white/60 transition-all">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-white/30 flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDate(meta.created_at)}</span>
            <span className="text-white/20">·</span>
            <span className="text-xs text-white/30">ref. {meta.ano_referencia}</span>
            {meta.tipos_carregados?.map((t) => (
              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-white/8 text-white/40 border border-white/10">
                {TIPO_LABELS[t] ?? t}
              </span>
            ))}
          </div>
        </div>

        {/* key metrics */}
        <div className="flex items-center gap-4 shrink-0">
          {meta.total_rows != null && (
            <div className="text-center hidden sm:block">
              <p className="text-xs text-white/30">Atividades</p>
              <p className="text-sm font-bold text-white">{meta.total_rows.toLocaleString("pt-BR")}</p>
            </div>
          )}
          {meta.taxa_execucao != null && (
            <div className="text-center">
              <p className="text-xs text-white/30">Taxa Exec.</p>
              <p className={`text-sm font-bold ${taxaColor(meta.taxa_execucao)}`}>{meta.taxa_execucao.toFixed(1)}%</p>
            </div>
          )}
          {meta.sugestoes_count > 0 && (
            <div className="text-center hidden sm:block">
              <p className="text-xs text-white/30">Sugestões</p>
              <p className="text-sm font-bold text-amber-400">{meta.sugestoes_count}</p>
            </div>
          )}
        </div>

        {/* actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={handleExpand}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/6 hover:bg-white/10 border border-white/12 text-white/60 hover:text-white text-xs font-medium transition-colors">
            {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {open ? "Fechar" : "Ver escopo"}
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              confirmDel
                ? "bg-red-500 border-red-500 text-white"
                : "bg-white/4 border-white/10 text-red-400/60 hover:text-red-400 hover:border-red-500/40"
            }`}>
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            {confirmDel ? "Confirmar exclusão" : "Excluir"}
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-white/8 px-5 py-5 space-y-6">
          {loadingD ? (
            <div className="flex items-center justify-center py-8 gap-2 text-blue-200/40">
              <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Carregando...</span>
            </div>
          ) : res ? (
            <>
              {/* Resumo KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Total",       val: fmt(res.ano_vigente.total_rows),                                         color: "text-white" },
                  { label: "Realizadas",  val: fmt(res.ano_vigente.indicadores.realizadas),                              color: "text-emerald-400" },
                  { label: "Taxa Exec.",  val: fmt(res.ano_vigente.indicadores.taxa_execucao, "%"),                      color: taxaColor(res.ano_vigente.indicadores.taxa_execucao) },
                  { label: "Pendências", val: fmt(res.ano_vigente.indicadores.pendencias_criticas),                      color: "text-red-400" },
                ].map((k) => (
                  <div key={k.label} className="bg-white/4 rounded-lg border border-white/8 px-4 py-3">
                    <p className="text-xs text-white/35">{k.label}</p>
                    <p className={`text-xl font-bold ${k.color}`}>{k.val}</p>
                  </div>
                ))}
              </div>

              {/* Comparativo */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className={`rounded-lg border px-4 py-3 ${variacaoPP >= 0 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"}`}>
                  <p className="text-xs text-white/40 mb-1">Variação vs {res.ano_referencia.year}</p>
                  <div className="flex items-center gap-1.5">
                    {variacaoPP >= 0 ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
                    <span className={`text-lg font-bold ${variacaoPP >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {variacaoPP > 0 ? "+" : ""}{variacaoPP.toFixed(1)}pp
                    </span>
                  </div>
                </div>
                <div className="bg-blue-500/8 border border-blue-500/20 rounded-lg px-4 py-3">
                  <p className="text-xs text-white/40 mb-1">Empresas Novas</p>
                  <p className="text-lg font-bold text-blue-300">{res.comparativo.novas_empresas.length}</p>
                  {res.comparativo.novas_empresas.length > 0 && (
                    <p className="text-xs text-white/30 truncate" title={res.comparativo.novas_empresas.join(", ")}>
                      {res.comparativo.novas_empresas.slice(0, 2).join(", ")}{res.comparativo.novas_empresas.length > 2 ? "…" : ""}
                    </p>
                  )}
                </div>
                <div className="bg-orange-500/8 border border-orange-500/20 rounded-lg px-4 py-3">
                  <p className="text-xs text-white/40 mb-1">Empresas Ausentes</p>
                  <p className="text-lg font-bold text-orange-400">{res.comparativo.empresas_ausentes.length}</p>
                  {res.comparativo.empresas_ausentes.length > 0 && (
                    <p className="text-xs text-white/30 truncate" title={res.comparativo.empresas_ausentes.join(", ")}>
                      {res.comparativo.empresas_ausentes.slice(0, 2).join(", ")}{res.comparativo.empresas_ausentes.length > 2 ? "…" : ""}
                    </p>
                  )}
                </div>
              </div>

              {/* Rankings */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <RankList title="Empresas Mais Ativas"   nameKey="empresa"   accent="#34d399" icon={<Building2 className="w-4 h-4 text-emerald-400" />}
                  items={res.ano_vigente.top_empresas.map((e) => ({ ...e, name: e.empresa }))} />
                <RankList title="Empresas Menos Ativas"  nameKey="empresa"   accent="#fb923c" icon={<Building2 className="w-4 h-4 text-orange-400"  />}
                  items={res.ano_vigente.bottom_empresas.map((e) => ({ ...e, name: e.empresa }))} />
                <RankList title="Atividades Mais Realizadas" nameKey="atividade" accent="#60a5fa" icon={<Trophy className="w-4 h-4 text-blue-400" />}
                  items={res.ano_vigente.top_atividades.map((a) => ({ ...a, name: a.atividade }))} />
                <RankList title="Atividades Menos Realizadas" nameKey="atividade" accent="#f87171" icon={<Trophy className="w-4 h-4 text-red-400" />}
                  items={res.ano_vigente.bottom_atividades.map((a) => ({ ...a, name: a.atividade }))} />
              </div>

              {/* Sugestões */}
              {res.sugestoes.length > 0 && (
                <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-4 space-y-2">
                  {res.sugestoes.map((s, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-white/70">{s}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PlanejamentoPTAPage() {
  const router = useRouter();
  const [files,          setFiles]          = useState<Partial<Record<FileKey, File>>>({});
  const [anoRef,         setAnoRef]         = useState<string>("");
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [plannings,      setPlannings]      = useState<PlanningMeta[]>([]);
  const [loadingList,    setLoadingList]    = useState(true);

  const fetchPlannings = useCallback(async () => {
    try { setPlannings(await api.get("/api/v1/pta/planejamentos")); }
    catch {} finally { setLoadingList(false); }
  }, []);

  useEffect(() => {
    if (!auth.isAdmin()) { router.replace("/dashboard"); return; }
    api.get("/api/v1/pta/available-years").then((data: Record<string, number[]>) => {
      const years = Array.from(new Set(Object.values(data).flat())).sort((a, b) => b - a);
      setAvailableYears(years);
      if (years.length > 0) setAnoRef(String(years[0]));
    }).catch(() => {});
    fetchPlannings();
  }, [router, fetchPlannings]);

  async function handleSubmit() {
    if (!Object.keys(files).length || !anoRef) return;
    setLoading(true); setError(null);
    const form = new FormData();
    form.append("ano_referencia", anoRef);
    if (files.ciclo_base)    form.append("ciclo_base",    files.ciclo_base);
    if (files.desempenho)    form.append("desempenho",    files.desempenho);
    if (files.nao_informadas) form.append("nao_informadas", files.nao_informadas);
    try {
      const resp = await fetch(`${API_BASE}/api/v1/pta/planejar`, {
        method: "POST", credentials: "include", body: form,
      });
      if (!resp.ok) { const b = await resp.json().catch(() => ({})); throw new Error(b.detail ?? `Erro ${resp.status}`); }
      await resp.json();
      setFiles({});
      await fetchPlannings();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao gerar escopo.");
    } finally { setLoading(false); }
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#001E3C]">
      <AppHeader />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-10">

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div>
          <Link href="/pta" className="inline-flex items-center gap-1.5 text-sm text-amber-300/60 hover:text-amber-300 transition-colors mb-4">
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao PTA
          </Link>
          <div className="flex items-center gap-3 mb-1">
            <CalendarRange className="w-6 h-6 text-emerald-400" />
            <h1 className="text-2xl font-bold text-white">Planejamento PTA</h1>
          </div>
          <p className="text-blue-200/50 text-sm">
            Envie os arquivos do ano vigente, escolha um ano de referência e gere o escopo. Cada escopo fica salvo e pode ser renomeado ou excluído.
          </p>
        </div>

        {/* ── Novo Escopo ──────────────────────────────────────────────────── */}
        <div className="bg-white/4 rounded-xl border border-white/8 p-6">
          <h2 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
            <Upload className="w-4 h-4 text-emerald-400" /> Novo Escopo PTA
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            {FILE_SLOTS.map((slot) => (
              <FileDropZone key={slot.key} slot={slot}
                file={files[slot.key] ?? null}
                onFile={(f) => setFiles((p) => ({ ...p, [slot.key]: f }))}
                onRemove={() => setFiles((p) => { const n = { ...p }; delete n[slot.key]; return n; })} />
            ))}
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <label className="text-sm text-white/50 shrink-0">Ano de referência:</label>
              <select value={anoRef} onChange={(e) => setAnoRef(e.target.value)}
                className="bg-[#0a1929] [color-scheme:dark] border border-white/15 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-400/50">
                {availableYears.length === 0
                  ? <option value="">Carregue o seed primeiro</option>
                  : availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button onClick={handleSubmit} disabled={!Object.keys(files).length || !anoRef || loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-[#001E3C] font-bold rounded-lg text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart2 className="w-4 h-4" />}
              {loading ? "Gerando e salvando…" : "Gerar e Salvar Escopo"}
            </button>
          </div>
          {error && (
            <div className="mt-4 px-4 py-3 bg-red-500/15 border border-red-500/30 rounded-lg text-red-300 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
        </div>

        {/* ── Escopos Salvos ───────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Escopos Salvos</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/8 text-white/40 border border-white/10">
              {plannings.length}
            </span>
          </div>

          {loadingList ? (
            <div className="flex items-center justify-center py-12 gap-2 text-blue-200/30">
              <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Carregando escopos...</span>
            </div>
          ) : plannings.length === 0 ? (
            <div className="text-center py-14 text-white/20 border border-dashed border-white/10 rounded-xl">
              <CalendarRange className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum escopo salvo ainda.</p>
              <p className="text-xs mt-1">Envie os arquivos acima para gerar o primeiro escopo.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {plannings.map((p) => (
                <ScopeCard key={p.id} meta={p} onDelete={() => setPlannings((prev) => prev.filter((x) => x.id !== p.id))} />
              ))}
            </div>
          )}
        </div>

      </main>
      <AppFooter />
    </div>
  );
}
