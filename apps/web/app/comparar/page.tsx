"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AppHeader from "@/components/layout/AppHeader";
import AppFooter from "@/components/layout/AppFooter";
import { api } from "@/lib/api";
import { Analysis, CicloIndicators } from "@/types/analysis";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Loader2, AlertCircle } from "lucide-react";

type AnalysisWithInd = Analysis & { indicators?: CicloIndicators & Record<string, number> };

const METRICS: { key: keyof CicloIndicators; label: string; higherIsBetter: boolean; unit?: string }[] = [
  { key: "total_atividades",    label: "Total de Atividades",    higherIsBetter: true },
  { key: "realizadas",          label: "Realizadas",             higherIsBetter: true },
  { key: "agendadas",           label: "Agendadas",              higherIsBetter: true },
  { key: "sem_agendamento",     label: "Sem Agendamento",        higherIsBetter: false },
  { key: "taxa_execucao",       label: "Taxa de Execução",       higherIsBetter: true,  unit: "%" },
  { key: "taxa_agendamento",    label: "Taxa de Agendamento",    higherIsBetter: true,  unit: "%" },
  { key: "sem_giaso",           label: "Sem GIASO",              higherIsBetter: false },
  { key: "sem_pcdp",            label: "Sem PCDP",               higherIsBetter: false },
  { key: "sem_processo",        label: "Sem Processo",           higherIsBetter: false },
  { key: "locais_indefinidos",  label: "Locais Indefinidos",     higherIsBetter: false },
  { key: "pcdp_duplicada",      label: "PCDP Duplicada",         higherIsBetter: false },
  { key: "pendencias_criticas", label: "Pendências Críticas",    higherIsBetter: false },
];

function Delta({ a, b, higherIsBetter }: { a?: number; b?: number; higherIsBetter: boolean }) {
  if (a == null || b == null) return <span className="text-white/20">—</span>;
  const diff = b - a;
  if (diff === 0) return <span className="flex items-center gap-1 text-white/40 text-xs"><Minus className="w-3 h-3" /> igual</span>;
  const positive = diff > 0;
  const good = positive === higherIsBetter;
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${good ? "text-emerald-400" : "text-red-400"}`}>
      {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {positive ? "+" : ""}{diff.toFixed(diff % 1 === 0 ? 0 : 1)}
    </span>
  );
}

function MetricCell({ value, unit }: { value?: number; unit?: string }) {
  if (value == null) return <span className="text-white/20">—</span>;
  return <span className="tabular-nums">{value.toLocaleString("pt-BR")}{unit}</span>;
}

function ComparePage() {
  const searchParams = useSearchParams();
  const idA = searchParams.get("a");
  const idB = searchParams.get("b");

  const [analysisA, setAnalysisA] = useState<AnalysisWithInd | null>(null);
  const [analysisB, setAnalysisB] = useState<AnalysisWithInd | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!idA || !idB) { setError("Informe dois IDs de análise via ?a=...&b=..."); setLoading(false); return; }
    Promise.all([api.get(`/api/v1/analyses/${idA}`), api.get(`/api/v1/analyses/${idB}`)])
      .then(([a, b]) => { setAnalysisA(a); setAnalysisB(b); })
      .catch(() => setError("Não foi possível carregar uma ou ambas as análises."))
      .finally(() => setLoading(false));
  }, [idA, idB]);

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-6">
          <Link href="/analises" className="text-sm text-blue-300/60 hover:text-blue-300 transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar para análises
          </Link>
          <h1 className="text-2xl font-bold text-white mt-3">Comparativo de Análises</h1>
          <p className="text-blue-200/50 text-sm mt-1">Métricas lado a lado com indicação de melhora ou piora.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-blue-200/50">
            <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Carregando...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-red-400">
            <AlertCircle className="w-6 h-6" /><p className="text-sm">{error}</p>
          </div>
        ) : analysisA && analysisB ? (
          <>
            {/* Headers */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div />
              {[analysisA, analysisB].map((a, i) => (
                <div key={a.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <p className="text-xs text-blue-200/40 uppercase tracking-wide mb-1">{i === 0 ? "Análise A (base)" : "Análise B (comparação)"}</p>
                  <Link href={`/analises/${a.id}`} className="text-sm font-semibold text-white hover:text-blue-300 transition-colors block truncate">
                    {a.original_filename}
                  </Link>
                  <p className="text-xs text-blue-200/40 mt-0.5">
                    {new Date(a.created_at + (a.created_at.endsWith("Z") ? "" : "Z")).toLocaleDateString("pt-BR")}
                    {a.version && a.version > 1 && <span className="ml-2 text-blue-300/50">v{a.version}</span>}
                  </p>
                </div>
              ))}
            </div>

            {/* Metrics table */}
            {analysisA.detected_type === "ciclos" && analysisB.detected_type === "ciclos" ? (
              <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-medium text-blue-200/60 uppercase tracking-wide">Métrica</th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-blue-200/60 max-w-[180px]">
                        <span className="block text-[10px] text-blue-200/40 uppercase tracking-wide mb-0.5">Base</span>
                        <span className="block text-white/70 normal-case font-semibold text-xs truncate" title={analysisA.original_filename}>
                          {analysisA.original_filename.length > 28 ? analysisA.original_filename.slice(0, 28) + "…" : analysisA.original_filename}
                        </span>
                      </th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-blue-200/60 max-w-[180px]">
                        <span className="block text-[10px] text-blue-200/40 uppercase tracking-wide mb-0.5">Comparação</span>
                        <span className="block text-white/70 normal-case font-semibold text-xs truncate" title={analysisB.original_filename}>
                          {analysisB.original_filename.length > 28 ? analysisB.original_filename.slice(0, 28) + "…" : analysisB.original_filename}
                        </span>
                      </th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-blue-200/60 uppercase tracking-wide">Variação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {METRICS.map(m => {
                      const vA = analysisA.indicators?.[m.key] as number | undefined;
                      const vB = analysisB.indicators?.[m.key] as number | undefined;
                      return (
                        <tr key={m.key} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3 text-blue-200/70">{m.label}</td>
                          <td className="px-4 py-3 text-center text-white"><MetricCell value={vA} unit={m.unit} /></td>
                          <td className="px-4 py-3 text-center text-white"><MetricCell value={vB} unit={m.unit} /></td>
                          <td className="px-4 py-3 text-center"><Delta a={vA} b={vB} higherIsBetter={m.higherIsBetter} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-white/5 border border-white/10 rounded-xl p-10 text-center">
                <p className="text-sm text-blue-200/50">O comparativo detalhado de métricas está disponível apenas para análises do tipo <strong>Ciclos</strong>.</p>
                <p className="text-xs text-blue-200/30 mt-2">
                  Tipo A: {analysisA.detected_type} · Tipo B: {analysisB.detected_type}
                </p>
              </div>
            )}
          </>
        ) : null}
      </main>
      <AppFooter />
    </div>
  );
}

export default function CompararPage() {
  return <Suspense><ComparePage /></Suspense>;
}
