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
import { AIChat } from "@/components/ui/AIChat";
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
  FileDown,
  FileSpreadsheet,
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

const FILTER_CHIPS: Array<{
  value: string;
  label: string;
  chipClass: string;
  activeClass: string;
}> = [
  {
    value: "",
    label: "Todos",
    chipClass: "border-white/15 text-white/40 hover:text-white/70 hover:border-white/30",
    activeClass: "bg-white/10 border-white/30 text-white/80",
  },
  {
    value: "CICLO_BASE",
    label: "Ciclo Base",
    chipClass: "border-blue-500/20 text-blue-300/50 hover:text-blue-300 hover:border-blue-500/40",
    activeClass: "bg-blue-500/20 border-blue-500/50 text-blue-300",
  },
  {
    value: "CICLO_DESEMPENHO",
    label: "Desempenho",
    chipClass: "border-purple-500/20 text-purple-300/50 hover:text-purple-300 hover:border-purple-500/40",
    activeClass: "bg-purple-500/20 border-purple-500/50 text-purple-300",
  },
  {
    value: "CONTROLE_PTA",
    label: "Controle PTA",
    chipClass: "border-teal-500/20 text-teal-300/50 hover:text-teal-300 hover:border-teal-500/40",
    activeClass: "bg-teal-500/20 border-teal-500/50 text-teal-300",
  },
  {
    value: "PTA_FINAL",
    label: "PTA Final",
    chipClass: "border-emerald-500/20 text-emerald-300/50 hover:text-emerald-300 hover:border-emerald-500/40",
    activeClass: "bg-emerald-500/20 border-emerald-500/50 text-emerald-300",
  },
  {
    value: "NAO_INFORMADA",
    label: "Não Informadas",
    chipClass: "border-orange-500/20 text-orange-300/50 hover:text-orange-300 hover:border-orange-500/40",
    activeClass: "bg-orange-500/20 border-orange-500/50 text-orange-300",
  },
  {
    value: "PTA_COMPLETO",
    label: "PTA Completo",
    chipClass: "border-indigo-400/20 text-indigo-300/50 hover:text-indigo-200 hover:border-indigo-400/40",
    activeClass: "bg-indigo-500/20 border-indigo-400/50 text-indigo-200",
  },
];

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
  por_tipo: Array<{ tipo: string; label: string; total: number; realizado: number; agendado: number; taxa: number }>;
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
  const [filterTipoBI, setFilterTipoBI] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [filterDiaVigente, setFilterDiaVigente] = useState(false);
  const [filterMesVigente, setFilterMesVigente] = useState(false);
  const [page, setPage] = useState(1);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; tipo: string } | null>(null);

  const [exportingReport, setExportingReport] = useState(false);
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Período selecionado para o dashboard (independente dos filtros da tabela)
  const [periodoMes, setPeriodoMes] = useState<number>(new Date().getMonth() + 1);
  const [periodoAnoCompleto, setPeriodoAnoCompleto] = useState(false);

  // Guard: admin only for upload actions, but all authenticated users can view
  useEffect(() => { setIsAdmin(auth.isAdmin()); }, []);

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

  const fetchSummary = useCallback(async (tipoFiltro = "") => {
    setLoadingSummary(true);
    try {
      const params = new URLSearchParams();
      if (tipoFiltro === "PTA_COMPLETO") {
        params.append("tipos", "CICLO_BASE");
        params.append("tipos", "CICLO_DESEMPENHO");
      } else if (tipoFiltro) {
        params.set("tipo", tipoFiltro);
      }
      const query = params.toString() ? `?${params}` : "";
      const data: Summary = await api.get(`/api/v1/pta-mensal/summary${query}`);
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
      if (filterTipo === "PTA_COMPLETO") {
        params.append("tipos", "CICLO_BASE");
        params.append("tipos", "CICLO_DESEMPENHO");
      } else if (filterTipo) {
        params.set("tipo", filterTipo);
      }
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

  useEffect(() => { fetchUploads(); fetchSummary(""); }, []);  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { fetchSummary(filterTipoBI); }, [filterTipoBI]);  // eslint-disable-line react-hooks/exhaustive-deps
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
      await fetchSummary(filterTipoBI);
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
      await fetchSummary(filterTipoBI);
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

  async function handleExportXlsx() {
    setExportingXlsx(true);
    try {
      const params = new URLSearchParams();
      if (filterMes) params.set("mes", filterMes);
      if (filterStatus) params.set("status", filterStatus);
      if (filterGerencia) params.set("gerencia", filterGerencia);
      if (filterCidade) params.set("cidade", filterCidade);
      if (filterServidor) params.set("servidor", filterServidor);
      if (filterTipo) params.set("tipo", filterTipo);
      if (search) params.set("search", search);
      if (filterDiaVigente) params.set("dia_vigente", "true");
      else if (filterMesVigente) params.set("mes_vigente", "true");
      const blob = await api.download(`/api/v1/pta-mensal/activities/export?${params}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `atividades-pta-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Planilha exportada com sucesso.");
    } catch {
      toast.error("Não foi possível exportar as atividades. Tente novamente.");
    } finally {
      setExportingXlsx(false);
    }
  }

  function handleExportGraficoMensal() {
    if (!bi) {
      toast.error("Nada para exportar ainda. Envie uma planilha do PTA primeiro.");
      return;
    }
    setExportingReport(true);
    try {
      // Usa o período selecionado no dashboard
      const mesNome    = mesNomeSel;
      const planejado  = planejadoSel;
      const realizado  = realizadoSel;
      const agendado   = agendadoSel;
      const semAgend   = semAgendSel;
      const taxaMes    = taxaSel;
      const planejadoAno = bi.total_planejado ?? 0;
      const realizadoAno = bi.total_realizado ?? 0;

      const SITUACAO_LABEL: Record<string, string> = {
        adiantado:        "Adiantado",
        atrasado:         "Atrasado",
        dentro_do_previsto: "No prazo",
      };
      const SITUACAO_BG: Record<string, string> = {
        adiantado:        "#065f46",
        atrasado:         "#7f1d1d",
        dentro_do_previsto: "#1e3a5f",
      };
      const SITUACAO_COLOR: Record<string, string> = {
        adiantado:        "#34d399",
        atrasado:         "#f87171",
        dentro_do_previsto: "#60a5fa",
      };
      const situacaoLabel = SITUACAO_LABEL[bi.situacao_cronograma] ?? "—";
      const situacaoBg    = SITUACAO_BG[bi.situacao_cronograma]    ?? "#1e3a5f";
      const situacaoCor   = SITUACAO_COLOR[bi.situacao_cronograma] ?? "#60a5fa";
      const corTaxa       = taxaMes >= 70 ? "#34d399" : taxaMes >= 50 ? "#facc15" : "#f87171";

      // ── Canvas ──────────────────────────────────────────────────────────────
      const W = 800, H = 440;
      const canvas = document.createElement("canvas");
      canvas.width  = W * 2;
      canvas.height = H * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas não suportado.");
      ctx.scale(2, 2);

      const F = "Arial, Helvetica, sans-serif";

      const desenhar = (logo: HTMLImageElement | null) => {
        // Fundo com gradiente sutil
        const bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, "#001529");
        bg.addColorStop(1, "#00203f");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        // Faixa superior colorida (4px)
        ctx.fillStyle = situacaoCor;
        ctx.fillRect(0, 0, W, 4);

        // ── Cabeçalho ───────────────────────────────────────────────────────
        let textX = 28;

        if (logo) {
          const logoH = 44;
          const logoW = Math.round(logo.naturalWidth * (logoH / logo.naturalHeight));
          ctx.drawImage(logo, 28, 12, logoW, logoH);
          textX = 28 + logoW + 16;
        }

        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.font = `12px ${F}`;
        ctx.fillText("PTA 2026", textX, 28);

        ctx.fillStyle = "#ffffff";
        ctx.font = `bold 22px ${F}`;
        const tituloExport = periodoAnoCompleto ? "Acompanhamento — Ano completo 2026" : `Acompanhamento — ${mesNome} de 2026`;
        ctx.fillText(tituloExport, textX, 54);

        // Badge de situação no canto direito
        ctx.fillStyle = situacaoBg;
        ctx.fillRect(W - 148, 14, 120, 40);
        ctx.fillStyle = situacaoCor;
        ctx.font = `bold 16px ${F}`;
        ctx.textAlign = "center";
        ctx.fillText(situacaoLabel, W - 88, 40);
        ctx.textAlign = "left";

        // Linha divisória
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(28, 72); ctx.lineTo(W - 28, 72); ctx.stroke();

        // ── Taxa grande (esquerda) ─────────────────────────────────────────
        const TAXA_X = 52, TAXA_Y = 200;
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = `14px ${F}`;
        ctx.fillText("Taxa de execução do mês", TAXA_X, 96);

        ctx.shadowColor = corTaxa;
        ctx.shadowBlur = 16;
        ctx.fillStyle = corTaxa;
        ctx.font = `bold 80px ${F}`;
        ctx.fillText(`${taxaMes.toFixed(1)}%`, TAXA_X, TAXA_Y);
        ctx.shadowBlur = 0;

        // Barra de progresso
        const PROG_Y = TAXA_Y + 20, PROG_W = 230, PROG_H = 10;
        ctx.fillStyle = "rgba(255,255,255,0.1)";
        ctx.fillRect(TAXA_X, PROG_Y, PROG_W, PROG_H);
        ctx.fillStyle = corTaxa;
        ctx.fillRect(TAXA_X, PROG_Y, Math.min(taxaMes / 100, 1) * PROG_W, PROG_H);

        // ── 4 KPIs (direita) ──────────────────────────────────────────────
        const KPI_X = 320, KPI_Y = 88;
        const kpis: Array<{ label: string; valor: number; cor: string; sub?: string }> = [
          { label: "Planejado no mês",  valor: planejado, cor: "#a5b4fc" },
          { label: "Realizado",         valor: realizado, cor: "#34d399", sub: `${planejado > 0 ? ((realizado / planejado) * 100).toFixed(0) : 0}% do mês` },
          { label: "Agendado",          valor: agendado,  cor: "#60a5fa" },
          { label: "Sem agendamento",   valor: semAgend,  cor: "#f87171" },
        ];
        const KPI_W = (W - KPI_X - 28 - 12 * 3) / 4;
        kpis.forEach((k, i) => {
          const x = KPI_X + i * (KPI_W + 12);
          ctx.fillStyle = "rgba(255,255,255,0.05)";
          ctx.fillRect(x, KPI_Y, KPI_W, 90);
          ctx.fillStyle = k.cor;
          ctx.fillRect(x, KPI_Y, KPI_W, 3);
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.font = `12px ${F}`;
          ctx.fillText(k.label, x + 10, KPI_Y + 22);
          ctx.fillStyle = k.cor;
          ctx.font = `bold 30px ${F}`;
          ctx.fillText(String(k.valor), x + 10, KPI_Y + 62);
          if (k.sub) {
            ctx.fillStyle = "rgba(255,255,255,0.35)";
            ctx.font = `11px ${F}`;
            ctx.fillText(k.sub, x + 10, KPI_Y + 80);
          }
        });

        // ── Barra empilhada ────────────────────────────────────────────────
        const STACK_Y = 236;
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = `13px ${F}`;
        ctx.fillText("Distribuição das atividades do mês", KPI_X, STACK_Y - 10);

        const STACK_W = W - KPI_X - 28;
        const STACK_H = 24;
        const total = Math.max(planejado, realizado + agendado + semAgend, 1);
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.fillRect(KPI_X, STACK_Y, STACK_W, STACK_H);
        let sx = KPI_X;
        ([[ realizado, "#34d399"], [agendado, "#60a5fa"], [semAgend, "#f87171"]] as Array<[number, string]>).forEach(([v, cor]) => {
          const w = (v / total) * STACK_W;
          ctx.fillStyle = cor;
          ctx.fillRect(sx, STACK_Y, w, STACK_H);
          sx += w;
        });

        let legX = KPI_X;
        ([["#34d399", "Realizado", realizado], ["#60a5fa", "Agendado", agendado], ["#f87171", "Sem agendamento", semAgend]] as Array<[string, string, number]>).forEach(([cor, lbl, v]) => {
          ctx.fillStyle = cor;
          ctx.fillRect(legX, STACK_Y + STACK_H + 10, 10, 10);
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.font = `12px ${F}`;
          ctx.fillText(`${lbl} (${v})`, legX + 16, STACK_Y + STACK_H + 20);
          legX += ctx.measureText(`${lbl} (${v})`).width + 36;
        });

        // ── Acumulado no ano ───────────────────────────────────────────────
        const ACC_Y = STACK_Y + STACK_H + 52;
        ctx.fillStyle = "rgba(255,255,255,0.1)";
        ctx.fillRect(KPI_X, ACC_Y, STACK_W, 1);

        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = `13px ${F}`;
        ctx.fillText(`Acumulado no ano até ${mesNome}:`, KPI_X, ACC_Y + 22);

        const taxaAno = planejadoAno > 0 ? (realizadoAno / planejadoAno) * 100 : 0;
        const corAno = taxaAno >= 70 ? "#34d399" : taxaAno >= 50 ? "#facc15" : "#f87171";
        ctx.fillStyle = "#ffffff";
        ctx.font = `14px ${F}`;
        ctx.fillText(`${realizadoAno} realizadas de ${planejadoAno} planejadas`, KPI_X, ACC_Y + 44);
        ctx.fillStyle = corAno;
        ctx.font = `bold 20px ${F}`;
        ctx.textAlign = "right";
        ctx.fillText(`${taxaAno.toFixed(1)}% executado no ano`, W - 28, ACC_Y + 44);
        ctx.textAlign = "left";

        // ── Rodapé ─────────────────────────────────────────────────────────
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.font = `12px ${F}`;
        ctx.fillText(`Gerado em ${new Date().toLocaleString("pt-BR")} — ANAC Data Insight`, 28, H - 14);

        canvas.toBlob((blob) => {
          if (!blob) {
            toast.error("Não foi possível gerar o relatório. Tente novamente.");
            setExportingReport(false);
            return;
          }
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          const slug = periodoAnoCompleto ? "ano-completo" : mesNome.toLowerCase();
          a.download = `pta-${slug}-2026.png`;
          a.style.display = "none";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast.success("Relatório exportado com sucesso.");
          setExportingReport(false);
        }, "image/png");
      };

      const logo = new Image();
      logo.onload  = () => desenhar(logo);
      logo.onerror = () => desenhar(null);
      logo.src = "/anac-logo.png";
    } catch {
      toast.error("Não foi possível gerar o relatório. Tente novamente.");
      setExportingReport(false);
    }
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

  // Métricas do período selecionado no dashboard
  const mesSel = periodoAnoCompleto ? null : periodoMes;
  const mesNomeSel = mesSel ? MESES[mesSel] : "Ano completo 2026";
  const planejadoSel = mesSel !== null
    ? (bi?.planejado_por_mes ?? {})[String(mesSel)] ?? 0
    : bi?.total_planejado ?? 0;
  const realizadoSel = mesSel !== null
    ? (bi?.realizado_por_mes ?? {})[String(mesSel)] ?? 0
    : bi?.total_realizado ?? 0;
  const agendadoSel = mesSel !== null
    ? (bi?.agendado_por_mes ?? {})[String(mesSel)] ?? 0
    : bi?.total_agendado ?? 0;
  const semAgendSel = Math.max(0, planejadoSel - realizadoSel - agendadoSel);
  const taxaSel = planejadoSel > 0 ? Math.round((realizadoSel / planejadoSel) * 1000) / 10 : 0;

  // Tendência: compara com o mês anterior (só quando um mês específico está selecionado)
  const mesPrev = mesSel !== null && mesSel > 1 ? mesSel - 1 : null;
  const planejadoPrev = mesPrev !== null ? (bi?.planejado_por_mes ?? {})[String(mesPrev)] ?? 0 : 0;
  const realizadoPrev = mesPrev !== null ? (bi?.realizado_por_mes ?? {})[String(mesPrev)] ?? 0 : 0;
  const taxaPrev = planejadoPrev > 0 ? Math.round((realizadoPrev / planejadoPrev) * 1000) / 10 : null;
  const taxaDelta = taxaPrev !== null ? Math.round((taxaSel - taxaPrev) * 10) / 10 : null;

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
          <div className="flex items-center gap-2 flex-wrap">
            {/* Seletor de período */}
            <div className="flex items-center gap-1.5 bg-white/4 border border-white/10 rounded-lg px-2 py-1">
              <CalendarDays className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="text-xs text-blue-200/50 font-medium">2026</span>
              <span className="text-white/15">·</span>
              <select
                value={periodoAnoCompleto ? "ano" : String(periodoMes)}
                onChange={(e) => {
                  if (e.target.value === "ano") {
                    setPeriodoAnoCompleto(true);
                  } else {
                    setPeriodoAnoCompleto(false);
                    setPeriodoMes(Number(e.target.value));
                  }
                }}
                className="bg-transparent text-xs text-white font-semibold focus:outline-none cursor-pointer pr-1"
              >
                <option value="ano" className="bg-[#001E3C]">Ano completo</option>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={String(i + 1)} className="bg-[#001E3C]">
                    {MESES[i + 1]}{i + 1 === mesAtual ? " (atual)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleExportXlsx}
              disabled={exportingXlsx || !activities?.total}
              title="Exportar atividades filtradas como planilha Excel"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/25 text-emerald-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {exportingXlsx ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
              {exportingXlsx ? "Exportando..." : "Exportar .xlsx"}
            </button>
            <button
              onClick={handleExportGraficoMensal}
              disabled={exportingReport || !bi}
              title="Exportar gráfico do mês como imagem PNG"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-500/15 hover:bg-blue-500/25 border border-blue-400/25 text-blue-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {exportingReport ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
              {exportingReport ? "Gerando gráfico..." : "Exportar gráfico mensal"}
            </button>
            <button
              onClick={() => { fetchSummary(filterTipoBI); fetchActivities(); }}
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
            <>
              <p className="text-xs text-white/25 mb-2">Clique em um tipo para filtrar o dashboard abaixo</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
                {TIPOS.map((t) => {
                  const u = uploads.find((x) => x.tipo === t.value);
                  const isActive = filterTipoBI === t.value;
                  const chip = FILTER_CHIPS.find((c) => c.value === t.value);
                  return (
                    <div
                      key={t.value}
                      onClick={() => u && setFilterTipoBI(isActive ? "" : t.value)}
                      className={`rounded-lg border px-4 py-3 transition-all ${
                        u ? "cursor-pointer" : "opacity-50 cursor-default"
                      } ${
                        isActive && chip
                          ? `${chip.activeClass} ring-1 ring-inset ring-current`
                          : u
                          ? "border-white/15 bg-white/3 hover:border-white/25 hover:bg-white/5"
                          : "border-white/6 bg-white/2"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <TipoBadge tipo={t.value} />
                        <div className="flex items-center gap-1">
                          {isActive && <span className="text-[10px] text-white/40">✓ filtrado</span>}
                          {u && isAdmin && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setConfirmDelete({ id: u.id, tipo: t.label }); }}
                              disabled={deletingId === u.id}
                              className="p-1 rounded hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-colors disabled:opacity-40"
                              title="Excluir planilha"
                            >
                              {deletingId === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
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
              {/* PTA Completo chip — combina Ciclo Base + Desempenho */}
              {uploads.some((u) => u.tipo === "CICLO_BASE") && uploads.some((u) => u.tipo === "CICLO_DESEMPENHO") && (
                <button
                  onClick={() => setFilterTipoBI(filterTipoBI === "PTA_COMPLETO" ? "" : "PTA_COMPLETO")}
                  className={`mb-5 flex items-center gap-2 px-4 py-2 rounded-lg border text-xs font-medium transition-all ${
                    filterTipoBI === "PTA_COMPLETO"
                      ? "bg-indigo-500/20 border-indigo-400/50 text-indigo-200 ring-1 ring-indigo-400/30"
                      : "bg-white/3 border-white/10 text-white/50 hover:text-white/80 hover:border-white/25"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${filterTipoBI === "PTA_COMPLETO" ? "bg-indigo-400" : "bg-white/20"}`} />
                  PTA Completo
                  <span className="opacity-50 text-[10px]">(Ciclo Base + Desempenho)</span>
                  {filterTipoBI === "PTA_COMPLETO" && <span className="opacity-60">✓</span>}
                </button>
              )}
            </>
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
            {/* Indicador de filtro ativo no BI */}
            {filterTipoBI && (
              <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-white/4 border border-white/10 rounded-lg text-xs text-white/50">
                <Filter className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Dashboard filtrado por:{" "}
                  <strong className="text-white/80">
                    {filterTipoBI === "PTA_COMPLETO"
                      ? "PTA Completo (Ciclo Base + Desempenho)"
                      : FILTER_CHIPS.find((c) => c.value === filterTipoBI)?.label ?? filterTipoBI}
                  </strong>
                </span>
                <button
                  onClick={() => setFilterTipoBI("")}
                  className="ml-auto text-white/30 hover:text-white/70 transition-colors text-[11px]"
                >
                  ✕ Limpar filtro
                </button>
              </div>
            )}
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

            {/* KPI cards — período selecionado */}
            <div className="mb-8 bg-blue-500/5 border border-blue-400/15 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-semibold text-white">
                  {mesNomeSel}
                  {mesSel === mesAtual && <span className="ml-2 text-xs text-blue-300/60 font-normal">(mês atual)</span>}
                </span>
                <button
                  onClick={() => {
                    if (periodoAnoCompleto) {
                      setFilterMes(""); setFilterMesVigente(false); setFilterDiaVigente(false);
                    } else {
                      setFilterMes(String(periodoMes)); setFilterMesVigente(false); setFilterDiaVigente(false);
                    }
                    setPage(1);
                  }}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1 text-xs bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 text-blue-300 rounded-lg transition-colors font-medium"
                >
                  <Filter className="w-3 h-3" /> Ver atividades do período
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white/4 rounded-lg px-4 py-3">
                  <p className="text-blue-200/40 text-xs mb-0.5">Planejado</p>
                  <p className="text-white font-bold tabular-nums">{planejadoSel.toLocaleString("pt-BR")}</p>
                </div>
                <div className="bg-white/4 rounded-lg px-4 py-3">
                  <p className="text-blue-200/40 text-xs mb-0.5">Realizadas</p>
                  <p className="text-emerald-400 font-bold tabular-nums">{realizadoSel}</p>
                </div>
                <div className="bg-white/4 rounded-lg px-4 py-3">
                  <p className="text-blue-200/40 text-xs mb-0.5">Agendadas</p>
                  <p className="text-blue-300 font-bold tabular-nums">{agendadoSel}</p>
                </div>
                <div className="bg-white/4 rounded-lg px-4 py-3">
                  <p className="text-blue-200/40 text-xs mb-0.5">Sem Agendamento</p>
                  <p className="text-orange-400 font-bold tabular-nums">{semAgendSel}</p>
                </div>
              </div>
            </div>

            {/* Execution rate bar */}
            <div className="mb-8 bg-white/4 rounded-xl border border-white/8 p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-white">
                  Taxa de Execução — <span className="text-blue-300">{mesNomeSel}</span>
                </span>
                <div className="flex items-center gap-2">
                  {taxaDelta !== null && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                      taxaDelta > 0
                        ? "text-emerald-400 bg-emerald-500/10 border-emerald-400/20"
                        : taxaDelta < 0
                        ? "text-red-400 bg-red-500/10 border-red-400/20"
                        : "text-white/40 bg-white/5 border-white/10"
                    }`}>
                      {taxaDelta > 0 ? "+" : ""}{taxaDelta.toFixed(1)}% vs {MESES[mesPrev!]}
                    </span>
                  )}
                  <span className={`text-2xl font-bold tabular-nums ${taxaSel >= 70 ? "text-emerald-400" : taxaSel >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                    {taxaSel.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${taxaSel >= 70 ? "bg-emerald-500" : taxaSel >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
                  style={{ width: `${Math.min(taxaSel, 100)}%` }}
                />
              </div>
              <div className="flex gap-4 mt-3 text-xs text-white/40">
                <span>Taxa de Agendamento: <strong className="text-white/60">{planejadoSel > 0 ? (((realizadoSel + agendadoSel) / planejadoSel) * 100).toFixed(1) : "0.0"}%</strong></span>
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
            {/* Chips de tipo */}
            <div className="flex flex-wrap gap-2 mb-3">
              {FILTER_CHIPS.map((chip) => {
                const tiposCarregados = summary?.tipos_carregados ?? [];
                const isDisabled =
                  chip.value === "PTA_COMPLETO"
                    ? !tiposCarregados.includes("CICLO_BASE") || !tiposCarregados.includes("CICLO_DESEMPENHO")
                    : chip.value !== "" && !tiposCarregados.includes(chip.value);
                const isActive = filterTipo === chip.value;
                return (
                  <button
                    key={chip.value}
                    disabled={isDisabled}
                    onClick={() => { setFilterTipo(chip.value); setPage(1); }}
                    aria-pressed={isActive}
                    className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${
                      isDisabled
                        ? "opacity-30 cursor-not-allowed border-white/10 text-white/30"
                        : isActive
                        ? chip.activeClass
                        : chip.chipClass
                    }`}
                  >
                    {chip.label}
                    {chip.value === "PTA_COMPLETO" && (
                      <span className="ml-1 opacity-60 text-[10px]">CB+D</span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
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

      <AIChat
        pageType="ptamensal"
        contextData={summary ? {
          tipos_carregados: summary.tipos_carregados,
          filtro_ativo: filterTipoBI || "todos",
          ...summary.consolidado,
        } : null}
      />

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
