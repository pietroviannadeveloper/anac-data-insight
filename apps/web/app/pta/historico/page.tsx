"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppHeader from "@/components/layout/AppHeader";
import AppFooter from "@/components/layout/AppFooter";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  AlertCircle,
  RefreshCw,
  BarChart2,
  CalendarRange,
  ExternalLink,
  History,
  ClipboardList,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PTASnapshot {
  id: string;
  year: number;
  tipo_ciclo: "CICLO_BASE" | "CICLO_DESEMPENHO" | "NAO_PROGRAMADA";
  source_file: string;
  total_rows: number;
  indicators: Record<string, number>;
  is_seed: boolean;
}

interface CompareResult {
  tipo_ciclo: string;
  can_plan_pta: boolean;
  a: { year: number; source_file: string; total_rows: number; indicators: Record<string, number> };
  b: { year: number; source_file: string; total_rows: number; indicators: Record<string, number> };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIPO_LABELS: Record<string, string> = {
  CICLO_BASE: "Ciclo Base",
  CICLO_DESEMPENHO: "Desempenho",
  NAO_PROGRAMADA: "Não Programadas",
};

const TIPO_COLORS: Record<string, string> = {
  CICLO_BASE: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  CICLO_DESEMPENHO: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  NAO_PROGRAMADA: "bg-orange-500/20 text-orange-300 border-orange-500/30",
};

const METRICS: { key: string; label: string; higherIsBetter: boolean; unit?: string }[] = [
  { key: "total_atividades", label: "Total de Atividades", higherIsBetter: true },
  { key: "realizadas", label: "Realizadas", higherIsBetter: true },
  { key: "agendadas", label: "Agendadas", higherIsBetter: true },
  { key: "sem_agendamento", label: "Sem Agendamento", higherIsBetter: false },
  { key: "taxa_execucao", label: "Taxa de Execução", higherIsBetter: true, unit: "%" },
  { key: "taxa_agendamento", label: "Taxa de Agendamento", higherIsBetter: true, unit: "%" },
  { key: "sem_giaso", label: "Sem GIASO", higherIsBetter: false },
  { key: "sem_pcdp", label: "Sem PCDP", higherIsBetter: false },
  { key: "sem_processo", label: "Sem Processo", higherIsBetter: false },
  { key: "locais_indefinidos", label: "Locais Indefinidos", higherIsBetter: false },
  { key: "pcdp_duplicada", label: "PCDP Duplicada", higherIsBetter: false },
  { key: "multiplas_pcdps", label: "Múltiplas PCDPs", higherIsBetter: false },
  { key: "pendencias_criticas", label: "Pendências Críticas", higherIsBetter: false },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypeBadge({ tipo }: { tipo: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded border font-medium ${TIPO_COLORS[tipo] ?? "bg-white/10 text-white/60 border-white/20"}`}>
      {TIPO_LABELS[tipo] ?? tipo}
    </span>
  );
}

function Delta({ a, b, higherIsBetter }: { a?: number; b?: number; higherIsBetter: boolean }) {
  if (a == null || b == null) return <span className="text-white/50 text-xs">—</span>;
  const diff = b - a;
  if (diff === 0) return <span className="flex items-center gap-1 text-white/50 text-xs"><Minus className="w-3 h-3" />igual</span>;
  const good = (diff > 0) === higherIsBetter;
  const display = diff % 1 === 0 ? Math.abs(diff) : Math.abs(diff).toFixed(1);
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${good ? "text-emerald-400" : "text-red-400"}`}>
      {diff > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {diff > 0 ? "+" : "−"}{display}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PTAPage() {
  const router = useRouter();
  const [snapshots, setSnapshots] = useState<PTASnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  // Comparison selectors
  const [selectedTipo, setSelectedTipo] = useState<string>("");
  const [yearA, setYearA] = useState<string>("");
  const [yearB, setYearB] = useState<string>("");
  const [comparing, setComparing] = useState(false);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);

  // Guard: admin only
  useEffect(() => {
    if (!auth.isAdmin()) router.replace("/dashboard");
  }, [router]);

  const fetchSnapshots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data: PTASnapshot[] = await api.get("/api/v1/pta/snapshots");
      setSnapshots(data);
      // Auto-select first tipo
      if (data.length > 0 && !selectedTipo) {
        setSelectedTipo(data[0].tipo_ciclo);
      }
    } catch {
      setError("Não foi possível carregar os dados do PTA. Execute o seed para inicializar.");
    } finally {
      setLoading(false);
    }
  }, [selectedTipo]);

  useEffect(() => { fetchSnapshots(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSeed() {
    setSeeding(true);
    setSeedMsg(null);
    setError(null);
    try {
      const res = await api.post("/api/v1/pta/seed", {});
      setSeedMsg(res.message ?? "Dados carregados com sucesso.");
      await fetchSnapshots();
    } catch {
      setError("Erro ao carregar dados históricos. Verifique os arquivos em docs/historicoPTA/.");
    } finally {
      setSeeding(false);
    }
  }

  async function handleCompare() {
    if (!selectedTipo || !yearA || !yearB) return;
    setComparing(true);
    setCompareError(null);
    setCompareResult(null);
    // Always send earlier year as A (base) and later year as B (atual)
    const base = Math.min(Number(yearA), Number(yearB));
    const atual = Math.max(Number(yearA), Number(yearB));
    try {
      const res: CompareResult = await api.get(
        `/api/v1/pta/compare?year_a=${base}&tipo_a=${selectedTipo}&year_b=${atual}&tipo_b=${selectedTipo}`
      );
      setCompareResult(res);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao comparar snapshots.";
      setCompareError(msg);
    } finally {
      setComparing(false);
    }
  }

  // Years available for selected tipo
  const tiposAvailable = Array.from(new Set(snapshots.map((s) => s.tipo_ciclo))).sort();
  const yearsForTipo = snapshots
    .filter((s) => s.tipo_ciclo === selectedTipo)
    .map((s) => s.year)
    .sort((a, b) => a - b);

  // Group snapshots by tipo for the overview table
  const byTipo = snapshots.reduce<Record<string, PTASnapshot[]>>((acc, s) => {
    (acc[s.tipo_ciclo] ??= []).push(s);
    return acc;
  }, {});

  // Consolidated totals per year (all types summed)
  const allYears = Array.from(new Set(snapshots.map((s) => s.year))).sort((a, b) => a - b);
  const TIPOS_ORDER = ["CICLO_BASE", "CICLO_DESEMPENHO", "NAO_PROGRAMADA"] as const;
  const consolidado = allYears.map((year) => {
    const snapsForYear = snapshots.filter((s) => s.year === year);
    let total = 0, realizadas = 0, agendadas = 0, semAgend = 0, pendencias = 0;
    const byType: Record<string, number> = {};
    for (const s of snapsForYear) {
      const ind = s.indicators ?? {};
      const t = ind.total_atividades ?? 0;
      total += t;
      realizadas += ind.realizadas ?? 0;
      agendadas += ind.agendadas ?? 0;
      semAgend += ind.sem_agendamento ?? 0;
      pendencias += ind.pendencias_criticas ?? 0;
      byType[s.tipo_ciclo] = t;
    }
    const taxa = total > 0 ? (realizadas / total) * 100 : 0;
    return { year, total, realizadas, agendadas, semAgend, pendencias, taxa, byType };
  });

  return (
    <div className="flex flex-col min-h-screen bg-[#001E3C]">
      <AppHeader />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">

        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm">
          <Link href="/pta" className="text-blue-200/40 hover:text-blue-200/70 transition-colors flex items-center gap-1">
            <History className="w-3.5 h-3.5" /> PTA
          </Link>
          <span className="text-white/20">/</span>
          <span className="text-white/50">Histórico</span>
        </div>

        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <BarChart2 className="w-6 h-6 text-amber-400" />
              <h1 className="text-2xl font-bold text-white">Histórico PTA</h1>
            </div>
            <p className="text-blue-200/60 text-sm">
              Histórico de dados operacionais 2021–2025 para comparativo e planejamento do PTA.
            </p>
          </div>
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {seeding ? "Carregando..." : "Carregar / Atualizar Seed"}
          </button>
        </div>

        {seedMsg && (
          <div className="mb-4 px-4 py-3 bg-emerald-500/15 border border-emerald-500/30 rounded-lg text-emerald-300 text-sm">
            {seedMsg}
          </div>
        )}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-500/15 border border-red-500/30 rounded-lg text-red-300 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-blue-200/50">
            <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Carregando...</span>
          </div>
        ) : snapshots.length === 0 ? (
          <div className="text-center py-20 text-blue-200/40">
            <BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhum dado histórico carregado.</p>
            <p className="text-xs mt-1">Clique em "Carregar / Atualizar Seed" para importar os arquivos de docs/historicoPTA/.</p>
          </div>
        ) : (
          <>
            {/* Overview table */}
            <div className="mb-10">
              <h2 className="text-sm font-semibold text-blue-200/60 uppercase tracking-wider mb-3">
                Visão Geral por Tipo e Ano
              </h2>
              <div className="space-y-6">
                {Object.entries(byTipo).map(([tipo, rows]) => (
                  <div key={tipo} className="bg-white/4 rounded-xl border border-white/8 overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/8 flex items-center gap-3">
                      <TypeBadge tipo={tipo} />
                      <span className="text-white/40 text-xs">{rows.length} ano(s)</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/8 text-white/40 text-xs">
                            <th className="px-4 py-2 text-left font-medium">Ano</th>
                            <th className="px-4 py-2 text-right font-medium">Total</th>
                            <th className="px-4 py-2 text-right font-medium">Realizadas</th>
                            <th className="px-4 py-2 text-right font-medium">Agendadas</th>
                            <th className="px-4 py-2 text-right font-medium">Sem Agend.</th>
                            <th className="px-4 py-2 text-right font-medium">Taxa Exec.</th>
                            <th className="px-4 py-2 text-right font-medium">Pendências</th>
                            <th className="px-4 py-2 text-right font-medium">Arquivo</th>
                            <th className="px-4 py-2 text-center font-medium"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.sort((a, b) => a.year - b.year).map((snap) => {
                            const ind = snap.indicators ?? {};
                            return (
                              <tr key={snap.id} className="border-b border-white/5 hover:bg-white/4 transition-colors">
                                <td className="px-4 py-2.5 text-white font-semibold">{snap.year}</td>
                                <td className="px-4 py-2.5 text-right text-blue-200/80 tabular-nums">{ind.total_atividades?.toLocaleString("pt-BR") ?? "—"}</td>
                                <td className="px-4 py-2.5 text-right text-emerald-400 tabular-nums">{ind.realizadas?.toLocaleString("pt-BR") ?? "—"}</td>
                                <td className="px-4 py-2.5 text-right text-blue-300 tabular-nums">{ind.agendadas?.toLocaleString("pt-BR") ?? "—"}</td>
                                <td className="px-4 py-2.5 text-right text-orange-400 tabular-nums">{ind.sem_agendamento?.toLocaleString("pt-BR") ?? "—"}</td>
                                <td className="px-4 py-2.5 text-right tabular-nums">
                                  <span className={`font-medium ${(ind.taxa_execucao ?? 0) >= 70 ? "text-emerald-400" : (ind.taxa_execucao ?? 0) >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                                    {ind.taxa_execucao != null ? `${ind.taxa_execucao.toFixed(1)}%` : "—"}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-right text-red-400 tabular-nums">{ind.pendencias_criticas?.toLocaleString("pt-BR") ?? "—"}</td>
                                <td className="px-4 py-2.5 text-right text-white/30 text-xs truncate max-w-[180px]">{snap.source_file}</td>
                                <td className="px-4 py-2.5 text-center">
                                  <Link
                                    href={`/pta/${snap.tipo_ciclo}/${snap.year}`}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/15 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-xs font-medium transition-colors"
                                  >
                                    <ExternalLink className="w-3 h-3" /> Ver
                                  </Link>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Consolidated totals per year */}
            <div className="mb-10">
              <h2 className="text-sm font-semibold text-blue-200/60 uppercase tracking-wider mb-3">
                Somatório Consolidado por Ano
              </h2>
              <div className="bg-white/4 rounded-xl border border-white/8 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/8 bg-white/4 text-white/40 text-xs">
                        <th className="px-4 py-3 text-left font-medium">Ano</th>
                        <th className="px-4 py-3 text-right font-medium">
                          <span className="inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Base
                          </span>
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          <span className="inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" /> Desempenho
                          </span>
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          <span className="inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> Não Prog.
                          </span>
                        </th>
                        <th className="px-4 py-3 text-right font-medium text-white/70">Total</th>
                        <th className="px-4 py-3 text-right font-medium">Realizadas</th>
                        <th className="px-4 py-3 text-right font-medium">Agendadas</th>
                        <th className="px-4 py-3 text-right font-medium">Sem Agend.</th>
                        <th className="px-4 py-3 text-right font-medium">% Execução</th>
                        <th className="px-4 py-3 text-right font-medium">Pendências</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consolidado.map((row) => {
                        const taxaColor = row.taxa >= 80 ? "text-emerald-400" : row.taxa >= 60 ? "text-yellow-400" : "text-red-400";
                        return (
                          <tr key={row.year} className="border-b border-white/5 hover:bg-white/4 transition-colors">
                            <td className="px-4 py-3 text-white font-bold">{row.year}</td>
                            <td className="px-4 py-3 text-right text-blue-300/70 tabular-nums">
                              {row.byType["CICLO_BASE"]?.toLocaleString("pt-BR") ?? <span className="text-white/20">—</span>}
                            </td>
                            <td className="px-4 py-3 text-right text-purple-300/70 tabular-nums">
                              {row.byType["CICLO_DESEMPENHO"]?.toLocaleString("pt-BR") ?? <span className="text-white/20">—</span>}
                            </td>
                            <td className="px-4 py-3 text-right text-orange-300/70 tabular-nums">
                              {row.byType["NAO_PROGRAMADA"]?.toLocaleString("pt-BR") ?? <span className="text-white/20">—</span>}
                            </td>
                            <td className="px-4 py-3 text-right text-white font-semibold tabular-nums">
                              {row.total.toLocaleString("pt-BR")}
                            </td>
                            <td className="px-4 py-3 text-right text-emerald-400 tabular-nums">
                              {row.realizadas.toLocaleString("pt-BR")}
                            </td>
                            <td className="px-4 py-3 text-right text-blue-300 tabular-nums">
                              {row.agendadas.toLocaleString("pt-BR")}
                            </td>
                            <td className="px-4 py-3 text-right text-orange-400 tabular-nums">
                              {row.semAgend.toLocaleString("pt-BR")}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              <span className={`font-bold text-sm ${taxaColor}`}>
                                {row.taxa.toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-red-400 tabular-nums">
                              {row.pendencias.toLocaleString("pt-BR")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {/* Grand total row */}
                    {consolidado.length > 1 && (() => {
                      const gt = consolidado.reduce(
                        (acc, r) => ({ total: acc.total + r.total, realizadas: acc.realizadas + r.realizadas, agendadas: acc.agendadas + r.agendadas, semAgend: acc.semAgend + r.semAgend, pendencias: acc.pendencias + r.pendencias }),
                        { total: 0, realizadas: 0, agendadas: 0, semAgend: 0, pendencias: 0 }
                      );
                      const gtTaxa = gt.total > 0 ? (gt.realizadas / gt.total) * 100 : 0;
                      const gtColor = gtTaxa >= 80 ? "text-emerald-400" : gtTaxa >= 60 ? "text-yellow-400" : "text-red-400";
                      return (
                        <tfoot>
                          <tr className="border-t-2 border-white/20 bg-white/6 text-xs">
                            <td className="px-4 py-3 text-white/60 font-semibold uppercase tracking-wider">Total geral</td>
                            <td colSpan={3} />
                            <td className="px-4 py-3 text-right text-white font-bold tabular-nums">{gt.total.toLocaleString("pt-BR")}</td>
                            <td className="px-4 py-3 text-right text-emerald-400 font-bold tabular-nums">{gt.realizadas.toLocaleString("pt-BR")}</td>
                            <td className="px-4 py-3 text-right text-blue-300 font-bold tabular-nums">{gt.agendadas.toLocaleString("pt-BR")}</td>
                            <td className="px-4 py-3 text-right text-orange-400 font-bold tabular-nums">{gt.semAgend.toLocaleString("pt-BR")}</td>
                            <td className="px-4 py-3 text-right">
                              <span className={`font-bold text-sm ${gtColor}`}>{gtTaxa.toFixed(1)}%</span>
                            </td>
                            <td className="px-4 py-3 text-right text-red-400 font-bold tabular-nums">{gt.pendencias.toLocaleString("pt-BR")}</td>
                          </tr>
                        </tfoot>
                      );
                    })()}
                  </table>
                </div>
              </div>
            </div>

            {/* Comparison panel */}
            <div className="bg-white/4 rounded-xl border border-white/8 p-6">
              <div className="flex items-center gap-3 mb-5">
                <CalendarRange className="w-5 h-5 text-amber-400" />
                <h2 className="text-base font-semibold text-white">Comparativo de Anos</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                <div>
                  <label className="block text-xs text-white/40 mb-1">Tipo de Ciclo</label>
                  <select
                    value={selectedTipo}
                    onChange={(e) => { setSelectedTipo(e.target.value); setYearA(""); setYearB(""); setCompareResult(null); }}
                    className="w-full bg-[#0a1929] [color-scheme:dark] border border-white/15 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-400/60"
                  >
                    <option value="">Selecione o tipo</option>
                    {tiposAvailable.map((t) => (
                      <option key={t} value={t}>{TIPO_LABELS[t] ?? t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Ano A (base)</label>
                  <select
                    value={yearA}
                    onChange={(e) => { setYearA(e.target.value); setCompareResult(null); }}
                    disabled={!selectedTipo}
                    className="w-full bg-[#0a1929] [color-scheme:dark] border border-white/15 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-400/60 disabled:opacity-40"
                  >
                    <option value="">Selecione o ano</option>
                    {yearsForTipo.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Ano B (comparação)</label>
                  <select
                    value={yearB}
                    onChange={(e) => { setYearB(e.target.value); setCompareResult(null); }}
                    disabled={!selectedTipo}
                    className="w-full bg-[#0a1929] [color-scheme:dark] border border-white/15 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-400/60 disabled:opacity-40"
                  >
                    <option value="">Selecione o ano</option>
                    {yearsForTipo.filter((y) => String(y) !== yearA).map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleCompare}
                  disabled={!selectedTipo || !yearA || !yearB || comparing}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-[#001E3C] font-semibold rounded-lg text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {comparing ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart2 className="w-4 h-4" />}
                  Comparar
                </button>

                <Link
                  href="/planejamentopta"
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-medium rounded-lg text-sm transition-colors"
                >
                  <CalendarRange className="w-4 h-4" /> Planejar PTA
                </Link>
              </div>

              {compareError && (
                <div className="mt-4 px-3 py-2 bg-red-500/15 border border-red-500/30 rounded-lg text-red-300 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {compareError}
                </div>
              )}

              {/* Compare result table */}
              {compareResult && (
                <div className="mt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <TypeBadge tipo={compareResult.tipo_ciclo} />
                    <span className="text-white font-semibold text-sm">
                      {compareResult.a.year} <span className="text-white/30 mx-1 text-xs">(base)</span>
                      <span className="text-white/30 mx-1">→</span>
                      {compareResult.b.year} <span className="text-white/30 mx-1 text-xs">(atual)</span>
                    </span>
                    {compareResult.can_plan_pta ? (
                      <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Anos próximos — planejamento de PTA possível
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded bg-white/8 text-white/30 border border-white/12">
                        Distância &gt; 2 anos — planejamento desabilitado
                      </span>
                    )}
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-white/8">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/8 bg-white/4 text-xs text-white/40">
                          <th className="px-4 py-2.5 text-left font-medium">Indicador</th>
                          <th className="px-4 py-2.5 text-right font-medium">{compareResult.a.year} <span className="text-white/30 font-normal">(base)</span></th>
                          <th className="px-4 py-2.5 text-right font-medium">{compareResult.b.year} <span className="text-white/30 font-normal">(atual)</span></th>
                          <th className="px-4 py-2.5 text-right font-medium">Variação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {METRICS.map((m) => {
                          const valA = compareResult.a.indicators?.[m.key];
                          const valB = compareResult.b.indicators?.[m.key];
                          if (valA == null && valB == null) return null;
                          return (
                            <tr key={m.key} className="border-b border-white/5 hover:bg-white/4 transition-colors">
                              <td className="px-4 py-2.5 text-white/70">{m.label}</td>
                              <td className="px-4 py-2.5 text-right text-white/60 tabular-nums">
                                {valA != null ? `${valA.toLocaleString("pt-BR")}${m.unit ?? ""}` : "—"}
                              </td>
                              <td className="px-4 py-2.5 text-right text-white font-medium tabular-nums">
                                {valB != null ? `${valB.toLocaleString("pt-BR")}${m.unit ?? ""}` : "—"}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <Delta a={valA} b={valB} higherIsBetter={m.higherIsBetter} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-2 flex gap-4 text-xs text-white/30">
                    <span>{compareResult.a.year}: {compareResult.a.total_rows.toLocaleString("pt-BR")} atividades — {compareResult.a.source_file}</span>
                    <span>{compareResult.b.year}: {compareResult.b.total_rows.toLocaleString("pt-BR")} atividades — {compareResult.b.source_file}</span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>
      <AppFooter />
    </div>
  );
}
