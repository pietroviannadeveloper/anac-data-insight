"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AppHeader from "@/components/layout/AppHeader";
import AppFooter from "@/components/layout/AppFooter";
import { api } from "@/lib/api";
import { Analysis, CicloIndicators, AIAnalysis } from "@/types/analysis";
import {
  Loader2, AlertCircle, BarChart2, Table2, Bell, Sparkles,
  Download, CheckCircle, Clock, TrendingUp, AlertTriangle,
} from "lucide-react";
import { auth } from "@/lib/auth";

type Tab = "resumo" | "preview" | "alertas" | "ia";

function MetricTile({ label, value, sub, status = "neutral" }: {
  label: string; value: string | number; sub?: string;
  status?: "neutral" | "good" | "warn" | "bad";
}) {
  const valueColor =
    status === "good" ? "text-emerald-400" :
    status === "warn" ? "text-yellow-300" :
    status === "bad" ? "text-red-400" :
    "text-white";

  return (
    <div className="bg-white/8 backdrop-blur-sm border border-white/12 rounded-xl p-4">
      <p className="text-xs text-blue-200/50 uppercase tracking-wide mb-2">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${valueColor}`}>{value}</p>
      {sub && <p className="text-xs text-blue-200/35 mt-0.5">{sub}</p>}
    </div>
  );
}

function AlertBadge({ type }: { type: string }) {
  if (type === "error") return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-400/15 text-red-400 border border-red-400/25">Crítico</span>;
  if (type === "warning") return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-400/15 text-yellow-300 border border-yellow-400/25">Atenção</span>;
  return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-400/15 text-blue-300 border border-blue-400/25">Info</span>;
}

export default function AnaliseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("resumo");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [preview, setPreview] = useState<{ columns: string[]; rows: Record<string, unknown>[] } | null>(null);
  const [alerts, setAlerts] = useState<{ type: string; category: string; message: string; count: number }[]>([]);
  const [aiSummary, setAiSummary] = useState<AIAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      try {
        const [a, al] = await Promise.all([
          api.get(`/api/v1/analyses/${id}`),
          api.get(`/api/v1/analyses/${id}/alerts`),
        ]);
        setAnalysis(a);
        setAlerts(al.alerts);
        try {
          const ai = await api.get(`/api/v1/analyses/${id}/ai-summary`);
          setAiSummary(ai);
        } catch {
          // Not yet generated — fine
        }
      } catch {
        setError("Análise não encontrada ou API indisponível.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const loadPreview = async () => {
    if (preview) return;
    try {
      const data = await api.get(`/api/v1/analyses/${id}/preview`);
      setPreview(data);
    } catch {
      setPreview({ columns: [], rows: [] });
    }
  };

  const generateAI = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const data = await api.post(`/api/v1/analyses/${id}/ai-summary`, {});
      setAiSummary(data);
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : "Erro ao gerar resumo.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleExport = async () => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const token = auth.getToken();
    const r = await fetch(`${apiBase}/api/v1/analyses/${id}/export/excel`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!r.ok) return;
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analise_${id}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const indicators: CicloIndicators | null =
    analysis?.detected_type === "ciclos" ? (analysis as Analysis & { indicators: CicloIndicators }).indicators ?? null : null;

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "resumo", label: "Resumo", icon: BarChart2 },
    { key: "preview", label: "Dados", icon: Table2 },
    { key: "alertas", label: `Alertas${alerts.length > 0 ? ` (${alerts.length})` : ""}`, icon: Bell },
    { key: "ia", label: "IA", icon: Sparkles },
  ];

  if (loading) return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <main className="flex-1 flex items-center justify-center gap-2 text-blue-200/50">
        <Loader2 className="w-5 h-5 animate-spin" /> <span className="text-sm">Carregando análise...</span>
      </main>
      <AppFooter />
    </div>
  );

  if (error || !analysis) return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <main className="flex-1 flex flex-col items-center justify-center gap-3 text-red-400">
        <AlertCircle className="w-8 h-8" />
        <p className="text-sm font-medium">{error ?? "Análise não encontrada."}</p>
        <Link href="/analises" className="text-sm text-blue-300 hover:text-white transition-colors">← Voltar para análises</Link>
      </main>
      <AppFooter />
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <Link href="/analises" className="text-sm text-blue-300/60 hover:text-blue-300 transition-colors">← Análises</Link>
            <h1 className="text-xl font-bold text-white mt-2 truncate max-w-2xl">{analysis.original_filename}</h1>
            <p className="text-sm text-blue-200/50 mt-0.5">
              {analysis.detected_type === "ciclos" ? "Ciclos de Fiscalização" : "Planilha Genérica"} ·{" "}
              {analysis.total_rows.toLocaleString("pt-BR")} linhas · {analysis.total_columns} colunas
            </p>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-[#003A70] bg-white hover:bg-blue-50 rounded-lg transition-colors mt-6 shadow-lg shadow-black/20"
          >
            <Download className="w-3.5 h-3.5" /> Exportar Excel
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-white/10 mb-6">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => { setTab(key); if (key === "preview") loadPreview(); }}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === key
                  ? "border-blue-400 text-blue-300"
                  : "border-transparent text-blue-200/50 hover:text-blue-200"
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {/* Tab: Resumo */}
        {tab === "resumo" && (
          <div>
            {indicators ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <MetricTile label="Total de Atividades" value={indicators.total_atividades} />
                  <MetricTile label="Realizadas" value={indicators.realizadas} status="good" />
                  <MetricTile label="Agendadas" value={indicators.agendadas} status="neutral" />
                  <MetricTile label="Sem Agendamento" value={indicators.sem_agendamento} status={indicators.sem_agendamento > 0 ? "warn" : "neutral"} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <MetricTile
                    label="Taxa de Execução"
                    value={`${indicators.taxa_execucao}%`}
                    status={indicators.taxa_execucao >= 80 ? "good" : "bad"}
                  />
                  <MetricTile label="Taxa de Agendamento" value={`${indicators.taxa_agendamento}%`} />
                  <MetricTile
                    label="Pendências Críticas"
                    value={indicators.pendencias_criticas}
                    status={indicators.pendencias_criticas > 0 ? "bad" : "good"}
                  />
                  <MetricTile
                    label="Locais Indefinidos"
                    value={indicators.locais_indefinidos}
                    status={indicators.locais_indefinidos > 0 ? "warn" : "neutral"}
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <MetricTile label="Sem GIASO" value={indicators.sem_giaso} status={indicators.sem_giaso > 0 ? "bad" : "good"} />
                  <MetricTile label="Sem PCDP" value={indicators.sem_pcdp} status={indicators.sem_pcdp > 0 ? "warn" : "good"} />
                  <MetricTile label="PCDP Duplicado" value={indicators.pcdp_duplicada} status={indicators.pcdp_duplicada > 0 ? "bad" : "good"} />
                </div>
              </>
            ) : (
              <div className="bg-white/5 border border-white/10 rounded-xl p-10 text-center">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 text-white/20" />
                <p className="text-sm text-blue-200/50">Indicadores disponíveis apenas para planilhas de ciclos de fiscalização.</p>
              </div>
            )}
          </div>
        )}

        {/* Tab: Preview */}
        {tab === "preview" && (
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
            {!preview ? (
              <div className="flex items-center justify-center py-16 gap-2 text-blue-200/50">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Carregando dados...</span>
              </div>
            ) : preview.columns.length === 0 ? (
              <div className="py-16 text-center text-blue-200/40 text-sm">Não foi possível carregar os dados.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      {preview.columns.map((c) => (
                        <th key={c} className="text-left px-3 py-2.5 font-medium text-blue-200/60 whitespace-nowrap uppercase tracking-wide">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {preview.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-white/5 transition-colors">
                        {preview.columns.map((c) => (
                          <td key={c} className="px-3 py-2 text-blue-100/70 whitespace-nowrap max-w-[180px] truncate">
                            {row[c] == null ? <span className="text-white/20 italic">—</span> : String(row[c])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab: Alertas */}
        {tab === "alertas" && (
          <div className="space-y-3">
            {alerts.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-xl p-10 text-center">
                <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm text-blue-200/50 font-medium">Nenhum alerta encontrado.</p>
              </div>
            ) : alerts.map((alert, i) => (
              <div key={i} className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl p-4">
                <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                  alert.type === "error" ? "text-red-400" : alert.type === "warning" ? "text-yellow-300" : "text-blue-400"
                }`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-white">{alert.category}</span>
                    <AlertBadge type={alert.type} />
                  </div>
                  <p className="text-sm text-blue-200/55">{alert.message}</p>
                </div>
                <span className="text-lg font-bold text-white">{alert.count}</span>
              </div>
            ))}
          </div>
        )}

        {/* Tab: IA */}
        {tab === "ia" && (
          <div className="space-y-4">
            {!aiSummary && !aiLoading && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-10 text-center">
                <Sparkles className="w-8 h-8 text-white/20 mx-auto mb-3" />
                <p className="text-sm text-blue-200/50 mb-4">Gere um resumo executivo com IA baseado nos indicadores desta análise.</p>
                <button
                  onClick={generateAI}
                  className="px-5 py-2 bg-white text-[#003A70] hover:bg-blue-50 text-sm font-semibold rounded-lg transition-colors"
                >
                  Gerar resumo com IA
                </button>
                {aiError && <p className="text-sm text-red-400 mt-3">{aiError}</p>}
              </div>
            )}
            {aiLoading && (
              <div className="flex items-center justify-center py-16 gap-2 text-blue-200/50">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Gerando resumo com IA...</span>
              </div>
            )}
            {aiSummary && (
              <>
                <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-blue-200 mb-2 flex items-center gap-1.5"><BarChart2 className="w-4 h-4" /> Resumo Executivo</h3>
                  <p className="text-sm text-blue-100/70 leading-relaxed">{aiSummary.resumo_executivo}</p>
                </div>
                {aiSummary.principais_achados.length > 0 && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-blue-200 mb-3">Principais Achados</h3>
                    <ul className="space-y-1.5">
                      {aiSummary.principais_achados.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-blue-100/65">
                          <span className="text-blue-400 mt-0.5">•</span> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {aiSummary.riscos_operacionais.length > 0 && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-blue-200 mb-3 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 text-yellow-300" /> Riscos Operacionais</h3>
                    <ul className="space-y-1.5">
                      {aiSummary.riscos_operacionais.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-blue-100/65">
                          <span className="text-yellow-400 mt-0.5">•</span> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {aiSummary.recomendacoes.length > 0 && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-blue-200 mb-3">Recomendações</h3>
                    <ul className="space-y-1.5">
                      {aiSummary.recomendacoes.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-blue-100/65">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" /> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {aiSummary.plano_acao.length > 0 && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-blue-200 mb-3">Plano de Ação</h3>
                    <div className="space-y-3">
                      {aiSummary.plano_acao.map((item, i) => (
                        <div key={i} className="flex items-start gap-3 border-l-2 border-blue-500/50 pl-3">
                          <div>
                            <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-1 ${
                              item.prioridade === "Alta" ? "bg-red-400/15 text-red-400 border border-red-400/25" :
                              item.prioridade === "Média" ? "bg-yellow-400/15 text-yellow-300 border border-yellow-400/25" :
                              "bg-emerald-400/15 text-emerald-400 border border-emerald-400/25"
                            }`}>{item.prioridade}</span>
                            <p className="text-sm text-white font-medium">{item.acao}</p>
                            <p className="text-xs text-blue-200/45 mt-0.5">{item.justificativa}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex justify-end">
                  <button onClick={generateAI} className="flex items-center gap-1.5 text-xs text-blue-200/40 hover:text-blue-200/70 transition-colors">
                    <Clock className="w-3 h-3" /> Regenerar resumo
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </main>
      <AppFooter />
    </div>
  );
}
