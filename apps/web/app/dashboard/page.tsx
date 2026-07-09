"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import AppHeader from "@/components/layout/AppHeader";
import AppFooter from "@/components/layout/AppFooter";
import { Reveal } from "@/components/ui/Reveal";
import { api } from "@/lib/api";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  Upload, Loader2, AlertCircle, TrendingUp, CheckCircle,
  Clock, AlertTriangle, Building2, ChevronDown, ChevronUp,
  Filter, RefreshCw, GitCompare,
} from "lucide-react";
import { useRouter } from "next/navigation";

// ── tipos ──────────────────────────────────────────────────────────────────

interface AnalysisOption {
  id: string;
  original_filename: string;
  detected_type: string;
  total_rows: number;
  created_at: string;
}

interface ActivityType {
  tipo: string;
  realizado: number;
  agendado: number;
  sem_agendamento: number;
  total: number;
}

interface DashboardData {
  total_analyses: number;
  total_activities: number;
  realizadas: number;
  agendadas: number;
  sem_agendamento: number;
  average_execution_rate: number;
  critical_pending_items: number;
  activities_by_status: { status: string; value: number; key: string }[];
  activities_by_type: ActivityType[];
  type_field_label: string;
  atividade_disponivel: boolean;
  top_companies: { empresa: string; total: number }[];
  bottom_companies: { empresa: string; total: number }[];
  pending_by_company: { empresa: string; pendentes: number }[];
  pending_detail: {
    item?: string; regulado?: string; gerencia?: string;
    setor?: string; prioridade?: string;
    sem_giaso: number; sem_pcdp: number; sem_processo: number;
  }[];
  top_alerts: { key: string; label: string; count: number }[];
}

// ── paleta ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  realizado: "#34d399", agendado: "#60a5fa", "sem-agendamento": "#fbbf24",
};
const COMPANY_COLORS = [
  "#3b82f6","#8b5cf6","#06b6d4","#10b981","#f59e0b",
  "#ef4444","#ec4899","#6366f1","#14b8a6","#f97316",
];

function shortName(s: string, max = 22) {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

// "O135-507 - Inspeção de Vigilância..." → "O135-507"
function extractO135Code(tipo: string): string {
  const m = tipo.match(/^(O\d+[-–]\d+)/i);
  return m ? m[1].toUpperCase() : tipo.split(" - ")[0].trim();
}

// "O135-507 - Inspeção de Vigilância de Voo..." → "Inspeção de Vigilância de Voo..."
function extractO135Desc(tipo: string): string {
  const sep = tipo.match(/[-–] /);
  if (!sep || !sep.index) return tipo;
  return tipo.slice(sep.index + sep[0].length).trim();
}

// ── sub-componentes ────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color = "blue" }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color?: "blue"|"green"|"yellow"|"red";
}) {
  const ring: Record<string,string> = { blue:"bg-blue-500/20", green:"bg-emerald-500/20", yellow:"bg-yellow-500/20", red:"bg-red-500/20" };
  const ic:   Record<string,string> = { blue:"text-blue-300",  green:"text-emerald-400",  yellow:"text-yellow-300",  red:"text-red-400" };
  return (
    <div className="bg-white/8 backdrop-blur-sm border border-white/12 rounded-xl p-5 flex items-center gap-4">
      <div className={`p-2.5 rounded-lg flex-shrink-0 ${ring[color]}`}>
        <Icon className={`w-5 h-5 ${ic[color]}`} />
      </div>
      <div>
        <p className="text-xs text-blue-200/50 uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
        {sub && <p className="text-xs text-blue-200/35 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0d1f3c] border border-white/15 rounded-lg px-3 py-2 text-xs shadow-xl max-w-[220px]">
      {label && <p className="text-blue-200/60 mb-1 font-medium truncate">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color ?? p.fill }} className="font-medium">
          {p.name}: <span className="text-white">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

// Tooltip especial para O135 — mostra nome completo da atividade
const CustomTooltipO135 = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const entry = payload[0]?.payload;
  return (
    <div className="bg-[#0d1f3c] border border-white/15 rounded-lg px-3 py-2 text-xs shadow-xl max-w-[280px]">
      {entry?.tipoFull && (
        <p className="text-blue-200 font-medium mb-1.5 leading-snug">{entry.tipoFull}</p>
      )}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.fill }} className="font-medium">
          {p.name}: <span className="text-white">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

const PieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.05) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + r * Math.cos(-midAngle * (Math.PI / 180));
  const y = cy + r * Math.sin(-midAngle * (Math.PI / 180));
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

// ── página principal ────────────────────────────────────────────────────────

function DashboardInner() {
  const searchParams = useSearchParams();
  const initialId = searchParams.get("analysis_id") ?? "all";

  const router = useRouter();
  const [analyses, setAnalyses] = useState<AnalysisOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>(initialId);
  const [period, setPeriod] = useState<string>("all");
  const [showCompare, setShowCompare] = useState(false);
  const [compareA, setCompareA] = useState<string>("");
  const [compareB, setCompareB] = useState<string>("");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllPending, setShowAllPending] = useState(false);

  const PERIODS: { key: string; label: string; days?: number }[] = [
    { key: "all",     label: "Tudo" },
    { key: "7d",      label: "7 dias",    days: 7 },
    { key: "30d",     label: "30 dias",   days: 30 },
    { key: "90d",     label: "Trimestre", days: 90 },
    { key: "365d",    label: "Este ano",  days: 365 },
  ];

  // carrega lista de análises para o filtro
  useEffect(() => {
    api.get("/api/v1/analyses?per_page=100")
      .then((r) => setAnalyses(r.items.filter((a: AnalysisOption) => a.detected_type === "ciclos")))
      .catch(() => {});
  }, []);

  const loadDashboard = useCallback((id: string, per: string) => {
    setLoading(true);
    setError(null);
    setShowAllPending(false);

    const params = new URLSearchParams();
    if (id !== "all") params.set("analysis_id", id);
    const periodCfg = PERIODS.find(p => p.key === per);
    if (periodCfg?.days && id === "all") {
      const from = new Date(Date.now() - periodCfg.days * 86400_000).toISOString().split("T")[0];
      params.set("date_from", from);
    }
    const qs = params.toString() ? `?${params}` : "";

    api.get(`/api/v1/dashboard/summary${qs}`)
      .then(setData)
      .catch(() => setError("Não foi possível carregar o dashboard."))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadDashboard(selectedId, period); }, [selectedId, period, loadDashboard]);

  const selectedLabel = selectedId === "all"
    ? "Todas as análises"
    : analyses.find(a => a.id === selectedId)?.original_filename ?? "—";

  // ── loading / error ───────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <main className="flex-1 flex flex-col items-center justify-center gap-3 text-blue-200/50">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="text-sm">Carregando dashboard{selectedId !== "all" ? " da análise" : ""}…</span>
      </main>
      <AppFooter />
    </div>
  );

  if (error || !data) return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <main className="flex-1 flex flex-col items-center justify-center gap-3 text-red-400">
        <AlertCircle className="w-8 h-8" />
        <p className="text-sm">{error ?? "Sem dados."}</p>
        <button onClick={() => loadDashboard(selectedId, period)} className="text-xs text-blue-300 hover:text-white flex items-center gap-1">
          <RefreshCw className="w-3.5 h-3.5" /> Tentar novamente
        </button>
      </main>
      <AppFooter />
    </div>
  );

  const pendingVisible = showAllPending ? data.pending_detail : data.pending_detail.slice(0, 10);

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 space-y-10">

        {/* ── Header + filtro ─────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <Link href="/" className="text-sm text-blue-300/60 hover:text-blue-300 transition-colors">← Início</Link>
            <h1 className="text-2xl font-bold text-white mt-3">Dashboard</h1>
            <p className="text-blue-200/50 text-sm mt-1">Visão consolidada das atividades de fiscalização.</p>
          </div>
          <div className="flex items-center gap-3">
            {/* seletor de análise */}
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
              <Filter className="w-3.5 h-3.5 text-blue-300/60 flex-shrink-0" />
              <select
                value={selectedId}
                onChange={e => setSelectedId(e.target.value)}
                className="bg-transparent text-sm text-blue-100 outline-none cursor-pointer min-w-[180px] max-w-[260px]"
              >
                <option value="all">Todas as análises</option>
                {analyses.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.original_filename.length > 35 ? a.original_filename.slice(0, 35) + "…" : a.original_filename}
                  </option>
                ))}
              </select>
            </div>
            {/* Botão comparar ciclos */}
            {analyses.length >= 2 && (
              <button
                onClick={() => setShowCompare(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border transition-colors ${
                  showCompare
                    ? "bg-teal-500/20 border-teal-400/40 text-teal-300"
                    : "bg-white/5 border-white/10 text-blue-200/60 hover:text-blue-200 hover:bg-white/10"
                }`}
                title="Comparar dois ciclos lado a lado"
              >
                <GitCompare className="w-3.5 h-3.5" />
                Comparar
              </button>
            )}

            <Link href="/upload"
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#003A70] hover:bg-[#0057A8] rounded-lg transition-colors">
              <Upload className="w-3.5 h-3.5" /> Nova análise
            </Link>
          </div>
        </div>

        {/* Painel de comparação */}
        {showCompare && analyses.length >= 2 && (
          <div className="bg-teal-500/5 border border-teal-400/20 rounded-xl p-4 -mt-6">
            <p className="text-xs font-semibold text-teal-300/70 uppercase tracking-wide mb-3 flex items-center gap-2">
              <GitCompare className="w-3.5 h-3.5" /> Selecione dois ciclos para comparar
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[180px]">
                <label className="text-xs text-blue-200/40 block mb-1">
                  {compareA
                    ? <span className="text-teal-300 font-medium truncate block max-w-[260px]">
                        {analyses.find(a => a.id === compareA)?.original_filename ?? "Base"}
                      </span>
                    : "Selecione o ciclo base"}
                </label>
                <select
                  value={compareA}
                  onChange={e => setCompareA(e.target.value)}
                  className="w-full bg-[#0d1f3c] border border-white/10 rounded-lg px-3 py-2 text-sm text-blue-100 focus:outline-none focus:border-teal-400/50"
                >
                  <option value="">— ciclo base —</option>
                  {analyses.map(a => (
                    <option key={a.id} value={a.id} disabled={a.id === compareB}>
                      {a.original_filename.length > 50 ? a.original_filename.slice(0, 50) + "…" : a.original_filename}
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-blue-200/30 text-sm font-bold self-center pb-1">vs</div>

              <div className="flex-1 min-w-[180px]">
                <label className="text-xs text-blue-200/40 block mb-1">
                  {compareB
                    ? <span className="text-teal-300 font-medium truncate block max-w-[260px]">
                        {analyses.find(a => a.id === compareB)?.original_filename ?? "Comparação"}
                      </span>
                    : "Selecione o ciclo a comparar"}
                </label>
                <select
                  value={compareB}
                  onChange={e => setCompareB(e.target.value)}
                  className="w-full bg-[#0d1f3c] border border-white/10 rounded-lg px-3 py-2 text-sm text-blue-100 focus:outline-none focus:border-teal-400/50"
                >
                  <option value="">— ciclo a comparar —</option>
                  {analyses.map(a => (
                    <option key={a.id} value={a.id} disabled={a.id === compareA}>
                      {a.original_filename.length > 50 ? a.original_filename.slice(0, 50) + "…" : a.original_filename}
                    </option>
                  ))}
                </select>
              </div>

              <button
                disabled={!compareA || !compareB || compareA === compareB}
                onClick={() => router.push(`/comparar?a=${compareA}&b=${compareB}`)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-teal-500/30 border border-teal-400/40 rounded-lg hover:bg-teal-500/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <GitCompare className="w-4 h-4" /> Ver comparativo
              </button>
            </div>
            {compareA && compareB && compareA === compareB && (
              <p className="text-xs text-red-400/70 mt-2">Selecione dois ciclos diferentes.</p>
            )}
          </div>
        )}

        {/* Filtro de período */}
        {selectedId === "all" && (
          <div className="flex items-center gap-1 -mt-4 mb-2">
            <span className="text-xs text-blue-200/40 mr-2">Período:</span>
            {PERIODS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                  period === p.key
                    ? "bg-blue-500/20 border border-blue-400/40 text-blue-300"
                    : "text-blue-200/40 hover:text-blue-200/70 hover:bg-white/5"
                }`}>
                {p.label}
              </button>
            ))}
          </div>
        )}

        {/* rótulo da análise selecionada */}
        {selectedId !== "all" && (
          <div className="flex items-center gap-2 text-xs text-blue-200/50 -mt-4">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
            Exibindo: <span className="text-blue-300">{selectedLabel}</span>
            <button onClick={() => setSelectedId("all")} className="text-blue-200/30 hover:text-blue-200/70 ml-1 underline">limpar filtro</button>
          </div>
        )}

        {/* ── Cards de status ─────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-blue-200/50 uppercase tracking-widest mb-3">Visão Geral</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total de atividades" value={data.total_activities.toLocaleString("pt-BR")} icon={TrendingUp} color="blue" />
            <StatCard label="Realizadas" value={data.realizadas}
              sub={data.total_activities > 0 ? `${((data.realizadas / data.total_activities) * 100).toFixed(1)}% do total` : ""}
              icon={CheckCircle} color="green" />
            <StatCard label="Agendadas" value={data.agendadas} sub="aguardando execução" icon={Clock} color="blue" />
            <StatCard label="Sem agendamento" value={data.sem_agendamento} sub="atividades pendentes" icon={AlertTriangle} color="yellow" />
          </div>
          {data.average_execution_rate > 0 && (
            <div className="mt-4 grid grid-cols-2 lg:grid-cols-3 gap-4">
              <StatCard label="Taxa de execução" value={`${data.average_execution_rate}%`} icon={TrendingUp}
                color={data.average_execution_rate >= 80 ? "green" : "red"} />
              <StatCard label="Pendências críticas" value={data.critical_pending_items} icon={AlertCircle}
                color={data.critical_pending_items > 0 ? "red" : "green"} />
              <StatCard label="Análises" value={data.total_analyses} icon={Building2} color="blue" />
            </div>
          )}
        </section>

        {/* ── Distribuição de status (pizza) ──────────────────────────── */}
        {data.activities_by_status.some(s => s.value > 0) && (
          <section>
            <h2 className="text-xs font-semibold text-blue-200/50 uppercase tracking-widest mb-3">Distribuição por Status</h2>
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 flex flex-col lg:flex-row items-center gap-8">
              <Reveal height={220} className="relative flex-1 w-full">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={data.activities_by_status.filter(s => s.value > 0)}
                    dataKey="value" nameKey="status" cx="50%" cy="50%"
                    innerRadius={60} outerRadius={92} paddingAngle={3} cornerRadius={5}
                    labelLine={false} label={PieLabel}
                    animationDuration={900} animationEasing="ease-out">
                    {data.activities_by_status.filter(s => s.value > 0).map(e => (
                      <Cell key={e.key} fill={STATUS_COLORS[e.key] ?? "#6b7280"} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend formatter={v => <span className="text-xs text-blue-200/70">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-6">
                <span className={`text-xl font-bold tabular-nums ${data.average_execution_rate >= 80 ? "text-emerald-400" : data.average_execution_rate >= 50 ? "text-yellow-300" : "text-red-400"}`}>
                  {data.average_execution_rate}%
                </span>
                <span className="text-[10px] text-blue-200/40">execução</span>
              </div>
              </Reveal>
              <div className="flex flex-col gap-3 min-w-[180px]">
                {data.activities_by_status.map(s => (
                  <div key={s.key} className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[s.key] ?? "#6b7280" }} />
                    <div>
                      <p className="text-sm text-white font-medium">{s.value.toLocaleString("pt-BR")}</p>
                      <p className="text-xs text-blue-200/50">{s.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── Tipos de atividades (O135) ──────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-xs font-semibold text-blue-200/50 uppercase tracking-widest">
                Tipos de Atividade O135 — Quantas e Quais
              </h2>
              <p className="text-xs text-blue-200/35 mt-0.5">
                {data.atividade_disponivel
                  ? `${data.activities_by_type.length} tipo${data.activities_by_type.length !== 1 ? "s" : ""} identificado${data.activities_by_type.length !== 1 ? "s" : ""} na planilha`
                  : "Coluna 'Atividade' vazia na planilha — será preenchida em análises futuras"}
              </p>
            </div>
            {!data.atividade_disponivel && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-white/8 border border-white/15 text-blue-200/50">
                Agrupando por setor
              </span>
            )}
          </div>

          {/* aviso quando atividade não está preenchida */}
          {!data.atividade_disponivel && (
            <div className="flex items-start gap-3 bg-blue-500/8 border border-blue-400/20 rounded-xl px-4 py-3 mb-4 text-xs text-blue-200/70">
              <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <span>
                A coluna <span className="font-mono text-blue-300">Atividade</span> desta planilha não está preenchida.
                Quando planilhas futuras trouxerem os tipos O135 (ex: <span className="font-mono text-blue-300">O135-507 - Inspeção de Vigilância de Voo de Acompanhamento</span>),
                este gráfico mostrará automaticamente o detalhamento por código de atividade.
              </span>
            </div>
          )}

          {data.activities_by_type.length > 0 && (
            <>
              {/* gráfico */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-4">
                <Reveal height={Math.max(180, data.activities_by_type.length * 52)}>
                <ResponsiveContainer width="100%" height={Math.max(180, data.activities_by_type.length * 52)}>
                  <BarChart
                    data={data.activities_by_type.map(t => ({
                      ...t,
                      // exibe só o código O135-xxx no eixo Y quando possível
                      tipo: data.atividade_disponivel ? extractO135Code(t.tipo) : shortName(t.tipo, 24),
                      tipoFull: t.tipo,
                    }))}
                    layout="vertical"
                    margin={{ top: 0, right: 40, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "rgba(147,197,253,0.5)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="tipo" width={data.atividade_disponivel ? 100 : 180}
                      tick={{ fill: "rgba(147,197,253,0.7)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltipO135 />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                    <Legend formatter={v => <span className="text-xs text-blue-200/70">{v}</span>} />
                    <Bar dataKey="realizado" name="Realizado" fill="#34d399" stackId="a" stroke="#0d2247" strokeWidth={1}
                      animationDuration={900} animationEasing="ease-out" />
                    <Bar dataKey="agendado" name="Agendado" fill="#60a5fa" stackId="a" stroke="#0d2247" strokeWidth={1}
                      animationBegin={150} animationDuration={900} animationEasing="ease-out" />
                    <Bar dataKey="sem_agendamento" name="Sem agend." fill="#fbbf24" radius={[0,4,4,0]} stackId="a" stroke="#0d2247" strokeWidth={1}
                      animationBegin={300} animationDuration={900} animationEasing="ease-out" />
                  </BarChart>
                </ResponsiveContainer>
                </Reveal>
              </div>

              {/* tabela */}
              <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      {(data.atividade_disponivel
                        ? ["Código", "Descrição da Atividade", "Total", "Realizadas", "Agendadas", "Sem agend.", "% Execução"]
                        : [data.type_field_label, "Total", "Realizadas", "Agendadas", "Sem agend.", "% Execução"]
                      ).map(h => (
                        <th key={h} className="text-left px-3 py-2.5 font-medium text-blue-200/60 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {data.activities_by_type.map((t, i) => {
                      const pct = t.total > 0 ? ((t.realizado / t.total) * 100).toFixed(1) : "0.0";
                      const code = data.atividade_disponivel ? extractO135Code(t.tipo) : null;
                      const desc = data.atividade_disponivel ? extractO135Desc(t.tipo) : null;
                      return (
                        <tr key={i} className="hover:bg-white/5 transition-colors">
                          {data.atividade_disponivel ? (
                            <>
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                <span className="font-mono font-bold text-blue-300 bg-blue-500/10 border border-blue-400/20 px-2 py-0.5 rounded">
                                  {code ?? t.tipo}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-blue-100/70 max-w-[260px]">{desc ?? "—"}</td>
                            </>
                          ) : (
                            <td className="px-3 py-2.5 font-medium text-blue-100">{t.tipo}</td>
                          )}
                          <td className="px-3 py-2.5 text-white font-bold">{t.total}</td>
                          <td className="px-3 py-2.5 text-emerald-400 font-medium">{t.realizado}</td>
                          <td className="px-3 py-2.5 text-blue-300">{t.agendado}</td>
                          <td className="px-3 py-2.5 text-yellow-300">{t.sem_agendamento}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-white/10 rounded-full h-1.5 min-w-[60px]">
                                <div className="bg-emerald-400 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className={`font-semibold ${Number(pct) >= 80 ? "text-emerald-400" : "text-yellow-300"}`}>{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {/* ── Atividades sem agendamento — O135 ─────────────────────── */}
        {data.sem_agendamento > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-xs font-semibold text-blue-200/50 uppercase tracking-widest">Atividades Sem Agendamento — O135</h2>
                <p className="text-xs text-blue-200/35 mt-0.5">{data.sem_agendamento} atividades pendentes</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-yellow-400/15 text-yellow-300 border border-yellow-400/25">
                {data.sem_agendamento} pendentes
              </span>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      {["Item","Empresa (Regulado)","Gerência","Setor","Prioridade","Pendências"].map(h => (
                        <th key={h} className="text-left px-3 py-2.5 font-medium text-blue-200/60 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {pendingVisible.map((p, i) => {
                      const pends = [];
                      if (p.sem_giaso) pends.push("GIASO");
                      if (p.sem_pcdp) pends.push("PCDP");
                      if (p.sem_processo) pends.push("Processo");
                      return (
                        <tr key={i} className="hover:bg-white/5 transition-colors">
                          <td className="px-3 py-2 font-mono text-blue-300">{p.item ?? "—"}</td>
                          <td className="px-3 py-2 text-blue-100/70 max-w-[200px] truncate">{p.regulado ?? <span className="text-white/25 italic">Sem info</span>}</td>
                          <td className="px-3 py-2 text-blue-100/70 whitespace-nowrap">{p.gerencia ?? "—"}</td>
                          <td className="px-3 py-2 text-blue-100/70 whitespace-nowrap">{p.setor ?? "—"}</td>
                          <td className="px-3 py-2">
                            {p.prioridade === "A"
                              ? <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-red-400/15 text-red-400 border border-red-400/25">Alta</span>
                              : <span className="text-blue-100/60">{p.prioridade ?? "—"}</span>}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1 flex-wrap">
                              {pends.length === 0
                                ? <span className="text-white/20 italic">—</span>
                                : pends.map(pd => (
                                  <span key={pd} className="px-1.5 py-0.5 rounded text-xs font-medium bg-red-400/15 text-red-400 border border-red-400/25">{pd}</span>
                                ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {data.pending_detail.length > 10 && (
                <button onClick={() => setShowAllPending(v => !v)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs text-blue-200/50 hover:text-blue-200 transition-colors border-t border-white/5">
                  {showAllPending
                    ? <><ChevronUp className="w-3.5 h-3.5" /> Mostrar menos</>
                    : <><ChevronDown className="w-3.5 h-3.5" /> Ver todos os {data.pending_detail.length} itens</>}
                </button>
              )}
            </div>
          </section>
        )}

        {/* ── Empresas com mais atividades ────────────────────────────── */}
        {data.top_companies.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-blue-200/50 uppercase tracking-widest mb-3">Empresas com Mais Atividades</h2>
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <Reveal height={Math.max(200, data.top_companies.length * 28)}>
              <ResponsiveContainer width="100%" height={Math.max(200, data.top_companies.length * 28)}>
                <BarChart data={data.top_companies.map(c => ({ ...c, empresa: shortName(c.empresa) }))}
                  layout="vertical" margin={{ top: 0, right: 40, left: 8, bottom: 0 }} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "rgba(147,197,253,0.5)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="empresa" width={160} tick={{ fill: "rgba(147,197,253,0.7)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                  <Bar dataKey="total" name="Atividades" radius={[0,4,4,0]} animationDuration={900} animationEasing="ease-out">
                    {data.top_companies.map((_, i) => <Cell key={i} fill={COMPANY_COLORS[i % COMPANY_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              </Reveal>
            </div>
          </section>
        )}

        {/* ── Empresas com menos atividades ───────────────────────────── */}
        {data.bottom_companies.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-blue-200/50 uppercase tracking-widest mb-3">Empresas com Menos Atividades</h2>
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <Reveal height={Math.max(200, data.bottom_companies.length * 28)}>
              <ResponsiveContainer width="100%" height={Math.max(200, data.bottom_companies.length * 28)}>
                <BarChart data={data.bottom_companies.map(c => ({ ...c, empresa: shortName(c.empresa) }))}
                  layout="vertical" margin={{ top: 0, right: 40, left: 8, bottom: 0 }} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "rgba(147,197,253,0.5)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="empresa" width={160} tick={{ fill: "rgba(147,197,253,0.7)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                  <Bar dataKey="total" name="Atividades" radius={[0,4,4,0]} animationDuration={900} animationEasing="ease-out">
                    {data.bottom_companies.map((_, i) => <Cell key={i} fill={COMPANY_COLORS[(i+5) % COMPANY_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              </Reveal>
            </div>
          </section>
        )}

        {/* ── Pendências por empresa ───────────────────────────────────── */}
        {data.pending_by_company.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-blue-200/50 uppercase tracking-widest mb-3">Sem Agendamento por Empresa</h2>
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <Reveal height={Math.max(200, data.pending_by_company.length * 30)}>
              <ResponsiveContainer width="100%" height={Math.max(200, data.pending_by_company.length * 30)}>
                <BarChart data={data.pending_by_company.map(c => ({ ...c, empresa: shortName(c.empresa) }))}
                  layout="vertical" margin={{ top: 0, right: 40, left: 8, bottom: 0 }} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: "rgba(147,197,253,0.5)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="empresa" width={160} tick={{ fill: "rgba(147,197,253,0.7)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                  <Bar dataKey="pendentes" name="Sem agendamento" radius={[0,4,4,0]} animationDuration={900} animationEasing="ease-out">
                    {data.pending_by_company.map((_, i) => <Cell key={i} fill={i === 0 ? "#f87171" : "#fbbf24"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              </Reveal>
            </div>
          </section>
        )}

        {/* ── Gráfico consolidado ─────────────────────────────────────── */}
        {data.top_companies.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-blue-200/50 uppercase tracking-widest mb-3">Consolidado — Total vs Pendentes por Empresa</h2>
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <Reveal height={300}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={(() => {
                    const pendMap = Object.fromEntries(data.pending_by_company.map(p => [p.empresa, p.pendentes]));
                    return data.top_companies.slice(0, 10).map(c => ({
                      empresa: shortName(c.empresa, 18),
                      realizadas: c.total - (pendMap[c.empresa] ?? 0),
                      pendentes: pendMap[c.empresa] ?? 0,
                    }));
                  })()}
                  margin={{ top: 8, right: 20, left: 0, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="empresa" tick={{ fill: "rgba(147,197,253,0.6)", fontSize: 9 }} angle={-35} textAnchor="end" interval={0} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(147,197,253,0.5)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                  <Legend wrapperStyle={{ paddingTop: 8 }} formatter={v => <span className="text-xs text-blue-200/70">{v}</span>} />
                  <Bar dataKey="realizadas" name="Realizadas + Agendadas" stackId="a" fill="#34d399" stroke="#0d2247" strokeWidth={1}
                    animationDuration={900} animationEasing="ease-out" />
                  <Bar dataKey="pendentes" name="Sem agendamento" stackId="a" fill="#fbbf24" radius={[4,4,0,0]} stroke="#0d2247" strokeWidth={1}
                    animationBegin={200} animationDuration={900} animationEasing="ease-out" />
                </BarChart>
              </ResponsiveContainer>
              </Reveal>
            </div>
          </section>
        )}

        {/* ── Alertas ─────────────────────────────────────────────────── */}
        {data.top_alerts.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-blue-200/50 uppercase tracking-widest mb-3">Principais Alertas</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.top_alerts.map(alert => (
                <div key={alert.key} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-4">
                  <AlertTriangle className="w-4 h-4 text-yellow-300 flex-shrink-0" />
                  <p className="text-sm font-medium text-white flex-1">{alert.label}</p>
                  <span className="text-lg font-bold text-yellow-300">{alert.count}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* empty state */}
        {data.total_activities === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-blue-200/40">
            <TrendingUp className="w-10 h-10" />
            <p className="text-sm font-medium">Nenhuma atividade disponível{selectedId !== "all" ? " para esta análise" : " ainda"}.</p>
            {selectedId !== "all"
              ? <button onClick={() => setSelectedId("all")} className="text-sm text-blue-300 hover:text-white font-medium transition-colors">Ver todas as análises →</button>
              : <Link href="/upload" className="text-sm text-blue-300 hover:text-white font-medium transition-colors">Importar primeira planilha →</Link>
            }
          </div>
        )}

      </main>
      <AppFooter />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardInner />
    </Suspense>
  );
}
