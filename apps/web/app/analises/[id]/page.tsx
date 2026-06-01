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
  Download, CheckCircle, Clock, TrendingUp, AlertTriangle, List, FileText, PieChart,
  Tag, X, Plus, Pencil, Check, User, MessageSquare, Send, Trash2, GitBranch,
  Bot, Map, FileDown,
} from "lucide-react";
import ActivityTable from "@/components/analysis/ActivityTable";
import MapTab from "@/components/analysis/MapTab";

type Tab = "resumo" | "atividades" | "preview" | "alertas" | "ia" | "pdf-viewer" | "comentarios" | "chat" | "mapa";

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
  const [aiProvider, setAiProvider] = useState<{ provider: string; model: string | null; available: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Chat
  const [chatMessages, setChatMessages] = useState<{role:"user"|"assistant";content:string}[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // Comments
  const [comments, setComments] = useState<{id:string;username:string;content:string;created_at:string}[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);

  // Version history
  const [versions, setVersions] = useState<{id:string;version:number;created_at:string;created_by?:string}[]>([]);

  // Description inline edit
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState("");
  const [savingDesc, setSavingDesc] = useState(false);

  // Tags
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [savingTags, setSavingTags] = useState(false);

  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfBlobLoading, setPdfBlobLoading] = useState(false);
  const [pdfBlobError, setPdfBlobError] = useState<string | null>(null);

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
        setDescValue(a.description ?? "");
        setTags(a.tags ?? []);
        // Load comments
        api.get(`/api/v1/analyses/${id}/comments`).then(setComments).catch(() => {});
        // Load version siblings (same filename)
        if (a.original_filename) {
          api.get(`/api/v1/analyses?per_page=50`).then(r => {
            const sibs = (r.items as typeof a[]).filter(
              (s: typeof a) => s.original_filename === a.original_filename && s.id !== id
            ).map((s: typeof a) => ({ id: s.id, version: s.version ?? 1, created_at: s.created_at, created_by: s.created_by }));
            setVersions(sibs);
          }).catch(() => {});
        }
        try {
          const ai = await api.get(`/api/v1/analyses/${id}/ai-summary`);
          setAiSummary(ai);
        } catch {
          // Not yet generated — fine
        }
        try {
          const status = await api.get("/api/v1/ai/status");
          setAiProvider(status);
        } catch {}
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

  // Carrega o PDF como blob quando a aba "Visualizar PDF" é aberta
  // (necessário porque o iframe não consegue enviar o cookie de auth cross-origin)
  useEffect(() => {
    if (tab !== "pdf-viewer" || !id) return;
    if (pdfBlobUrl) return; // já carregado
    setPdfBlobLoading(true);
    setPdfBlobError(null);
    api.download(`/api/v1/analyses/${id}/file`)
      .then(blob => {
        const url = URL.createObjectURL(blob);
        setPdfBlobUrl(url);
      })
      .catch(() => setPdfBlobError("Não foi possível carregar o arquivo PDF. Verifique se o arquivo ainda existe no servidor."))
      .finally(() => setPdfBlobLoading(false));
  }, [tab, id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Limpa o blob URL ao desmontar
  useEffect(() => {
    return () => { if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl); };
  }, [pdfBlobUrl]);

  const generateAI = async (regenerate = false) => {
    setAiLoading(true);
    setAiError(null);
    try {
      if (regenerate) {
        // delete cache first so backend regenerates
        await api.delete(`/api/v1/analyses/${id}/ai-summary`).catch(() => {});
      }
      const data = await api.post(`/api/v1/analyses/${id}/ai-summary`, {});
      setAiSummary(data);
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : "Erro ao gerar resumo.");
    } finally {
      setAiLoading(false);
    }
  };

  const saveDescription = async () => {
    if (!id) return;
    setSavingDesc(true);
    try {
      const updated = await api.patch(`/api/v1/analyses/${id}`, { description: descValue });
      setAnalysis(updated);
      setEditingDesc(false);
    } catch { /* silent */ } finally { setSavingDesc(false); }
  };

  const addTag = async (tag: string) => {
    const t = tag.trim();
    if (!t || tags.includes(t) || !id) return;
    const next = [...tags, t];
    setSavingTags(true);
    try {
      await api.patch(`/api/v1/analyses/${id}`, { tags: next });
      setTags(next);
    } catch { /* silent */ } finally { setSavingTags(false); setTagInput(""); }
  };

  const removeTag = async (tag: string) => {
    if (!id) return;
    const next = tags.filter(t => t !== tag);
    setSavingTags(true);
    try {
      await api.patch(`/api/v1/analyses/${id}`, { tags: next });
      setTags(next);
    } catch { /* silent */ } finally { setSavingTags(false); }
  };

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const question = chatInput.trim();
    setChatMessages(prev => [...prev, { role: "user", content: question }]);
    setChatInput("");
    setChatLoading(true);
    try {
      const res = await api.post("/api/v1/chat", { question, analysis_id: id });
      setChatMessages(prev => [...prev, { role: "assistant", content: res.answer }]);
    } catch (e: unknown) {
      setChatMessages(prev => [...prev, { role: "assistant", content: e instanceof Error ? e.message : "Erro ao consultar IA." }]);
    } finally { setChatLoading(false); }
  };

  const handleExportDocx = async () => {
    try {
      const blob = await api.download(`/api/v1/analyses/${id}/export/docx`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `analise_${id}.docx`; a.click();
      URL.revokeObjectURL(url);
    } catch { /* silent */ }
  };

  const submitComment = async () => {
    if (!id || !commentInput.trim()) return;
    setCommentLoading(true);
    try {
      const c = await api.post(`/api/v1/analyses/${id}/comments`, { content: commentInput.trim() });
      setComments(prev => [...prev, c]);
      setCommentInput("");
    } catch { /* silent */ } finally { setCommentLoading(false); }
  };

  const deleteComment = async (commentId: string) => {
    if (!id) return;
    try {
      await api.delete(`/api/v1/analyses/${id}/comments/${commentId}`);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch { /* silent */ }
  };

  const handleExport = async () => {
    try {
      const blob = await api.download(`/api/v1/analyses/${id}/export/excel`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `analise_${id}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  const indicators: CicloIndicators | null =
    analysis?.detected_type === "ciclos" ? (analysis as Analysis & { indicators: CicloIndicators }).indicators ?? null : null;

  const isPdf     = analysis?.detected_type === "pdf";
  const isCiclos  = analysis?.detected_type === "ciclos";
  const isGeneric = analysis?.detected_type === "generic";

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "resumo", label: "Resumo", icon: BarChart2 },
    ...(isCiclos ? [{ key: "atividades" as Tab, label: "Atividades", icon: List }] : []),
    ...(isPdf    ? [{ key: "pdf-viewer" as Tab, label: "Visualizar PDF", icon: FileText }] : []),
    ...(!isPdf   ? [{ key: "preview" as Tab, label: "Prévia", icon: Table2 }] : []),
    ...(!isPdf   ? [{ key: "alertas" as Tab, label: `Alertas${alerts.length > 0 ? ` (${alerts.length})` : ""}`, icon: Bell }] : []),
    { key: "ia", label: "IA", icon: Sparkles },
    { key: "chat", label: "Chat", icon: Bot },
    ...(isCiclos ? [{ key: "mapa" as Tab, label: "Mapa", icon: Map }] : []),
    { key: "comentarios", label: `Comentários${comments.length > 0 ? ` (${comments.length})` : ""}`, icon: MessageSquare },
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
          <div className="flex-1 min-w-0 mr-4">
            <Link href="/analises" className="text-sm text-blue-300/60 hover:text-blue-300 transition-colors">← Análises</Link>
            <h1 className="text-xl font-bold text-white mt-2 truncate max-w-2xl">{analysis.original_filename}</h1>
            <p className="text-sm text-blue-200/50 mt-0.5">
              {analysis.detected_type === "ciclos"  ? "Ciclos de Fiscalização" :
               analysis.detected_type === "pdf"     ? "Documento PDF" :
               analysis.detected_type === "generic" ? "Planilha Genérica" : "Arquivo"} ·{" "}
              {analysis.detected_type === "pdf"
                ? `${analysis.total_rows} página${analysis.total_rows !== 1 ? "s" : ""}`
                : `${analysis.total_rows.toLocaleString("pt-BR")} linhas · ${analysis.total_columns} colunas`}
            </p>
            {analysis.created_by && (
              <p className="flex items-center gap-1 text-xs text-blue-200/45 mt-1">
                <User className="w-3 h-3" /> {analysis.created_by}
              </p>
            )}

            {/* Descrição */}
            <div className="mt-3 group">
              {editingDesc ? (
                <div className="flex items-start gap-2">
                  <textarea
                    value={descValue}
                    onChange={e => setDescValue(e.target.value)}
                    placeholder="Adicione uma descrição..."
                    rows={2}
                    className="flex-1 bg-white/5 border border-blue-400/30 rounded-lg px-3 py-1.5 text-sm text-blue-100 placeholder-white/25 focus:outline-none resize-none"
                    autoFocus
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveDescription(); } if (e.key === "Escape") setEditingDesc(false); }}
                  />
                  <div className="flex flex-col gap-1">
                    <button onClick={saveDescription} disabled={savingDesc}
                      className="p-1.5 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 transition-colors">
                      {savingDesc ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => { setEditingDesc(false); setDescValue(analysis.description ?? ""); }}
                      className="p-1.5 rounded hover:bg-white/10 text-white/40 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setEditingDesc(true)}
                  className="flex items-center gap-1.5 text-sm text-blue-200/40 hover:text-blue-200/70 transition-colors group-hover:visible">
                  <Pencil className="w-3 h-3" />
                  {descValue || "Adicionar descrição..."}
                </button>
              )}
            </div>

            {/* Tags */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Tag className="w-3 h-3 text-white/25 shrink-0" />
              {tags.map(t => (
                <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-blue-400/15 text-blue-300 border border-blue-400/20">
                  {t}
                  <button onClick={() => removeTag(t)} className="hover:text-white/70 transition-colors ml-0.5">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
              <div className="flex items-center gap-1">
                <input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && tagInput.trim()) { e.preventDefault(); addTag(tagInput); } }}
                  placeholder="+ tag"
                  className="w-16 bg-transparent text-xs text-blue-300/60 placeholder-white/20 outline-none focus:placeholder-white/40"
                />
                {tagInput.trim() && (
                  <button onClick={() => addTag(tagInput)} disabled={savingTags}
                    className="text-blue-300/60 hover:text-blue-300 transition-colors">
                    <Plus className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-6">
            {/* Botão Comparar — para ciclos com versões anteriores */}
            {isCiclos && versions.length > 0 && (
              <Link
                href={`/comparar?a=${versions[versions.length-1].id}&b=${id}`}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-teal-300 bg-teal-400/10 border border-teal-400/25 rounded-lg hover:bg-teal-400/20 transition-colors"
                title="Comparar com versão anterior"
              >
                <GitBranch className="w-3.5 h-3.5" /> Comparar
              </Link>
            )}

            {/* Botão BI — planilhas (ciclos ou genérico) */}
            {!isPdf && (
              <Link
                href={`/dashboard?analysis_id=${id}`}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-purple-300 bg-purple-400/10 border border-purple-400/25 rounded-lg hover:bg-purple-400/20 transition-colors"
              >
                <PieChart className="w-3.5 h-3.5" /> Visualizar BI
              </Link>
            )}

            {/* Botão Relatório — PDFs */}
            {isPdf && (
              <Link
                href={`/relatorios?analysis_id=${id}`}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-amber-300 bg-amber-400/10 border border-amber-400/25 rounded-lg hover:bg-amber-400/20 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" /> Ver relatório
              </Link>
            )}

            {/* Exportar Excel — só planilhas */}
            {!isPdf && (
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-[#003A70] bg-white hover:bg-blue-50 rounded-lg transition-colors shadow-lg shadow-black/20"
              >
                <Download className="w-3.5 h-3.5" /> Excel
              </button>
            )}

            {/* Exportar DOCX */}
            <button
              onClick={handleExportDocx}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-300 bg-blue-400/10 border border-blue-400/25 rounded-lg hover:bg-blue-400/20 transition-colors"
              title="Baixar relatório editável em Word"
            >
              <FileDown className="w-3.5 h-3.5" /> Word
            </button>
          </div>
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
            {/* PDF summary */}
            {isPdf && analysis?.indicators && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <MetricTile label="Páginas" value={(analysis.indicators as Record<string,unknown>).pages as number ?? 0} />
                  <MetricTile label="Palavras" value={((analysis.indicators as Record<string,unknown>).word_count as number ?? 0).toLocaleString("pt-BR")} />
                  <MetricTile label="Caracteres" value={((analysis.indicators as Record<string,unknown>).char_count as number ?? 0).toLocaleString("pt-BR")} />
                </div>
                {!!(analysis.indicators as Record<string,unknown>).title && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <p className="text-xs text-blue-200/50 uppercase tracking-wide mb-1">Título do documento</p>
                    <p className="text-sm text-white">{(analysis.indicators as Record<string,unknown>).title as string}</p>
                  </div>
                )}
                <div className="bg-white/5 border border-blue-400/20 rounded-xl p-4 flex items-start gap-3">
                  <FileText className="w-5 h-5 text-blue-300/60 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-blue-200/80 font-medium">Documento carregado com sucesso</p>
                    <p className="text-xs text-blue-200/50 mt-1">
                      Use a aba <span className="text-blue-300 font-medium">Visualizar PDF</span> para ver o conteúdo completo do documento, ou gere um resumo com IA na aba <span className="text-blue-300 font-medium">IA</span>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Generic spreadsheet summary */}
            {isGeneric && analysis?.indicators && (() => {
              const ind = analysis.indicators as Record<string,unknown>;
              const cols = (ind.columns_profile as {name:string;dtype:string;non_null:number;null_pct:number;unique:number;sample:string[]}[]) ?? [];
              const emptyCols = (ind.empty_columns as string[]) ?? [];
              const dupRows = ind.duplicate_rows as number ?? 0;
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <MetricTile label="Total de Linhas" value={(ind.total_rows as number ?? 0).toLocaleString("pt-BR")} />
                    <MetricTile label="Total de Colunas" value={ind.total_columns as number ?? 0} />
                    <MetricTile label="Colunas vazias" value={emptyCols.length} status={emptyCols.length > 0 ? "warn" : "good"} />
                    <MetricTile label="Linhas duplicadas" value={dupRows} status={dupRows > 0 ? "warn" : "good"} />
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/8">
                      <p className="text-xs font-semibold text-blue-200/60 uppercase tracking-wide">Perfil de colunas</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-white/5">
                          <tr>
                            {["Coluna", "Tipo", "Preenchidos", "% Nulos", "Únicos", "Amostra"].map(h => (
                              <th key={h} className="text-left px-3 py-2 text-blue-200/50 font-medium uppercase tracking-wide whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {cols.map(c => (
                            <tr key={c.name} className="hover:bg-white/5">
                              <td className="px-3 py-2 font-medium text-white/80 whitespace-nowrap">{c.name}</td>
                              <td className="px-3 py-2 text-blue-200/50 whitespace-nowrap">{c.dtype}</td>
                              <td className="px-3 py-2 text-blue-200/70">{c.non_null.toLocaleString("pt-BR")}</td>
                              <td className={`px-3 py-2 ${c.null_pct > 20 ? "text-amber-400" : "text-blue-200/70"}`}>{c.null_pct}%</td>
                              <td className="px-3 py-2 text-blue-200/70">{c.unique.toLocaleString("pt-BR")}</td>
                              <td className="px-3 py-2 text-blue-200/50 max-w-[160px] truncate">{c.sample.join(", ")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Ciclos summary */}
            {isCiclos && indicators && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <MetricTile label="Total de Atividades" value={indicators.total_atividades} />
                  <MetricTile label="Realizadas" value={indicators.realizadas} status="good" />
                  <MetricTile label="Agendadas" value={indicators.agendadas} status="neutral" />
                  <MetricTile label="Sem Agendamento" value={indicators.sem_agendamento} status={indicators.sem_agendamento > 0 ? "warn" : "neutral"} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <MetricTile label="Taxa de Execução" value={`${indicators.taxa_execucao}%`} status={indicators.taxa_execucao >= 80 ? "good" : "bad"} />
                  <MetricTile label="Taxa de Agendamento" value={`${indicators.taxa_agendamento}%`} />
                  <MetricTile label="Pendências Críticas" value={indicators.pendencias_criticas} status={indicators.pendencias_criticas > 0 ? "bad" : "good"} />
                  <MetricTile label="Locais Indefinidos" value={indicators.locais_indefinidos} status={indicators.locais_indefinidos > 0 ? "warn" : "neutral"} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <MetricTile label="Sem GIASO" value={indicators.sem_giaso} status={indicators.sem_giaso > 0 ? "bad" : "good"} />
                  <MetricTile label="Sem PCDP" value={indicators.sem_pcdp} status={indicators.sem_pcdp > 0 ? "warn" : "good"} />
                  <MetricTile label="PCDP Duplicado" value={indicators.pcdp_duplicada} status={indicators.pcdp_duplicada > 0 ? "bad" : "good"} />
                </div>
              </>
            )}

            {!isPdf && !isGeneric && !isCiclos && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-10 text-center">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 text-white/20" />
                <p className="text-sm text-blue-200/50">Nenhum indicador disponível para este tipo de arquivo.</p>
              </div>
            )}
          </div>
        )}

        {/* Tab: Atividades */}
        {tab === "atividades" && id && (
          <ActivityTable analysisId={id} />
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

        {/* Tab: Visualizar PDF */}
        {tab === "pdf-viewer" && id && (
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
              <p className="text-xs font-semibold text-blue-200/60 uppercase tracking-wide">Visualização do documento</p>
              {pdfBlobUrl && (
                <a
                  href={pdfBlobUrl}
                  download={analysis?.original_filename}
                  className="flex items-center gap-1.5 text-xs text-blue-300 hover:text-blue-200 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" /> Baixar arquivo
                </a>
              )}
            </div>
            {pdfBlobLoading ? (
              <div className="flex items-center justify-center py-20 gap-2 text-blue-200/50">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Carregando documento...</span>
              </div>
            ) : pdfBlobError ? (
              <div className="flex flex-col items-center justify-center py-20 gap-2 text-red-400">
                <AlertCircle className="w-6 h-6" />
                <p className="text-sm text-center max-w-sm">{pdfBlobError}</p>
              </div>
            ) : pdfBlobUrl ? (
              <iframe
                src={pdfBlobUrl}
                className="w-full"
                style={{ height: "80vh", border: "none" }}
                title="Visualização do PDF"
              />
            ) : null}
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
            {/* provider badge */}
            {aiProvider && (
              <div className="flex items-center gap-2 text-xs">
                {aiProvider.available ? (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/25 text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                    {aiProvider.provider === "gemini" ? "Google Gemini" : "OpenAI"} · {aiProvider.model}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/10 border border-yellow-400/25 text-yellow-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" />
                    Nenhuma IA configurada — adicione GEMINI_API_KEY no .env
                  </span>
                )}
              </div>
            )}

            {!aiSummary && !aiLoading && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-10 text-center">
                <Sparkles className="w-8 h-8 text-white/20 mx-auto mb-3" />
                <p className="text-sm text-blue-200/50 mb-1">Gere um resumo executivo com IA baseado nos indicadores desta análise.</p>
                <p className="text-xs text-blue-200/30 mb-5">Os tipos O135, empresas e indicadores são enviados automaticamente para a IA.</p>
                <button
                  onClick={() => generateAI()}
                  disabled={aiProvider?.available === false}
                  className="px-5 py-2 bg-white text-[#003A70] hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold rounded-lg transition-colors"
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
                  <button onClick={() => generateAI(true)} className="flex items-center gap-1.5 text-xs text-blue-200/40 hover:text-blue-200/70 transition-colors">
                    <Clock className="w-3 h-3" /> Regenerar resumo
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab: Chat */}
        {tab === "chat" && (
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden flex flex-col" style={{height:"60vh"}}>
            <div className="px-4 py-3 border-b border-white/8 flex items-center gap-2">
              <Bot className="w-4 h-4 text-purple-300/70" />
              <p className="text-xs font-semibold text-blue-200/60 uppercase tracking-wide">Chat com os dados</p>
              <span className="text-[10px] text-blue-200/30 ml-auto">Pergunte sobre as atividades desta análise</span>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {chatMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-blue-200/30">
                  <Bot className="w-10 h-10" />
                  <p className="text-sm text-center">Faça uma pergunta sobre os dados.<br/>Ex: "Quais empresas têm mais atividades sem GIASO?"</p>
                  <div className="flex flex-wrap gap-2 justify-center mt-2">
                    {["Quais empresas têm mais pendências?","Qual a taxa de execução?","Quantas atividades sem PCDP?"].map(q => (
                      <button key={q} onClick={() => { setChatInput(q); }}
                        className="text-xs px-3 py-1.5 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 text-blue-200/60 hover:text-blue-200 transition-colors">
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {chatMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.role === "user"
                      ? "bg-blue-500/20 border border-blue-400/25 text-blue-100"
                      : "bg-white/8 border border-white/10 text-blue-100/80"
                  }`}>
                    {m.role === "assistant" && <Bot className="w-3.5 h-3.5 text-purple-300/70 mb-1" />}
                    <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-white/8 border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-300/70" />
                    <span className="text-xs text-blue-200/50">Analisando dados...</span>
                  </div>
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-white/8 flex items-center gap-3">
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
                placeholder="Faça uma pergunta sobre os dados..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-blue-100 placeholder-white/25 focus:outline-none focus:border-purple-400/40"
              />
              <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-purple-500/20 border border-purple-400/30 rounded-xl hover:bg-purple-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Tab: Mapa */}
        {tab === "mapa" && id && (
          <MapTab analysisId={id} />
        )}

        {/* Tab: Comentários */}
        {tab === "comentarios" && (
          <div className="space-y-4">
            {/* Version history strip */}
            {versions.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-200/50 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <GitBranch className="w-3 h-3" /> Histórico de versões
                </p>
                <div className="flex flex-wrap gap-2">
                  {versions.map(v => (
                    <Link key={v.id} href={`/analises/${v.id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg hover:border-blue-400/30 transition-colors text-blue-200/60 hover:text-blue-200">
                      v{v.version} · {new Date(v.created_at + (v.created_at.endsWith("Z") ? "" : "Z")).toLocaleDateString("pt-BR")}
                      {v.created_by && <span className="text-white/30">({v.created_by})</span>}
                    </Link>
                  ))}
                  <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-500/15 border border-blue-400/30 rounded-lg text-blue-300">
                    v{analysis.version ?? 1} (atual)
                  </span>
                </div>
                {versions.length > 0 && isCiclos && (
                  <Link href={`/comparar?a=${versions[versions.length-1].id}&b=${id}`}
                    className="inline-flex items-center gap-1.5 mt-3 text-xs text-teal-300 hover:text-teal-200 transition-colors">
                    <GitBranch className="w-3 h-3" /> Comparar v{versions[versions.length-1].version} com esta versão →
                  </Link>
                )}
              </div>
            )}

            {/* Comments thread */}
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/8">
                <p className="text-xs font-semibold text-blue-200/60 uppercase tracking-wide">
                  Comentários e Anotações
                </p>
              </div>

              {comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-blue-200/30">
                  <MessageSquare className="w-7 h-7" />
                  <p className="text-sm">Nenhum comentário ainda. Seja o primeiro.</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {comments.map(c => (
                    <div key={c.id} className="px-4 py-3 flex items-start gap-3 group">
                      <div className="w-7 h-7 rounded-full bg-blue-500/20 border border-blue-400/25 flex items-center justify-center text-xs font-bold text-blue-300 shrink-0">
                        {c.username[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-white/80">{c.username}</span>
                          <span className="text-[10px] text-white/25">
                            {new Date(c.created_at + (c.created_at.endsWith("Z") ? "" : "Z")).toLocaleString("pt-BR")}
                          </span>
                        </div>
                        <p className="text-sm text-blue-100/70 whitespace-pre-wrap">{c.content}</p>
                      </div>
                      <button onClick={() => deleteComment(c.id)}
                        className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="px-4 py-3 border-t border-white/8 flex items-end gap-3">
                <textarea
                  value={commentInput}
                  onChange={e => setCommentInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
                  placeholder="Adicionar comentário... (Enter para enviar, Shift+Enter para nova linha)"
                  rows={2}
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-blue-100 placeholder-white/25 focus:outline-none focus:border-blue-400/40 resize-none"
                />
                <button
                  onClick={submitComment}
                  disabled={commentLoading || !commentInput.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-500/20 border border-blue-400/30 rounded-lg hover:bg-blue-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  {commentLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Enviar
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      <AppFooter />
    </div>
  );
}
