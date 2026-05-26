"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/layout/AppHeader";
import AppFooter from "@/components/layout/AppFooter";
import EmptyState from "@/components/ui/EmptyState";
import { BarChart2, Upload, RefreshCw, FileSpreadsheet, CheckCircle, Clock, AlertCircle, Loader2, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { Analysis } from "@/types/analysis";

const STATUS_CONFIG = {
  completed: { label: "Concluída", icon: CheckCircle, color: "text-emerald-400 bg-emerald-400/15 border-emerald-400/25" },
  processing: { label: "Processando", icon: Loader2, color: "text-blue-300 bg-blue-400/15 border-blue-400/25" },
  pending: { label: "Pendente", icon: Clock, color: "text-yellow-300 bg-yellow-400/15 border-yellow-400/25" },
  error: { label: "Erro", icon: AlertCircle, color: "text-red-400 bg-red-400/15 border-red-400/25" },
};

const TYPE_LABEL: Record<string, string> = {
  ciclos: "Ciclos de Fiscalização",
  generic: "Genérico",
  unknown: "Desconhecido",
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function formatDate(iso: string) {
  const utc = iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z";
  return new Date(utc).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AnalisesPage() {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async (id: string, filename: string) => {
    if (!confirm(`Deletar "${filename}"?`)) return;
    try {
      await api.delete(`/api/v1/analyses/${id}`);
      setAnalyses((prev) => prev.filter((a) => a.id !== id));
      setTotal((prev) => prev - 1);
    } catch {
      alert("Erro ao deletar análise.");
    }
  };

  const fetchAnalyses = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get("/api/v1/analyses?per_page=50");
      setAnalyses(data.items);
      setTotal(data.total);
    } catch {
      setError("Não foi possível carregar as análises. Verifique se a API está em execução.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAnalyses(); }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <Link href="/" className="text-sm text-blue-300/60 hover:text-blue-300 transition-colors">← Início</Link>
            <h1 className="text-2xl font-bold text-white mt-3">Análises</h1>
            <p className="text-blue-200/50 text-sm mt-1">
              {total > 0 ? `${total} planilha${total !== 1 ? "s" : ""} importada${total !== 1 ? "s" : ""}` : "Histórico de planilhas importadas"}
            </p>
          </div>
          <div className="flex gap-2 mt-6">
            <button
              onClick={fetchAnalyses}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-blue-200/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/12 rounded-lg transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Atualizar
            </button>
            <Link
              href="/upload"
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#003A70] hover:bg-[#0057A8] rounded-lg transition-colors"
            >
              <Upload className="w-3.5 h-3.5" /> Nova análise
            </Link>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 gap-2 text-blue-200/50">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Carregando análises...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2 text-red-400">
              <AlertCircle className="w-8 h-8" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          ) : analyses.length === 0 ? (
            <EmptyState
              icon={BarChart2}
              title="Nenhuma análise encontrada"
              description="Importe uma planilha para começar. Os resultados aparecerão aqui."
            />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-blue-200/60 text-xs uppercase tracking-wide">Arquivo</th>
                  <th className="text-left px-4 py-3 font-medium text-blue-200/60 text-xs uppercase tracking-wide">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-blue-200/60 text-xs uppercase tracking-wide">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-blue-200/60 text-xs uppercase tracking-wide">Linhas</th>
                  <th className="text-left px-4 py-3 font-medium text-blue-200/60 text-xs uppercase tracking-wide">Data</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {analyses.map((a) => (
                  <tr key={a.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-blue-300/50 flex-shrink-0" />
                        <span className="font-medium text-white truncate max-w-xs">{a.original_filename}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-blue-200/55">{TYPE_LABEL[a.detected_type] ?? a.detected_type}</td>
                    <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                    <td className="px-4 py-3 text-right text-blue-200/70">{a.total_rows.toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-3 text-blue-200/50 whitespace-nowrap">{formatDate(a.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link href={`/analises/${a.id}`} className="text-blue-300 hover:text-white font-medium text-xs transition-colors">
                          Ver →
                        </Link>
                        <button
                          onClick={() => handleDelete(a.id, a.original_filename)}
                          className="text-white/20 hover:text-red-400 transition-colors"
                          title="Deletar análise"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
