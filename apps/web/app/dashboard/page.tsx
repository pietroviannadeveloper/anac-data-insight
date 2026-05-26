"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/layout/AppHeader";
import AppFooter from "@/components/layout/AppFooter";
import { api } from "@/lib/api";
import { Analysis, CicloIndicators } from "@/types/analysis";
import { BarChart2, Upload, Loader2, CheckCircle, Clock, AlertCircle, TrendingUp, FileSpreadsheet } from "lucide-react";
import { LucideIcon } from "lucide-react";

function StatCard({ label, value, icon: Icon, accent = false }: {
  label: string; value: string | number; icon: LucideIcon; accent?: boolean;
}) {
  return (
    <div className="bg-white/8 backdrop-blur-sm border border-white/12 rounded-xl p-5 flex items-center gap-4">
      <div className={`p-2.5 rounded-lg flex-shrink-0 ${accent ? "bg-blue-500/20" : "bg-white/8"}`}>
        <Icon className={`w-5 h-5 ${accent ? "text-blue-300" : "text-white/50"}`} />
      </div>
      <div>
        <p className="text-xs text-blue-200/50 uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
      </div>
    </div>
  );
}

type AnalysisWithIndicators = Analysis & { indicators?: CicloIndicators };

export default function DashboardPage() {
  const [analyses, setAnalyses] = useState<AnalysisWithIndicators[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.get("/api/v1/analyses?per_page=100");
        setAnalyses(data.items);
      } catch {
        setError("Não foi possível carregar os dados. Verifique se a API está em execução.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const ciclos = analyses.filter((a) => a.detected_type === "ciclos" && a.indicators);
  const totalLinhas = analyses.reduce((s, a) => s + a.total_rows, 0);
  const concluidas = analyses.filter((a) => a.status === "completed").length;
  const comErro = analyses.filter((a) => a.status === "error").length;

  const avgExecucao = ciclos.length > 0
    ? Math.round(ciclos.reduce((s, a) => s + (a.indicators?.taxa_execucao ?? 0), 0) / ciclos.length)
    : null;

  const totalPendencias = ciclos.reduce((s, a) => s + (a.indicators?.pendencias_criticas ?? 0), 0);

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <Link href="/" className="text-sm text-blue-300/60 hover:text-blue-300 transition-colors">← Início</Link>
            <h1 className="text-2xl font-bold text-white mt-3">Dashboard</h1>
            <p className="text-blue-200/50 text-sm mt-1">Visão consolidada de todas as análises.</p>
          </div>
          <Link
            href="/upload"
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#003A70] hover:bg-[#0057A8] rounded-lg transition-colors mt-6"
          >
            <Upload className="w-3.5 h-3.5" /> Nova análise
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-blue-200/50">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Carregando dashboard...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-red-400">
            <AlertCircle className="w-8 h-8" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        ) : analyses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-blue-200/40">
            <BarChart2 className="w-10 h-10" />
            <p className="text-sm font-medium">Nenhuma análise disponível ainda.</p>
            <Link href="/upload" className="text-sm text-blue-300 hover:text-white font-medium transition-colors">Importar primeira planilha →</Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard label="Total de análises" value={analyses.length} icon={FileSpreadsheet} accent />
              <StatCard label="Linhas processadas" value={totalLinhas.toLocaleString("pt-BR")} icon={BarChart2} accent />
              <StatCard label="Concluídas" value={concluidas} icon={CheckCircle} />
              <StatCard label="Com erro" value={comErro} icon={AlertCircle} />
            </div>

            {ciclos.length > 0 && (
              <>
                <h2 className="text-sm font-semibold text-blue-200/60 uppercase tracking-wide mb-3">Indicadores de Ciclos</h2>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                  <StatCard label="Análises de ciclos" value={ciclos.length} icon={Clock} />
                  <StatCard
                    label="Taxa média de execução"
                    value={avgExecucao !== null ? `${avgExecucao}%` : "—"}
                    icon={TrendingUp}
                    accent={avgExecucao !== null && avgExecucao >= 80}
                  />
                  <StatCard
                    label="Pendências críticas totais"
                    value={totalPendencias}
                    icon={AlertCircle}
                  />
                </div>
              </>
            )}

            <h2 className="text-sm font-semibold text-blue-200/60 uppercase tracking-wide mb-3">Análises Recentes</h2>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-white/5 border-b border-white/10">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-blue-200/60 text-xs uppercase tracking-wide">Arquivo</th>
                    <th className="text-left px-4 py-3 font-medium text-blue-200/60 text-xs uppercase tracking-wide">Tipo</th>
                    <th className="text-right px-4 py-3 font-medium text-blue-200/60 text-xs uppercase tracking-wide">Linhas</th>
                    <th className="text-right px-4 py-3 font-medium text-blue-200/60 text-xs uppercase tracking-wide">Execução</th>
                    <th className="text-right px-4 py-3 font-medium text-blue-200/60 text-xs uppercase tracking-wide">Pendências</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {analyses.slice(0, 10).map((a) => (
                    <tr key={a.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/analises/${a.id}`} className="font-medium text-blue-300 hover:text-white transition-colors truncate max-w-xs block">
                          {a.original_filename}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-blue-200/50 text-xs">{a.detected_type === "ciclos" ? "Ciclos" : "Genérico"}</td>
                      <td className="px-4 py-3 text-right text-blue-200/70">{a.total_rows.toLocaleString("pt-BR")}</td>
                      <td className="px-4 py-3 text-right">
                        {a.indicators ? (
                          <span className={`font-semibold ${a.indicators.taxa_execucao >= 80 ? "text-emerald-400" : "text-red-400"}`}>
                            {a.indicators.taxa_execucao}%
                          </span>
                        ) : <span className="text-white/20">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {a.indicators ? (
                          <span className={`font-semibold ${a.indicators.pendencias_criticas > 0 ? "text-red-400" : "text-emerald-400"}`}>
                            {a.indicators.pendencias_criticas}
                          </span>
                        ) : <span className="text-white/20">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
      <AppFooter />
    </div>
  );
}
