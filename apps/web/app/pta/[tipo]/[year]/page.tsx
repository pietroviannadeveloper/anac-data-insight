"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AppHeader from "@/components/layout/AppHeader";
import AppFooter from "@/components/layout/AppFooter";
import { Reveal } from "@/components/ui/Reveal";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  ArrowLeft, Loader2, AlertCircle, CheckCircle2,
  Clock, XCircle, AlertTriangle, BarChart2, FileText,
  Trophy, Building2, SlidersHorizontal, X, ArrowUpDown,
  ArrowUp, ArrowDown, Search,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TopAtividade { atividade: string; realizadas: number; total: number; }
interface TopEmpresa   { empresa: string;   realizadas: number; total: number; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SnapshotIndicators = Record<string, any>;

interface Snapshot {
  year: number; tipo_ciclo: string; source_file: string;
  total_rows: number; indicators: SnapshotIndicators;
}

type SortField = "total" | "realizadas" | "pct";
type SortDir   = "desc" | "asc";
type PctFilter = "all" | "gte80" | "60to79" | "lt60";

interface PanelFilter {
  search: string;
  pct: PctFilter;
  sortField: SortField;
  sortDir: SortDir;
  open: boolean;
}

const DEFAULT_FILTER: PanelFilter = {
  search: "", pct: "all", sortField: "total", sortDir: "desc", open: false,
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TIPO_LABELS: Record<string, string> = {
  CICLO_BASE: "Ciclo Base", CICLO_DESEMPENHO: "Desempenho", NAO_PROGRAMADA: "Não Programadas",
};
const TIPO_COLORS: Record<string, { badge: string; accent: string }> = {
  CICLO_BASE:       { badge: "bg-blue-500/20 text-blue-300 border-blue-500/30",    accent: "#60a5fa" },
  CICLO_DESEMPENHO: { badge: "bg-purple-500/20 text-purple-300 border-purple-500/30", accent: "#a78bfa" },
  NAO_PROGRAMADA:   { badge: "bg-orange-500/20 text-orange-300 border-orange-500/30", accent: "#fb923c" },
};
const STATUS_COLORS = ["#34d399", "#60a5fa", "#fbbf24"];
const PCT_OPTIONS: { value: PctFilter; label: string }[] = [
  { value: "all",    label: "Todas as taxas" },
  { value: "gte80",  label: "≥ 80% (ótimo)"  },
  { value: "60to79", label: "60–79% (atenção)" },
  { value: "lt60",   label: "< 60% (crítico)" },
];
const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "total",      label: "Total de atividades" },
  { value: "realizadas", label: "Qtd. realizadas"     },
  { value: "pct",        label: "% execução"           },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pctExec(r: TopAtividade | TopEmpresa) {
  return r.total > 0 ? (r.realizadas / r.total) * 100 : 0;
}

function taxaColor(v: number) {
  return v >= 80 ? "text-emerald-400" : v >= 60 ? "text-yellow-400" : "text-red-400";
}
function taxaBg(v: number) {
  return v >= 80 ? "bg-emerald-500/15 border-emerald-500/30"
    : v >= 60 ? "bg-yellow-500/15 border-yellow-500/30"
    : "bg-red-500/15 border-red-500/30";
}
function fmt(v?: number, unit?: string) {
  if (v == null) return "—";
  return unit ? `${v.toFixed(1)}${unit}` : v.toLocaleString("pt-BR");
}
function applyFilter<T extends TopAtividade | TopEmpresa>(
  items: T[], nameKey: keyof T, f: PanelFilter,
): T[] {
  let out = [...items];
  if (f.search.trim()) {
    const q = f.search.toLowerCase();
    out = out.filter((r) => String(r[nameKey]).toLowerCase().includes(q));
  }
  if (f.pct !== "all") {
    out = out.filter((r) => {
      const p = pctExec(r);
      if (f.pct === "gte80")  return p >= 80;
      if (f.pct === "60to79") return p >= 60 && p < 80;
      if (f.pct === "lt60")   return p < 60;
      return true;
    });
  }
  out.sort((a, b) => {
    const va = f.sortField === "pct" ? pctExec(a) : f.sortField === "realizadas" ? a.realizadas : a.total;
    const vb = f.sortField === "pct" ? pctExec(b) : f.sortField === "realizadas" ? b.realizadas : b.total;
    return f.sortDir === "desc" ? vb - va : va - vb;
  });
  return out;
}

// ─── FilterPanel component ────────────────────────────────────────────────────

function FilterBar({
  f, setF, label,
}: { f: PanelFilter; setF: (v: PanelFilter) => void; label: string }) {
  const active = f.search || f.pct !== "all" || f.sortField !== "total" || f.sortDir !== "desc";
  return (
    <div>
      <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-white/8">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white/80">{label}</span>
          {active && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/25 text-amber-300 font-medium">
              filtros ativos
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {active && (
            <button
              onClick={() => setF(DEFAULT_FILTER)}
              className="text-xs text-white/30 hover:text-white/60 px-2 py-1 transition-colors"
            >
              Limpar
            </button>
          )}
          <button
            onClick={() => setF({ ...f, open: !f.open })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              f.open
                ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                : "bg-white/6 border-white/12 text-white/50 hover:text-white/80 hover:bg-white/10"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filtrar
          </button>
        </div>
      </div>

      {f.open && (
        <div className="px-5 py-3 border-b border-white/8 bg-white/3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <input
              type="text"
              placeholder="Buscar por nome..."
              value={f.search}
              onChange={(e) => setF({ ...f, search: e.target.value })}
              className="w-full bg-white/6 [color-scheme:dark] border border-white/12 text-white text-xs rounded-lg pl-8 pr-8 py-2 focus:outline-none focus:ring-1 focus:ring-amber-400/50 placeholder-white/30"
            />
            {f.search && (
              <button onClick={() => setF({ ...f, search: "" })} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* % Execução */}
          <select
            value={f.pct}
            onChange={(e) => setF({ ...f, pct: e.target.value as PctFilter })}
            className="bg-[#0a1929] [color-scheme:dark] border border-white/15 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
          >
            {PCT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {/* Sort */}
          <div className="flex gap-2">
            <select
              value={f.sortField}
              onChange={(e) => setF({ ...f, sortField: e.target.value as SortField })}
              className="flex-1 bg-[#0a1929] [color-scheme:dark] border border-white/15 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
            >
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button
              onClick={() => setF({ ...f, sortDir: f.sortDir === "desc" ? "asc" : "desc" })}
              title={f.sortDir === "desc" ? "Decrescente" : "Crescente"}
              className="px-2.5 py-2 rounded-lg bg-white/6 border border-white/12 text-white/50 hover:text-white/80 hover:bg-white/10 transition-colors"
            >
              {f.sortDir === "desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUp className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CustomTooltip ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#001E3C] border border-white/15 rounded-lg px-3 py-2 shadow-xl text-xs text-white">
      {label && <p className="font-semibold mb-1">{label}</p>}
      {payload.map((p: { name: string; value: number; color: string }, i: number) => (
        <p key={i} style={{ color: p.color }}>{p.name}: <strong>{p.value.toLocaleString("pt-BR")}</strong></p>
      ))}
    </div>
  );
}

// ─── KpiCard ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white/4 rounded-xl border border-white/8 px-5 py-4 flex flex-col gap-1">
      <span className="text-xs text-white/40 uppercase tracking-wider">{label}</span>
      <span className={`text-2xl font-bold ${color ?? "text-white"}`}>{value}</span>
      {sub && <span className="text-xs text-white/40">{sub}</span>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PTADashboardPage() {
  const params  = useParams();
  const router  = useRouter();
  const tipo    = decodeURIComponent(params.tipo as string);
  const year    = Number(params.year);

  const [snap,    setSnap]    = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const [fAtv,  setFAtv]  = useState<PanelFilter>({ ...DEFAULT_FILTER });
  const [fEmp,  setFEmp]  = useState<PanelFilter>({ ...DEFAULT_FILTER });

  useEffect(() => {
    if (!auth.isAdmin()) { router.replace("/dashboard"); return; }
    api.get(`/api/v1/pta/snapshot/${tipo}/${year}`)
      .then(setSnap)
      .catch(() => setError("Snapshot não encontrado ou erro ao carregar."))
      .finally(() => setLoading(false));
  }, [tipo, year, router]);

  const rawAtv = useMemo<TopAtividade[]>(
    () => (snap?.indicators?.top_atividades as TopAtividade[]) ?? [],
    [snap],
  );
  const rawEmp = useMemo<TopEmpresa[]>(
    () => (snap?.indicators?.top_empresas as TopEmpresa[]) ?? [],
    [snap],
  );

  const filteredAtv = useMemo(() => applyFilter(rawAtv, "atividade", fAtv), [rawAtv, fAtv]);
  const filteredEmp = useMemo(() => applyFilter(rawEmp, "empresa",   fEmp), [rawEmp, fEmp]);

  // ── loading / error states ──────────────────────────────────────────────────

  if (loading) return (
    <div className="flex flex-col min-h-screen bg-[#001E3C]">
      <AppHeader />
      <main className="flex-1 flex items-center justify-center gap-2 text-blue-200/50">
        <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Carregando...</span>
      </main>
      <AppFooter />
    </div>
  );

  if (error || !snap) return (
    <div className="flex flex-col min-h-screen bg-[#001E3C]">
      <AppHeader />
      <main className="flex-1 flex flex-col items-center justify-center gap-3 text-red-300">
        <AlertCircle className="w-8 h-8" />
        <p className="text-sm">{error ?? "Snapshot não encontrado."}</p>
        <Link href="/pta" className="text-xs text-amber-300 underline">Voltar ao PTA</Link>
      </main>
      <AppFooter />
    </div>
  );

  const ind       = snap.indicators ?? {};
  const tc        = TIPO_COLORS[tipo] ?? { badge: "bg-white/10 text-white/60 border-white/20", accent: "#94a3b8" };
  const tipoLabel = TIPO_LABELS[tipo] ?? tipo;
  const taxa      = Number(ind.taxa_execucao ?? 0);

  const statusData = [
    { name: "Realizadas",      value: Number(ind.realizadas      ?? 0) },
    { name: "Agendadas",       value: Number(ind.agendadas       ?? 0) },
    { name: "Sem agendamento", value: Number(ind.sem_agendamento ?? 0) },
  ].filter((d) => d.value > 0);

  const pendenciasData = [
    { name: "Sem GIASO",    value: Number(ind.sem_giaso          ?? 0), fill: "#f87171" },
    { name: "Sem PCDP",     value: Number(ind.sem_pcdp           ?? 0), fill: "#fb923c" },
    { name: "Sem Processo", value: Number(ind.sem_processo       ?? 0), fill: "#fbbf24" },
    { name: "Local Indef.", value: Number(ind.locais_indefinidos ?? 0), fill: "#a78bfa" },
    { name: "PCDP Duplic.", value: Number(ind.pcdp_duplicada     ?? 0), fill: "#f472b6" },
    { name: "Múlt. PCDPs", value: Number(ind.multiplas_pcdps    ?? 0), fill: "#38bdf8" },
  ].filter((d) => d.value > 0);

  const maxEmpTotal = rawEmp[0]?.total ?? 1;

  return (
    <div className="flex flex-col min-h-screen bg-[#001E3C]">
      <AppHeader />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">

        {/* Back + header */}
        <div className="mb-8">
          <Link href="/pta" className="inline-flex items-center gap-1.5 text-sm text-amber-300/60 hover:text-amber-300 transition-colors mb-4">
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao PTA
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`text-xs px-2.5 py-1 rounded border font-medium ${tc.badge}`}>{tipoLabel}</span>
            <h1 className="text-2xl font-bold text-white">Dashboard {year}</h1>
            <span className="text-white/30 text-sm flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" /> {snap.source_file}
            </span>
          </div>
          <p className="text-blue-200/40 text-sm mt-1">{snap.total_rows.toLocaleString("pt-BR")} atividades registradas</p>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          <KpiCard label="Total de Atividades" value={fmt(ind.total_atividades)} color="text-white" />
          <KpiCard
            label="Realizadas" value={fmt(ind.realizadas)}
            sub={`${ind.total_atividades ? ((Number(ind.realizadas) / Number(ind.total_atividades)) * 100).toFixed(1) : 0}% do total`}
            color="text-emerald-400"
          />
          <KpiCard label="Agendadas"        value={fmt(ind.agendadas)}       color="text-blue-300" />
          <KpiCard label="Sem Agendamento"  value={fmt(ind.sem_agendamento)} color="text-orange-400" />
          <div className={`rounded-xl border px-5 py-4 flex flex-col gap-1 ${taxaBg(taxa)}`}>
            <span className="text-xs text-white/40 uppercase tracking-wider">Taxa de Execução</span>
            <span className={`text-3xl font-bold ${taxaColor(taxa)}`}>{taxa.toFixed(1)}%</span>
            <span className="text-xs text-white/40">Meta: ≥ 80%</span>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white/4 rounded-xl border border-white/8 p-5">
            <h2 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-amber-400" /> Distribuição por Status
            </h2>
            {statusData.length === 0 ? <p className="text-white/30 text-sm text-center py-10">Sem dados</p> : (
              <Reveal height={240} className="relative">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={58} outerRadius={90} dataKey="value"
                      paddingAngle={3} cornerRadius={5}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}
                      animationDuration={900} animationEasing="ease-out">
                      {statusData.map((_, i) => <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} stroke="transparent" />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: "11px", color: "#94a3b8" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-6">
                  <span className={`text-xl font-bold tabular-nums ${taxaColor(taxa)}`}>{taxa.toFixed(1)}%</span>
                  <span className="text-[10px] text-white/35">executado</span>
                </div>
              </Reveal>
            )}
          </div>

          <div className="bg-white/4 rounded-xl border border-white/8 p-5">
            <h2 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" /> Pendências por Categoria
            </h2>
            {pendenciasData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-emerald-400/70">
                <CheckCircle2 className="w-8 h-8" /><p className="text-sm">Nenhuma pendência</p>
              </div>
            ) : (
              <Reveal height={240}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={pendenciasData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }} barCategoryGap="25%">
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                    <Bar dataKey="value" name="Qtd." radius={[5, 5, 0, 0]} animationDuration={900} animationEasing="ease-out">
                      {pendenciasData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Reveal>
            )}
          </div>
        </div>

        {/* Status breakdown cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: "Realizadas",       value: ind.realizadas,      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />, color: "text-emerald-400", barColor: "#34d399", bg: "bg-emerald-500/10 border-emerald-500/20" },
            { label: "Agendadas",        value: ind.agendadas,       icon: <Clock        className="w-5 h-5 text-blue-300"    />, color: "text-blue-300",    barColor: "#93c5fd", bg: "bg-blue-500/10 border-blue-500/20"    },
            { label: "Sem Agendamento",  value: ind.sem_agendamento, icon: <XCircle      className="w-5 h-5 text-orange-400"  />, color: "text-orange-400",  barColor: "#fb923c", bg: "bg-orange-500/10 border-orange-500/20" },
          ].map((item) => {
            const pct = ind.total_atividades ? (Number(item.value ?? 0) / Number(ind.total_atividades) * 100) : 0;
            return (
              <div key={item.label} className={`rounded-xl border px-5 py-4 ${item.bg}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-white/40">{item.label}</span>{item.icon}
                </div>
                <p className={`text-2xl font-bold ${item.color}`}>{fmt(item.value)}</p>
                <div className="mt-2">
                  <div className="w-full bg-white/10 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: item.barColor }} />
                  </div>
                  <p className="text-xs text-white/30 mt-1">{pct.toFixed(1)}% do total</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Rankings com filtro ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

          {/* Top Atividades */}
          <div className="bg-white/4 rounded-xl border border-white/8 overflow-hidden">
            <FilterBar
              f={fAtv} setF={setFAtv}
              label={<><Trophy className="w-4 h-4 text-amber-400 inline mr-1.5" />Top Atividades Realizadas</>  as unknown as string}
            />
            {rawAtv.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-8">Sem dados — refaça o seed.</p>
            ) : filteredAtv.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-white/30">
                <Search className="w-6 h-6" />
                <p className="text-sm">Nenhum resultado para os filtros aplicados.</p>
                <button onClick={() => setFAtv({ ...DEFAULT_FILTER })} className="text-xs text-amber-300 underline">Limpar filtros</button>
              </div>
            ) : (
              <div className="divide-y divide-white/5 max-h-[420px] overflow-y-auto">
                {filteredAtv.map((a, i) => {
                  const pct = pctExec(a);
                  return (
                    <div key={i} className="px-5 py-3 hover:bg-white/4 transition-colors">
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-bold text-white/20 w-5 shrink-0">#{i + 1}</span>
                          <span className="text-xs text-white/70 leading-snug truncate" title={a.atividade}>{a.atividade}</span>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="text-sm font-bold text-white tabular-nums">{a.realizadas.toLocaleString("pt-BR")}</span>
                          <span className="text-xs text-white/30 ml-1">/ {a.total}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pl-7">
                        <div className="flex-1 bg-white/8 rounded-full h-1.5 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: tc.accent }} />
                        </div>
                        <span className={`text-xs tabular-nums font-medium ${taxaColor(pct)}`}>{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="px-5 py-2 border-t border-white/6 text-xs text-white/25">
              {filteredAtv.length} de {rawAtv.length} atividades
            </div>
          </div>

          {/* Top Empresas */}
          <div className="bg-white/4 rounded-xl border border-white/8 overflow-hidden">
            <FilterBar
              f={fEmp} setF={setFEmp}
              label={<><Building2 className="w-4 h-4 text-amber-400 inline mr-1.5" />Top Empresas por Atividades</> as unknown as string}
            />
            {rawEmp.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-8">Sem dados — refaça o seed.</p>
            ) : filteredEmp.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-white/30">
                <Search className="w-6 h-6" />
                <p className="text-sm">Nenhum resultado para os filtros aplicados.</p>
                <button onClick={() => setFEmp({ ...DEFAULT_FILTER })} className="text-xs text-amber-300 underline">Limpar filtros</button>
              </div>
            ) : (
              <div className="divide-y divide-white/5 max-h-[420px] overflow-y-auto">
                {filteredEmp.map((e, i) => {
                  const pct    = pctExec(e);
                  const barPct = (e.total / maxEmpTotal) * 100;
                  return (
                    <div key={i} className="px-5 py-3 hover:bg-white/4 transition-colors">
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-bold text-white/20 w-5 shrink-0">#{i + 1}</span>
                          <span className="text-xs text-white/70 leading-snug truncate" title={e.empresa}>{e.empresa}</span>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="text-sm font-bold text-white tabular-nums">{e.total.toLocaleString("pt-BR")}</span>
                          <span className={`text-xs ml-1.5 tabular-nums ${taxaColor(pct)}`}>{pct.toFixed(0)}%</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pl-7">
                        <div className="flex-1 bg-white/8 rounded-full h-1.5 overflow-hidden">
                          <div className="h-full rounded-full bg-amber-400/60" style={{ width: `${barPct}%` }} />
                        </div>
                        <span className="text-xs text-white/30 tabular-nums">{e.realizadas} real.</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="px-5 py-2 border-t border-white/6 text-xs text-white/25">
              {filteredEmp.length} de {rawEmp.length} empresas
            </div>
          </div>
        </div>

        {/* Todos os indicadores */}
        <div className="bg-white/4 rounded-xl border border-white/8 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/8">
            <h2 className="text-sm font-semibold text-white/70">Todos os Indicadores</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/6">
            {[
              { label: "Total de Atividades", key: "total_atividades" },
              { label: "Realizadas",          key: "realizadas"       },
              { label: "Agendadas",           key: "agendadas"        },
              { label: "Sem Agendamento",     key: "sem_agendamento"  },
              { label: "Taxa de Execução",    key: "taxa_execucao",    unit: "%" },
              { label: "Taxa de Agendamento", key: "taxa_agendamento", unit: "%" },
              { label: "Sem GIASO",           key: "sem_giaso"        },
              { label: "Sem PCDP",            key: "sem_pcdp"         },
              { label: "Sem Processo",        key: "sem_processo"     },
              { label: "Locais Indefinidos",  key: "locais_indefinidos" },
              { label: "PCDP Duplicada",      key: "pcdp_duplicada"   },
              { label: "Múltiplas PCDPs",     key: "multiplas_pcdps"  },
              { label: "Pendências Críticas", key: "pendencias_criticas" },
            ].map((item) => {
              const val = ind[item.key];
              return (
                <div key={item.key} className="px-5 py-3.5 flex justify-between items-center hover:bg-white/4 transition-colors">
                  <span className="text-white/50 text-sm">{item.label}</span>
                  <span className="text-white font-semibold tabular-nums text-sm">
                    {val != null ? fmt(Number(val), item.unit) : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

      </main>
      <AppFooter />
    </div>
  );
}
