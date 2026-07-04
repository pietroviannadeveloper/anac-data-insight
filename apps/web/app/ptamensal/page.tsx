"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import AppHeader from "@/components/layout/AppHeader";
import AppFooter from "@/components/layout/AppFooter";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SkeletonDashboard } from "@/components/ui/Skeleton";
import { useCountUp } from "@/hooks/useCountUp";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";
import {
  Upload,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Search,
  RefreshCw,
  BarChart2,
  TrendingUp,
  TrendingDown,
  Minus,
  History,
  Filter,
  CalendarDays,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

const TIPOS = [
  { value: "CICLO_BASE", label: "Ciclo Base" },
  { value: "CICLO_DESEMPENHO", label: "Desempenho" },
  { value: "CONTROLE_PTA", label: "Controle PTA" },
  { value: "PTA_FINAL", label: "PTA Final" },
  { value: "NAO_INFORMADA", label: "Não Informadas" },
];

const TIPO_COLORS: Record<string, string> = {
  CICLO_BASE: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  CICLO_DESEMPENHO: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  CONTROLE_PTA: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  PTA_FINAL: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  NAO_INFORMADA: "bg-orange-500/20 text-orange-300 border-orange-500/30",
};

const STATUS_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  realizado: { label: "Realizado", color: "text-emerald-400", icon: <CheckCircle2 className="w-3 h-3" /> },
  agendado: { label: "Agendado", color: "text-blue-400", icon: <Clock className="w-3 h-3" /> },
  "sem-agendamento": { label: "Sem Agendamento", color: "text-orange-400", icon: <XCircle className="w-3 h-3" /> },
};

const MESES = [
  "", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const PIE_COLORS = ["#34d399", "#60a5fa", "#f97316"];

interface Upload {
  id: string;
  tipo: string;
  filename: string;
  total_rows: number;
  created_at: string;
  indicators: Record<string, unknown>;
}

interface Summary {
  total_uploads: number;
  tipos_carregados: string[];
  indicadores_por_tipo: Record<string, Record<string, unknown>>;
  consolidado: ConsolidatedBI;
}

interface ConsolidatedBI {
  total_planejado: number;
  total_realizado: number;
  total_agendado: number;
  total_sem_agendamento: number;
  total_remanejados: number;
  taxa_execucao: number;
  taxa_agendamento: number;
  planejado_por_mes: Record<string, number>;
  realizado_por_mes: Record<string, number>;
  agendado_por_mes: Record<string, number>;
  por_gerencia: Array<{ gerencia: string; total: number; realizado: number; agendado: number; remanejado: number; taxa: number }>;
  por_cidade: Array<{ cidade: string; total: number }>;
  por_servidor: Array<{ servidor: string; total: number; realizado: number; agendado: number; sem_agendamento: number; remanejado: number; taxa: number; cidades_mes_vigente: string[] }>;
  planejado_ate_mes_atual: number;
  realizado_ate_mes_atual: number;
  situacao_cronograma: "adiantado" | "atrasado" | "dentro_do_previsto";
  sem_giaso: number;
  sem_pcdp: number;
  sem_pcdp_valida: number;
  sem_processo: number;
  locais_indefinidos: number;
  pcdp_por_tipo: Record<string, number>;
  total_com_pcdp_valida: number;
  unique_pcdps: number;
  pcdp_duplicadas: number;
  por_pcdp: Array<{ pcdp: string; total: number }>;
  mes_vigente: number;
  total_mes_vigente: number;
  realizadas_mes_vigente: number;
  agendadas_mes_vigente: number;
  sem_agendamento_mes_vigente: number;
}

interface Activity {
  id: string;
  item: string;
  atividade: string;
  gerencia: string;
  setor: string;
  regulado: string;
  cidade: string;
  servidor: string;
  mes: string;
  mes_agendado: string;
  mes_realizado: string;
  mes_num: number;
  giaso: string;
  processo: string;
  pcdp: string;
  prioridade: string;
  status: string;
  sem_giaso: number;
  sem_pcdp: number;
  sem_processo: number;
  local_indefinido: number;
  tipo_ciclo: string;
}

interface ActivitiesPage {
  items: Activity[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TipoBadge({ tipo }: { tipo: string }) {
  const label = TIPOS.find((t) => t.value === tipo)?.label ?? tipo;
  return (
    <span className={`text-xs px-2 py-0.5 rounded border font-medium ${TIPO_COLORS[tipo] ?? "bg-white/10 text-white/60 border-white/20"}`}>
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, color: "text-white/50", icon: null };
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${meta.color}`}>
      {meta.icon}{meta.label}
    </span>
  );
}

function SituacaoBadge({ situacao }: { situacao: string }) {
  if (situacao === "adiantado") return <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium"><TrendingUp className="w-3.5 h-3.5" />Adiantado</span>;
  if (situacao === "atrasado") return <span className="flex items-center gap-1 text-xs text-red-400 font-medium"><TrendingDown className="w-3.5 h-3.5" />Atrasado</span>;
  return <span className="flex items-center gap-1 text-xs text-blue-300 font-medium"><Minus className="w-3.5 h-3.5" />Dentro do previsto</span>;
}

/** "rafael.koeler" → "Rafael Koeler" */
function formatServidor(s: string): string {
  return s.replace(/\./g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const PCDP_TIPO_META: Record<string, { label: string; color: string }> = {
  valida:    { label: "Válida",    color: "text-emerald-400" },
  remota:    { label: "Remota",    color: "text-blue-300" },
  cancelada: { label: "Cancelada", color: "text-red-400" },
  especial:  { label: "Especial",  color: "text-yellow-400" },
  vazia:     { label: "Vazia",     color: "text-white/30" },
};

function KpiCard({ label, value, sub, color = "text-white" }: { label: string; value: number; sub?: string; color?: string }) {
  const animated = useCountUp(value);
  return (
    <div className="bg-white/4 rounded-xl border border-white/8 px-5 py-4">
      <p className="text-blue-200/50 text-xs mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{animated}</p>
      {sub && <p className="text-white/30 text-xs mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PTAMensalPage() {
  const router = useRouter();

  // uploads
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loadingUploads, setLoadingUploads] = useState(true);

  // summary/BI
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  // activities
  const [activities, setActivities] = useState<ActivitiesPage | null>(null);
  const [loadingActs, setLoadingActs] = useState(false);

  // upload form
  const [uploading, setUploading] = useState(false);
  const [uploadTipo, setUploadTipo] = useState(TIPOS[0].value);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // filters
  const [filterMes, setFilterMes] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterGerencia, setFilterGerencia] = useState<string>("");
  const [filterCidade, setFilterCidade] = useState<string>("");
  const [filterServidor, setFilterServidor] = useState<string>("");
  const [filterTipo, setFilterTipo] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [filterDiaVigente, setFilterDiaVigente] = useState(false);
  const [filterMesVigente, setFilterMesVigente] = useState(false);
  const [page, setPage] = useState(1);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; tipo: string } | null>(null);

  // Guard: admin only for upload actions, but all authenticated users can view
  const isAdmin = auth.isAdmin();

  useEffect(() => {
    if (!auth.isAuthenticated()) router.replace("/login");
  }, [router]);

  const fetchUploads = useCallback(async () => {
    setLoadingUploads(true);
    try {
      const data: Upload[] = await api.get("/api/v1/pta-mensal/uploads");
      setUploads(data);
    } catch {
      toast.error("Não foi possível carregar os uploads.");
    } finally {
      setLoadingUploads(false);
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const data: Summary = await api.get("/api/v1/pta-mensal/summary");
      setSummary(data);
    } catch {
      // summary might be empty — not fatal
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  const fetchActivities = useCallback(async () => {
    setLoadingActs(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("page_size", "50");
      if (filterMes) params.set("mes", filterMes);
      if (filterStatus) params.set("status", filterStatus);
      if (filterGerencia) params.set("gerencia", filterGerencia);
      if (filterCidade) params.set("cidade", filterCidade);
      if (filterServidor) params.set("servidor", filterServidor);
      if (filterTipo) params.set("tipo", filterTipo);
      if (search) params.set("search", search);
      if (filterDiaVigente) params.set("dia_vigente", "true");
      else if (filterMesVigente) params.set("mes_vigente", "true");
      const data: ActivitiesPage = await api.get(`/api/v1/pta-mensal/activities?${params}`);
      setActivities(data);
    } catch {
      setActivities(null);
    } finally {
      setLoadingActs(false);
    }
  }, [page, filterMes, filterStatus, filterGerencia, filterCidade, filterServidor, filterTipo, search, filterDiaVigente, filterMesVigente]);

  useEffect(() => { fetchUploads(); fetchSummary(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { fetchActivities(); }, [fetchActivities]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);
    try {
      const form = new FormData();
      form.append("tipo", uploadTipo);
      form.append("file", file);
      const data = await api.uploadForm("/api/v1/pta-mensal/upload", form);
      const msg = data.message ?? "Planilha enviada com sucesso.";
      setUploadSuccess(msg);
      toast.success(msg);
      if (fileRef.current) fileRef.current.value = "";
      await fetchUploads();
      await fetchSummary();
      fetchActivities();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar planilha.";
      setUploadError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setConfirmDelete(null);
    try {
      await api.delete(`/api/v1/pta-mensal/uploads/${id}`);
      toast.success("Planilha excluída com sucesso.");
      await fetchUploads();
      await fetchSummary();
      fetchActivities();
    } catch {
      toast.error("Erro ao excluir upload. Tente novamente.");
    } finally {
      setDeletingId(null);
    }
  }

  function resetFilters() {
    setFilterMes(""); setFilterStatus(""); setFilterGerencia("");
    setFilterCidade(""); setFilterServidor(""); setFilterTipo("");
    setSearch(""); setFilterDiaVigente(false); setFilterMesVigente(false);
    setPage(1);
  }

  const bi = summary?.consolidado;

  // Build monthly chart data
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    return {
      mes: MESES[m],
      "Planejado (PTA)": (bi?.planejado_por_mes ?? {})[String(m)] ?? 0,
      Realizado: (bi?.realizado_por_mes ?? {})[String(m)] ?? 0,
      Agendado: (bi?.agendado_por_mes ?? {})[String(m)] ?? 0,
    };
  });

  // Status pie data
  const pieData = bi ? [
    { name: "Realizado", value: bi.total_realizado },
    { name: "Agendado", value: bi.total_agendado },
    { name: "Sem Agend.", value: bi.total_sem_agendamento },
  ] : [];

  const mesAtual = new Date().getMonth() + 1;

  return (
    <div className="flex flex-col min-h-screen bg-[#001E3C]">
      <AppHeader />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">

        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link href="/pta" className="text-blue-200/40 hover:text-blue-200/70 transition-colors">
                <History className="w-4 h-4" />
              </Link>
              <span className="text-white/20 text-sm">/</span>
              <CalendarDays className="w-5 h-5 text-blue-400" />
              <h1 className="text-xl font-bold text-white">Acompanhamento PTA 2026</h1>
            </div>
            <p className="text-blue-200/50 text-sm">
              Dashboard de execução mensal, indicadores e gestão de planilhas do PTA vigente.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-400/20 text-blue-300">
              Mês atual: <strong>{MESES[mesAtual]}</strong>
            </span>
            <button
              onClick={() => { fetchSummary(); fetchActivities(); }}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white/80 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>


        {/* ── Upload section ─────────────────────────────────────── */}
        <section className="mb-8 bg-white/4 rounded-xl border border-white/8 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Upload className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-semibold text-white">Planilhas do PTA 2026</h2>
            <span className="text-xs text-white/30">Substituir planilha: envie uma nova do mesmo tipo</span>
          </div>

          {/* Current uploads */}
          {loadingUploads ? (
            <div className="flex items-center gap-2 text-blue-200/40 text-sm py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
              {TIPOS.map((t) => {
                const u = uploads.find((x) => x.tipo === t.value);
                return (
                  <div key={t.value} className={`rounded-lg border px-4 py-3 ${u ? "border-white/15 bg-white/3" : "border-white/6 bg-white/2 opacity-60"}`}>
                    <div className="flex items-center justify-between mb-1">
                      <TipoBadge tipo={t.value} />
                      {u && isAdmin && (
                        <button
                          onClick={() => setConfirmDelete({ id: u.id, tipo: t.label })}
                          disabled={deletingId === u.id}
                          className="p-1 rounded hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-colors disabled:opacity-40"
                          title="Excluir planilha"
                        >
                          {deletingId === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                    {u ? (
                      <>
                        <p className="text-white/70 text-xs truncate mt-1">{u.filename}</p>
                        <p className="text-white/30 text-xs">{u.total_rows.toLocaleString("pt-BR")} atividades</p>
                        <p className="text-white/20 text-xs">{new Date(u.created_at).toLocaleDateString("pt-BR")}</p>
                      </>
                    ) : (
                      <p className="text-white/30 text-xs mt-1">Nenhuma planilha enviada</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Upload form (admin only) */}
          {isAdmin && (
            <form onSubmit={handleUpload} className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
              <div>
                <label className="block text-xs text-white/40 mb-1">Tipo</label>
                <select
                  value={uploadTipo}
                  onChange={(e) => setUploadTipo(e.target.value)}
                  className="bg-[#0a1929] [color-scheme:dark] border border-white/15 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400/60"
                >
                  {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs text-white/40 mb-1">Arquivo (.xlsx, .xls, .csv)</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  required
                  className="block w-full text-sm text-white/70 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-blue-500/20 file:text-blue-300 file:text-xs file:font-medium hover:file:bg-blue-500/30 file:cursor-pointer cursor-pointer"
                />
              </div>
              <button
                type="submit"
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-50 shrink-0"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? "Enviando..." : "Enviar"}
              </button>
            </form>
          )}
          {uploadError && (
            <p className="mt-2 text-red-400 text-xs flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />{uploadError}
            </p>
          )}
          {uploadSuccess && (
            <p className="mt-2 text-emerald-400 text-xs flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />{uploadSuccess}
            </p>
          )}
        </section>

        {/* ── BI Dashboard ───────────────────────────────────────── */}
        {loadingSummary ? (
          <div className="py-6"><SkeletonDashboard /></div>
        ) : !bi || !bi.total_planejado ? (
          <div className="text-center py-16 text-blue-200/30">
            <BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhuma planilha enviada.</p>
            <p className="text-xs mt-1">Faça upload de uma planilha acima para visualizar os indicadores.</p>
          </div>
        ) : (
          <>
            {/* KPI cards — geral */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
              <KpiCard label="Total Planejado"    value={bi.total_planejado ?? 0}    color="text-white" />
              <KpiCard label="Realizado"           value={bi.total_realizado ?? 0}    color="text-emerald-400"
                sub={`${(bi.taxa_execucao ?? 0).toFixed(1)}% do total`} />
              <KpiCard label="Agendado"            value={bi.total_agendado ?? 0}     color="text-blue-300" />
              <KpiCard label="Sem Agendamento"     value={bi.total_sem_agendamento ?? 0} color="text-orange-400" />
              <div className="bg-white/4 rounded-xl border border-white/8 px-5 py-4">
                <p className="text-blue-200/50 text-xs mb-1">Cronograma</p>
                <SituacaoBadge situacao={bi.situacao_cronograma} />
                <p className="text-white/30 text-xs mt-1">
                  {bi.realizado_ate_mes_atual ?? 0} de {bi.planejado_ate_mes_atual ?? 0} até {MESES[mesAtual]}
                </p>
              </div>
            </div>

            {/* KPI cards — mês vigente */}
            <div className="mb-8 bg-blue-500/5 border border-blue-400/15 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-semibold text-white">
                  {MESES[mesAtual]} (mês vigente)
                </span>
                <button
                  onClick={() => { setFilterDiaVigente(true); setFilterMesVigente(false); setPage(1); }}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1 text-xs bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 text-blue-300 rounded-lg transition-colors font-medium"
                >
                  <Filter className="w-3 h-3" /> Ver atividades do mês
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white/4 rounded-lg px-4 py-3">
                  <p className="text-blue-200/40 text-xs mb-0.5">Atividades no mês</p>
                  <p className="text-white font-bold tabular-nums">{(bi.total_mes_vigente ?? 0).toLocaleString("pt-BR")}</p>
                </div>
                <div className="bg-white/4 rounded-lg px-4 py-3">
                  <p className="text-blue-200/40 text-xs mb-0.5">Realizadas</p>
                  <p className="text-emerald-400 font-bold tabular-nums">{bi.realizadas_mes_vigente ?? 0}</p>
                </div>
                <div className="bg-white/4 rounded-lg px-4 py-3">
                  <p className="text-blue-200/40 text-xs mb-0.5">Agendadas</p>
                  <p className="text-blue-300 font-bold tabular-nums">{bi.agendadas_mes_vigente ?? 0}</p>
                </div>
                <div className="bg-white/4 rounded-lg px-4 py-3">
                  <p className="text-blue-200/40 text-xs mb-0.5">Sem Agendamento</p>
                  <p className="text-orange-400 font-bold tabular-nums">{bi.sem_agendamento_mes_vigente ?? 0}</p>
                </div>
              </div>
            </div>

            {/* Execution rate bar */}
            <div className="mb-8 bg-white/4 rounded-xl border border-white/8 p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-white">Taxa de Execução Geral</span>
                <span className={`text-2xl font-bold tabular-nums ${(bi.taxa_execucao ?? 0) >= 70 ? "text-emerald-400" : (bi.taxa_execucao ?? 0) >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                  {(bi.taxa_execucao ?? 0).toFixed(1)}%
                </span>
              </div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${bi.taxa_execucao >= 70 ? "bg-emerald-500" : bi.taxa_execucao >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
                  style={{ width: `${Math.min(bi.taxa_execucao ?? 0, 100)}%` }}
                />
              </div>
              <div className="flex gap-4 mt-3 text-xs text-white/40">
                <span>Taxa de Agendamento: <strong className="text-white/60">{(bi.taxa_agendamento ?? 0).toFixed(1)}%</strong></span>
                <span>Sem GIASO: <strong className="text-orange-400/80">{bi.sem_giaso ?? 0}</strong></span>
                <span>Sem PCDP: <strong className="text-orange-400/80">{bi.sem_pcdp ?? 0}</strong></span>
                <span>Sem Processo: <strong className="text-orange-400/80">{bi.sem_processo ?? 0}</strong></span>
              </div>
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Monthly bar chart */}
              <div className="lg:col-span-2 bg-white/4 rounded-xl border border-white/8 p-5">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white/80">Planejado × Realizado por Mês</h3>
                  <span className="text-[10px] text-white/25 text-right leading-tight">
                    Planejado = coluna <em>Mes</em> original do PTA
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthlyData} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="mes" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "#0a1929", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: "rgba(255,255,255,0.7)" }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }} />
                    <Bar dataKey="Planejado (PTA)" fill="#6366f1" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Realizado"       fill="#34d399" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Agendado"        fill="#60a5fa" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Status pie */}
              <div className="bg-white/4 rounded-xl border border-white/8 p-5">
                <h3 className="text-sm font-semibold text-white/80 mb-4">Distribuição de Status</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={pieData.filter((d) => d.value > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      dataKey="value"
                      paddingAngle={2}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#0a1929", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-2">
                  {pieData.map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: PIE_COLORS[i] }} />
                        <span className="text-white/50">{d.name}</span>
                      </span>
                      <span className="text-white/70 font-medium tabular-nums">{d.value.toLocaleString("pt-BR")}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Por Gerência chart */}
            {bi.por_gerencia.length > 0 && (
              <div className="mb-8 bg-white/4 rounded-xl border border-white/8 p-5">
                <h3 className="text-sm font-semibold text-white/80 mb-4">Execução por Gerência</h3>
                <ResponsiveContainer width="100%" height={Math.max(180, bi.por_gerencia.slice(0, 12).length * 32)}>
                  <BarChart
                    data={bi.por_gerencia.slice(0, 12).map((g) => ({ name: g.gerencia, Total: g.total, Realizado: g.realizado }))}
                    layout="vertical"
                    barCategoryGap="20%"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={150} tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "#0a1929", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }} />
                    <Bar dataKey="Total" fill="#3b82f6" radius={[0, 3, 3, 0]} />
                    <Bar dataKey="Realizado" fill="#34d399" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Servidores table */}
            {bi.por_servidor.length > 0 && (
              <div className="mb-8 bg-white/4 rounded-xl border border-white/8 overflow-hidden">
                <div className="px-5 py-3 border-b border-white/8">
                  <h3 className="text-sm font-semibold text-white/80">Servidores</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/8 text-xs text-white/40">
                        <th className="px-4 py-2 text-left font-medium">Servidor (GIASO)</th>
                        <th className="px-4 py-2 text-right font-medium">Login</th>
                        <th className="px-4 py-2 text-left font-medium">Local em {MESES[mesAtual]}</th>
                        <th className="px-4 py-2 text-right font-medium">Total</th>
                        <th className="px-4 py-2 text-right font-medium">Realizado</th>
                        <th className="px-4 py-2 text-right font-medium">Agendado</th>
                        <th className="px-4 py-2 text-right font-medium">Sem Agend.</th>
                        <th className="px-4 py-2 text-right font-medium">Taxa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bi.por_servidor.slice(0, 20).map((s) => (
                        <tr key={s.servidor} className="border-b border-white/5 hover:bg-white/4 transition-colors">
                          <td className="px-4 py-2 text-white/80 font-medium">{formatServidor(s.servidor)}</td>
                          <td className="px-4 py-2 text-right text-white/40 text-[10px] font-mono">{s.servidor}</td>
                          <td className="px-4 py-2">
                            {(s.cidades_mes_vigente ?? []).length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {s.cidades_mes_vigente.map((c) => (
                                  <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-400/20 whitespace-nowrap">
                                    {c}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-white/25 text-xs italic">Sem local de atividade este mês</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right text-white/60 tabular-nums">{s.total}</td>
                          <td className="px-4 py-2 text-right text-emerald-400 tabular-nums">{s.realizado}</td>
                          <td className="px-4 py-2 text-right text-blue-300 tabular-nums">{s.agendado ?? 0}</td>
                          <td className="px-4 py-2 text-right text-orange-400 tabular-nums">{s.sem_agendamento ?? 0}</td>
                          <td className="px-4 py-2 text-right tabular-nums">
                            <span className={s.taxa >= 70 ? "text-emerald-400" : s.taxa >= 50 ? "text-yellow-400" : "text-red-400"}>
                              {s.taxa.toFixed(0)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PCDP stats */}
            {bi && (bi.total_com_pcdp_valida ?? 0) + Object.values(bi.pcdp_por_tipo ?? {}).reduce((a,b) => a+b, 0) > 0 && (
              <div className="mb-8 bg-white/4 rounded-xl border border-white/8 overflow-hidden">
                <div className="px-5 py-3 border-b border-white/8">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-sm font-semibold text-white/80">PCDPs</h3>
                    <span className="text-xs text-white/30">
                      {bi.unique_pcdps ?? 0} números únicos · {bi.pcdp_duplicadas ?? 0} duplicadas
                    </span>
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    {Object.entries(bi.pcdp_por_tipo ?? {}).map(([tipo, count]) => count > 0 && (
                      <span key={tipo} className="flex items-center gap-1.5 text-xs">
                        <span className={PCDP_TIPO_META[tipo]?.color ?? "text-white/40"}>
                          {PCDP_TIPO_META[tipo]?.label ?? tipo}:
                        </span>
                        <strong className="text-white/70 tabular-nums">{count}</strong>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="overflow-x-auto max-h-52 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-[#001E3C]">
                      <tr className="border-b border-white/8 text-white/40">
                        <th className="px-4 py-2 text-left font-medium">PCDP</th>
                        <th className="px-4 py-2 text-right font-medium">Ocorrências</th>
                        <th className="px-4 py-2 text-left font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(bi.por_pcdp ?? []).map((p) => (
                        <tr key={p.pcdp} className="border-b border-white/5 hover:bg-white/4 transition-colors">
                          <td className="px-4 py-1.5 text-white/70 font-mono text-[11px]">{p.pcdp}</td>
                          <td className="px-4 py-1.5 text-right text-white/60 tabular-nums">{p.total}</td>
                          <td className="px-4 py-1.5">
                            {p.total > 1 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-300 border border-yellow-500/20">duplicada</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Activities Table ────────────────────────────────────── */}
        <section className="bg-white/4 rounded-xl border border-white/8 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/8">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Filter className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-semibold text-white">Atividades</h2>
                {activities && <span className="text-xs text-white/30">{activities.total.toLocaleString("pt-BR")} registros</span>}
              </div>
              {/* Filtros rápidos de período */}
              <div className="flex gap-2">
                <button
                  onClick={() => { setFilterDiaVigente(true); setFilterMesVigente(false); setFilterMes(""); setPage(1); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors ${filterDiaVigente ? "bg-blue-500/30 border-blue-400/50 text-blue-200" : "bg-white/5 border-white/10 text-white/50 hover:text-white/80 hover:bg-white/10"}`}
                >
                  <CalendarDays className="w-3.5 h-3.5" /> Dia vigente
                </button>
                <button
                  onClick={() => { setFilterMesVigente(true); setFilterDiaVigente(false); setFilterMes(""); setPage(1); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors ${filterMesVigente ? "bg-blue-500/30 border-blue-400/50 text-blue-200" : "bg-white/5 border-white/10 text-white/50 hover:text-white/80 hover:bg-white/10"}`}
                >
                  <CalendarDays className="w-3.5 h-3.5" /> Mês vigente
                </button>
              </div>
            </div>
            {(filterDiaVigente || filterMesVigente) && (
              <div className="mb-3 px-3 py-2 bg-blue-500/10 border border-blue-400/20 rounded-lg text-blue-300 text-xs flex items-center gap-2">
                <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                Mostrando atividades de <strong>{MESES[mesAtual]}</strong> — feitas e previstas para o período vigente.
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Buscar..."
                  className="w-full pl-8 pr-3 py-1.5 bg-white/5 border border-white/10 text-white text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400/40 placeholder:text-white/25"
                />
              </div>
              <select value={filterMes} onChange={(e) => { setFilterMes(e.target.value); setFilterDiaVigente(false); setFilterMesVigente(false); setPage(1); }}
                className="bg-[#0a1929] [color-scheme:dark] border border-white/10 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400/40">
                <option value="">Todos os meses</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>{MESES[m]}</option>
                ))}
              </select>
              <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                className="bg-[#0a1929] [color-scheme:dark] border border-white/10 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400/40">
                <option value="">Todos os status</option>
                <option value="realizado">Realizado</option>
                <option value="agendado">Agendado</option>
                <option value="sem-agendamento">Sem Agendamento</option>
              </select>
              <select value={filterTipo} onChange={(e) => { setFilterTipo(e.target.value); setPage(1); }}
                className="bg-[#0a1929] [color-scheme:dark] border border-white/10 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400/40">
                <option value="">Todos os tipos</option>
                {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <input
                value={filterGerencia}
                onChange={(e) => { setFilterGerencia(e.target.value); setPage(1); }}
                placeholder="Gerência..."
                className="px-3 py-1.5 bg-white/5 border border-white/10 text-white text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400/40 placeholder:text-white/25"
              />
              <button
                onClick={resetFilters}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white/80 text-xs rounded-lg transition-colors"
              >
                Limpar filtros
              </button>
            </div>
          </div>

          {loadingActs ? (
            <div className="flex items-center justify-center py-12 gap-2 text-blue-200/40">
              <Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">Carregando...</span>
            </div>
          ) : !activities || activities.items.length === 0 ? (
            <div className="text-center py-12 text-blue-200/30">
              <p className="text-sm">Nenhuma atividade encontrada.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/8 bg-white/3 text-white/40">
                      <th className="px-3 py-2.5 text-left font-medium">Item</th>
                      <th className="px-3 py-2.5 text-left font-medium">Atividade</th>
                      <th className="px-3 py-2.5 text-left font-medium">Gerência</th>
                      <th className="px-3 py-2.5 text-left font-medium">Regulado</th>
                      <th className="px-3 py-2.5 text-left font-medium">Cidade</th>
                      <th className="px-3 py-2.5 text-left font-medium">Servidor (GIASO)</th>
                      <th className="px-3 py-2.5 text-left font-medium">Processo</th>
                      <th className="px-3 py-2.5 text-left font-medium">PCDP</th>
                      <th className="px-3 py-2.5 text-left font-medium">Mês</th>
                      <th className="px-3 py-2.5 text-left font-medium">Status</th>
                      <th className="px-3 py-2.5 text-left font-medium">Tipo</th>
                      <th className="px-3 py-2.5 text-left font-medium">Pendências</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activities.items.map((a) => (
                      <tr key={a.id} className="border-b border-white/5 hover:bg-white/4 transition-colors">
                        <td className="px-3 py-2 text-white/50">{a.item ?? "—"}</td>
                        <td className="px-3 py-2 text-white/80 max-w-[200px] truncate">{a.atividade ?? "—"}</td>
                        <td className="px-3 py-2 text-white/60">{a.gerencia ?? "—"}</td>
                        <td className="px-3 py-2 text-white/60 max-w-[120px] truncate">{a.regulado ?? "—"}</td>
                        <td className="px-3 py-2 text-white/60">{a.cidade ?? "—"}</td>
                        <td className="px-3 py-2 text-white/70" title={a.servidor ?? ""}>{a.servidor ? formatServidor(a.servidor) : "—"}</td>
                        <td className="px-3 py-2 text-white/50 font-mono text-[11px]">{a.processo ?? "—"}</td>
                        <td className="px-3 py-2 text-white/50 font-mono text-[11px]">{a.pcdp ?? "—"}</td>
                        <td className="px-3 py-2 text-white/60 tabular-nums">{a.mes_num ? MESES[a.mes_num] : (a.mes ?? "—")}</td>
                        <td className="px-3 py-2"><StatusBadge status={a.status} /></td>
                        <td className="px-3 py-2"><TipoBadge tipo={a.tipo_ciclo} /></td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1 flex-wrap">
                            {a.sem_giaso === 1 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-300 border border-orange-500/20">Sem GIASO</span>}
                            {a.sem_pcdp === 1 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/20">Sem PCDP</span>}
                            {a.sem_processo === 1 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-300 border border-yellow-500/20">Sem Proc.</span>}
                            {a.local_indefinido === 1 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/40 border border-white/15">Local Indef.</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-4 py-3 border-t border-white/8 flex items-center justify-between">
                <span className="text-xs text-white/30">
                  Página {activities.page} de {activities.total_pages} — {activities.total.toLocaleString("pt-BR")} registros
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-1.5 rounded hover:bg-white/10 text-white/40 disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(activities.total_pages, p + 1))}
                    disabled={page >= activities.total_pages}
                    className="p-1.5 rounded hover:bg-white/10 text-white/40 disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </main>
      <AppFooter />

      <ConfirmDialog
        open={!!confirmDelete}
        title="Excluir planilha?"
        description={`A planilha "${confirmDelete?.tipo}" e todas as suas atividades serão removidas permanentemente. Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        danger
        loading={!!deletingId}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete.id)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
