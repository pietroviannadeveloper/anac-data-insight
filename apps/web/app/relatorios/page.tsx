"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AppHeader from "@/components/layout/AppHeader";
import AppFooter from "@/components/layout/AppFooter";
import { api } from "@/lib/api";
import {
  FileText, Download, Loader2, AlertCircle,
  CheckCircle2, Clock, BarChart2, Inbox,
} from "lucide-react";

interface Analysis {
  id: string;
  original_filename: string;
  detected_type: string;
  status: string;
  total_rows: number;
  total_columns: number;
  created_at: string;
  completed_at?: string;
  indicators?: {
    total_atividades?: number;
    taxa_execucao?: number;
    pendencias_criticas?: number;
    by_type?: Record<string, { total_atividades: number }>;
  };
}

const TIPO_LABEL: Record<string, string> = {
  ciclos:  "Ciclos de Fiscalização",
  generic: "Planilha Genérica",
  unknown: "Tipo Desconhecido",
};

function StatusChip({ status }: { status: string }) {
  if (status === "completed")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-400/15 text-emerald-400 border border-emerald-400/25">
        <CheckCircle2 className="w-3 h-3" /> Concluída
      </span>
    );
  if (status === "processing")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-400/15 text-blue-300 border border-blue-400/25">
        <Loader2 className="w-3 h-3 animate-spin" /> Processando
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 text-white/40 border border-white/15">
      <Clock className="w-3 h-3" /> {status}
    </span>
  );
}

function AnalysisCard({ analysis }: { analysis: Analysis }) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownloadPdf = async () => {
    setDownloading(true);
    setError(null);
    try {
      const blob = await api.download(`/api/v1/analyses/${analysis.id}/export/pdf`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${analysis.original_filename.replace(/\.[^.]+$/, "")}_relatorio.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao baixar PDF.");
    } finally {
      setDownloading(false);
    }
  };

  const date = new Date(analysis.created_at).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const ind = analysis.indicators;
  const byType = ind?.by_type;
  const tipoKeys = byType ? Object.keys(byType) : [];

  const TIPO_BADGE: Record<string, string> = {
    CICLO_BASE:       "bg-indigo-400/15 text-indigo-300 border-indigo-400/25",
    CICLO_DESEMPENHO: "bg-purple-400/15 text-purple-300 border-purple-400/25",
    NAO_PROGRAMADA:   "bg-orange-400/15 text-orange-300 border-orange-400/25",
  };
  const TIPO_NOME: Record<string, string> = {
    CICLO_BASE:       "Base",
    CICLO_DESEMPENHO: "Desempenho",
    NAO_PROGRAMADA:   "Não Prog.",
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-white/20 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <StatusChip status={analysis.status} />
            <span className="text-xs text-blue-200/40">{TIPO_LABEL[analysis.detected_type] ?? analysis.detected_type}</span>
          </div>
          <h3 className="text-sm font-semibold text-white truncate" title={analysis.original_filename}>
            {analysis.original_filename}
          </h3>
          <p className="text-xs text-blue-200/40 mt-0.5">{date}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/analises/${analysis.id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-300 border border-blue-400/30 rounded-lg hover:bg-blue-400/10 transition-colors"
          >
            <BarChart2 className="w-3.5 h-3.5" /> Ver análise
          </Link>
          {analysis.status === "completed" ? (
            <button
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#003A70] bg-white hover:bg-blue-50 rounded-lg transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {downloading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Download className="w-3.5 h-3.5" />}
              {downloading ? "Gerando..." : "Baixar PDF"}
            </button>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/25 border border-white/10 rounded-lg cursor-not-allowed">
              <FileText className="w-3.5 h-3.5" /> PDF indisponível
            </span>
          )}
        </div>
      </div>

      {/* Indicators strip */}
      {ind && analysis.status === "completed" && (
        <div className="mt-4 pt-4 border-t border-white/8">
          <div className="flex items-center gap-6 flex-wrap">
            <div>
              <p className="text-xs text-blue-200/40">Total de atividades</p>
              <p className="text-lg font-bold text-white">{(ind.total_atividades ?? 0).toLocaleString("pt-BR")}</p>
            </div>
            <div>
              <p className="text-xs text-blue-200/40">Taxa de execução</p>
              <p className={`text-lg font-bold ${(ind.taxa_execucao ?? 0) >= 80 ? "text-emerald-400" : (ind.taxa_execucao ?? 0) >= 50 ? "text-amber-400" : "text-red-400"}`}>
                {(ind.taxa_execucao ?? 0).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-blue-200/40">Pendências críticas</p>
              <p className={`text-lg font-bold ${(ind.pendencias_criticas ?? 0) === 0 ? "text-emerald-400" : "text-red-400"}`}>
                {ind.pendencias_criticas ?? 0}
              </p>
            </div>
            {tipoKeys.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {tipoKeys.map(tipo => (
                  <span
                    key={tipo}
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${TIPO_BADGE[tipo] ?? "bg-white/10 text-white/40 border-white/15"}`}
                  >
                    {TIPO_NOME[tipo] ?? tipo}
                    <span className="ml-1 text-white/40">{byType?.[tipo]?.total_atividades ?? 0}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-400 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5" /> {error}
        </p>
      )}
    </div>
  );
}

function RelatoriosInner() {
  const searchParams = useSearchParams();
  const highlightId  = searchParams.get("analysis_id") ?? null;

  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get("/api/v1/analyses?per_page=100");
        setAnalyses(data.items ?? []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Não foi possível carregar as análises.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // rola até o card destacado após carregar
  useEffect(() => {
    if (!loading && highlightId && highlightRef.current) {
      setTimeout(() => highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 200);
    }
  }, [loading, highlightId]);

  const completed = analyses.filter(a => a.status === "completed");
  const others    = analyses.filter(a => a.status !== "completed");

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Relatórios</h1>
          <p className="text-blue-200/50 text-sm mt-1">
            Baixe o relatório executivo em PDF de cada análise concluída.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-blue-200/50">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Carregando análises...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20 gap-2 text-red-400">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm">{error}</span>
          </div>
        ) : analyses.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-xl py-20 flex flex-col items-center gap-3 text-blue-200/40">
            <Inbox className="w-10 h-10" />
            <p className="text-sm">Nenhuma análise encontrada.</p>
            <Link href="/upload" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
              Fazer upload de planilha →
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {completed.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-blue-200/50 mb-3">
                  Concluídas — {completed.length} {completed.length === 1 ? "análise" : "análises"}
                </h2>
                <div className="space-y-3">
                  {completed.map(a => (
                    <div key={a.id} ref={a.id === highlightId ? highlightRef : undefined}
                      className={a.id === highlightId ? "ring-2 ring-blue-400/50 rounded-xl" : ""}>
                      <AnalysisCard analysis={a} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {others.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-blue-200/50 mb-3">
                  Em andamento / outros
                </h2>
                <div className="space-y-3">
                  {others.map(a => (
                    <div key={a.id} ref={a.id === highlightId ? highlightRef : undefined}
                      className={a.id === highlightId ? "ring-2 ring-blue-400/50 rounded-xl" : ""}>
                      <AnalysisCard analysis={a} />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
      <AppFooter />
    </div>
  );
}

export default function RelatoriosPage() {
  return (
    <Suspense>
      <RelatoriosInner />
    </Suspense>
  );
}
