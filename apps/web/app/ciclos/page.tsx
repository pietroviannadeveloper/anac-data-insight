"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import AppHeader from "@/components/layout/AppHeader";
import AppFooter from "@/components/layout/AppFooter";
import EmptyState from "@/components/ui/EmptyState";
import {
  RefreshCcw, Loader2, AlertCircle, CheckCircle, Clock,
  TrendingUp, AlertTriangle, FileSpreadsheet, Filter, X,
} from "lucide-react";
import { api } from "@/lib/api";
import { Analysis, CicloIndicators } from "@/types/analysis";

type AnalysisWithIndicators = Analysis & { indicators?: CicloIndicators };

const CRITICALITY = (taxa: number) => {
  if (taxa >= 90) return { label: "Regular", cls: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" };
  if (taxa >= 70) return { label: "Atenção", cls: "text-yellow-300 bg-yellow-400/10 border-yellow-400/20" };
  if (taxa >= 50) return { label: "Crítico", cls: "text-orange-400 bg-orange-400/10 border-orange-400/20" };
  return { label: "Muito crítico", cls: "text-red-400 bg-red-400/10 border-red-400/20" };
};

const formatDate = (iso: string) => {
  const utc = iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z";
  return new Date(utc).toLocaleDateString("pt-BR");
};

export default function CiclosPage() {
  const [analyses, setAnalyses] = useState<AnalysisWithIndicators[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCriticality, setFilterCriticality] = useState<string>("");
  const [filterSearch, setFilterSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.get("/api/v1/analyses?per_page=100");
        const ciclos = (data.items as AnalysisWithIndicators[]).filter(
          (a) => a.detected_type === "ciclos" && a.status === "completed"
        );
        setAnalyses(ciclos);
      } catch {
        setError("Não foi possível carregar os ciclos. Verifique se a API está em execução.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    return analyses.filter((a) => {
      const taxa = a.indicators?.taxa_execucao ?? 0;
      const crit = CRITICALITY(taxa).label;

      if (filterCriticality && crit !== filterCriticality) return false;
      if (filterSearch) {
        const q = filterSearch.toLowerCase();
        if (!a.original_filename.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [analyses, filterCriticality, filterSearch]);

  const avgExecucao = useMemo(() => {
    const withIndicators = analyses.filter((a) => a.indicators);
    if (withIndicators.length === 0) return null;
    return Math.round(
      withIndicators.reduce((s, a) => s + (a.indicators?.taxa_execucao ?? 0), 0) /
      withIndicators.length
    );
  }, [analyses]);

  const totalPendencias = useMemo(
    () => analyses.reduce((s, a) => s + (a.indicators?.pendencias_criticas ?? 0), 0),
    [analyses]
  );

  const totalLinhas = useMemo(
    () => analyses.reduce((s, a) => s + a.total_rows, 0),
    [analyses]
  );

  const hasFilters = filterCriticality || filterSearch;

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
          <div>
            <Link href="/" className="text-sm text-blue-300/60 hover:text-blue-300 transition-colors">
              ← Início
            </Link>
            <h1 className="text-2xl font-bold text-white mt-3">Ciclos de Fiscalização</h1>
            <p className="text-blue-200/50 text-sm mt-1">
              Acompanhamento de execução e pendências por ciclo.
            </p>
          </div>
          <Link
            href="/upload"
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#003A70] hover:bg-[#0057A8] rounded-lg transition-colors mt-6"
          >
            Importar planilha
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-blue-200/50">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Carregando ciclos...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-red-400">
            <AlertCircle className="w-8 h-8" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        ) : analyses.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
            <EmptyState
              icon={RefreshCcw}
              title="Nenhum ciclo importado"
              description="Importe uma planilha de ciclos para visualizar os indicadores aqui."
            />
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-1">
                  <RefreshCcw className="w-4 h-4 text-blue-300/50" />
                  <p className="text-xs text-blue-200/50 uppercase tracking-wide">Ciclos</p>
                </div>
                <p className="text-2xl font-bold text-white">{analyses.length}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-1">
                  <FileSpreadsheet className="w-4 h-4 text-blue-300/50" />
                  <p className="text-xs text-blue-200/50 uppercase tracking-wide">Atividades</p>
                </div>
                <p className="text-2xl font-bold text-white">{totalLinhas.toLocaleString("pt-BR")}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-blue-300/50" />
                  <p className="text-xs text-blue-200/50 uppercase tracking-wide">Taxa média</p>
                </div>
                <p className={`text-2xl font-bold ${avgExecucao !== null && avgExecucao >= 80 ? "text-emerald-400" : "text-orange-400"}`}>
                  {avgExecucao !== null ? `${avgExecucao}%` : "—"}
                </p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-red-300/50" />
                  <p className="text-xs text-blue-200/50 uppercase tracking-wide">Pendências críticas</p>
                </div>
                <p className={`text-2xl font-bold ${totalPendencias > 0 ? "text-red-400" : "text-emerald-400"}`}>
                  {totalPendencias}
                </p>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-blue-200/40" />
                <span className="text-xs text-blue-200/40 uppercase tracking-wide">Filtros</span>
              </div>

              <input
                type="text"
                placeholder="Buscar por nome..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-blue-200/80 placeholder:text-blue-200/30 focus:outline-none focus:border-blue-400/50 w-48"
              />

              <select
                value={filterCriticality}
                onChange={(e) => setFilterCriticality(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-blue-200/80 focus:outline-none focus:border-blue-400/50"
              >
                <option value="">Todas as criticidades</option>
                <option value="Regular">Regular (≥90%)</option>
                <option value="Atenção">Atenção (70–89%)</option>
                <option value="Crítico">Crítico (50–69%)</option>
                <option value="Muito crítico">Muito crítico (&lt;50%)</option>
              </select>

              {hasFilters && (
                <button
                  onClick={() => { setFilterCriticality(""); setFilterSearch(""); }}
                  className="flex items-center gap-1 px-2.5 py-2 text-xs text-blue-200/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors"
                >
                  <X className="w-3 h-3" />
                  Limpar
                </button>
              )}

              <span className="text-xs text-blue-200/30 ml-auto">
                {filtered.length} de {analyses.length}
              </span>
            </div>

            {/* Table */}
            <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 gap-2 text-blue-200/40">
                  <RefreshCcw className="w-8 h-8" />
                  <p className="text-sm">Nenhum ciclo corresponde aos filtros.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-blue-200/60 text-xs uppercase tracking-wide">Arquivo</th>
                      <th className="text-right px-4 py-3 font-medium text-blue-200/60 text-xs uppercase tracking-wide">Atividades</th>
                      <th className="text-right px-4 py-3 font-medium text-blue-200/60 text-xs uppercase tracking-wide">Realizadas</th>
                      <th className="text-right px-4 py-3 font-medium text-blue-200/60 text-xs uppercase tracking-wide">Taxa exec.</th>
                      <th className="text-center px-4 py-3 font-medium text-blue-200/60 text-xs uppercase tracking-wide">Criticidade</th>
                      <th className="text-right px-4 py-3 font-medium text-blue-200/60 text-xs uppercase tracking-wide">Pendências</th>
                      <th className="text-left px-4 py-3 font-medium text-blue-200/60 text-xs uppercase tracking-wide">Data</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filtered.map((a) => {
                      const ind = a.indicators;
                      const taxa = ind?.taxa_execucao ?? 0;
                      const crit = CRITICALITY(taxa);
                      return (
                        <tr key={a.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <RefreshCcw className="w-4 h-4 text-blue-300/50 flex-shrink-0" />
                              <span className="font-medium text-white truncate max-w-[220px]">
                                {a.original_filename}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-blue-200/70 tabular-nums">
                            {ind ? ind.total_atividades.toLocaleString("pt-BR") : "—"}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {ind ? (
                              <span className="text-emerald-400">{ind.realizadas.toLocaleString("pt-BR")}</span>
                            ) : "—"}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {ind ? (
                              <span className={`font-semibold ${taxa >= 80 ? "text-emerald-400" : taxa >= 50 ? "text-yellow-300" : "text-red-400"}`}>
                                {taxa}%
                              </span>
                            ) : "—"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {ind ? (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${crit.cls}`}>
                                {crit.label}
                              </span>
                            ) : "—"}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {ind ? (
                              <span className={`font-semibold ${ind.pendencias_criticas > 0 ? "text-red-400" : "text-emerald-400"}`}>
                                {ind.pendencias_criticas}
                              </span>
                            ) : "—"}
                          </td>
                          <td className="px-4 py-3 text-blue-200/50 whitespace-nowrap">
                            {formatDate(a.created_at)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              href={`/analises/${a.id}`}
                              className="text-blue-300 hover:text-white font-medium text-xs transition-colors"
                            >
                              Ver →
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 mt-4">
              <span className="text-xs text-blue-200/30">Legenda de criticidade:</span>
              {[
                { label: "Regular", cls: "text-emerald-400", desc: "≥90%" },
                { label: "Atenção", cls: "text-yellow-300", desc: "70–89%" },
                { label: "Crítico", cls: "text-orange-400", desc: "50–69%" },
                { label: "Muito crítico", cls: "text-red-400", desc: "<50%" },
              ].map(({ label, cls, desc }) => (
                <span key={label} className="flex items-center gap-1 text-xs">
                  <span className={`font-medium ${cls}`}>{label}</span>
                  <span className="text-blue-200/30">({desc})</span>
                </span>
              ))}
            </div>
          </>
        )}
      </main>
      <AppFooter />
    </div>
  );
}
