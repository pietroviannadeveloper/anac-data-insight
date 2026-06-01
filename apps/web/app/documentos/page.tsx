"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import AppHeader from "@/components/layout/AppHeader";
import AppFooter from "@/components/layout/AppFooter";
import EmptyState from "@/components/ui/EmptyState";
import { api } from "@/lib/api";
import {
  FileScan, Loader2, AlertCircle, FileText, BarChart2,
  BookOpen, Type, Download, Eye, RefreshCw, Search, X,
} from "lucide-react";

interface PdfAnalysis {
  id: string;
  original_filename: string;
  detected_type: string;
  status: string;
  total_rows: number;      // pages for PDFs
  total_columns: number;
  created_at: string;
  completed_at?: string;
  indicators?: {
    pages?: number;
    word_count?: number;
    char_count?: number;
    title?: string;
    author?: string;
    text_preview?: string;
  };
}

const formatDate = (iso: string) => {
  const utc = iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z";
  return new Date(utc).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
};

function StatCard({ icon: Icon, label, value, sub }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-amber-300/60" />
        <p className="text-xs text-blue-200/50 uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-blue-200/35 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function DocumentosPage() {
  const [docs, setDocs] = useState<PdfAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get("/api/v1/analyses?per_page=100");
      const pdfs = (data.items as PdfAnalysis[]).filter(
        (a) => a.detected_type === "pdf"
      );
      setDocs(pdfs);
    } catch {
      setError("Não foi possível carregar os documentos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return docs;
    const q = search.toLowerCase();
    return docs.filter(
      (d) =>
        d.original_filename.toLowerCase().includes(q) ||
        (d.indicators?.title ?? "").toLowerCase().includes(q) ||
        (d.indicators?.author ?? "").toLowerCase().includes(q)
    );
  }, [docs, search]);

  const completed = docs.filter((d) => d.status === "completed");
  const totalPages = completed.reduce((s, d) => s + (d.indicators?.pages ?? d.total_rows ?? 0), 0);
  const totalWords = completed.reduce((s, d) => s + (d.indicators?.word_count ?? 0), 0);

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">

        {/* Page header */}
        <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
          <div>
            <Link href="/" className="text-sm text-blue-300/60 hover:text-blue-300 transition-colors">
              ← Início
            </Link>
            <h1 className="text-2xl font-bold text-white mt-3">Documentos PDF</h1>
            <p className="text-blue-200/50 text-sm mt-1">
              PDFs enviados para análise e geração de relatório executivo.
            </p>
          </div>
          <div className="flex items-center gap-2 mt-6">
            <button
              onClick={load}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-blue-200/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/12 rounded-lg transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Atualizar
            </button>
            <Link
              href="/upload"
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#003A70] hover:bg-[#0057A8] rounded-lg transition-colors"
            >
              <FileText className="w-3.5 h-3.5" /> Enviar PDF
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-blue-200/50">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Carregando documentos...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-red-400">
            <AlertCircle className="w-8 h-8" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        ) : docs.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
            <EmptyState
              icon={FileScan}
              title="Nenhum documento PDF encontrado"
              description="Envie um PDF para extrair seu conteúdo e gerar um relatório executivo."
            />
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard icon={FileScan}   label="Documentos"   value={completed.length} />
              <StatCard icon={BookOpen}   label="Total de páginas" value={totalPages.toLocaleString("pt-BR")} />
              <StatCard icon={Type}       label="Total de palavras" value={totalWords.toLocaleString("pt-BR")} />
              <StatCard
                icon={BarChart2}
                label="Com relatório"
                value={completed.length}
                sub="disponível para download"
              />
            </div>

            {/* Search */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                <input
                  type="text"
                  placeholder="Buscar por nome, título ou autor..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-sm text-blue-200/80 placeholder:text-blue-200/30 focus:outline-none focus:border-blue-400/50"
                />
              </div>
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="flex items-center gap-1 px-2.5 py-2 text-xs text-blue-200/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors"
                >
                  <X className="w-3 h-3" /> Limpar
                </button>
              )}
              <span className="text-xs text-blue-200/30 ml-auto">
                {filtered.length} de {docs.length} documento{docs.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Cards grid */}
            {filtered.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-xl py-14 flex flex-col items-center gap-2 text-blue-200/40">
                <FileScan className="w-8 h-8" />
                <p className="text-sm">Nenhum documento corresponde à busca.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map((doc) => {
                  const ind = doc.indicators;
                  const pages     = ind?.pages     ?? doc.total_rows ?? 0;
                  const words     = ind?.word_count ?? 0;
                  const title     = ind?.title;
                  const author    = ind?.author;
                  const done      = doc.status === "completed";

                  return (
                    <div
                      key={doc.id}
                      className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-amber-400/30 transition-colors flex flex-col gap-4"
                    >
                      {/* File name + status */}
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-amber-400/10 border border-amber-400/20 shrink-0">
                          <FileText className="w-5 h-5 text-amber-300" />
                        </div>
                        <div className="min-w-0">
                          <p
                            className="text-sm font-semibold text-white truncate"
                            title={doc.original_filename}
                          >
                            {doc.original_filename}
                          </p>
                          {title && (
                            <p className="text-xs text-blue-200/50 mt-0.5 truncate" title={title}>
                              {title}
                            </p>
                          )}
                          {author && (
                            <p className="text-xs text-blue-200/35 mt-0.5 truncate">{author}</p>
                          )}
                        </div>
                      </div>

                      {/* Metadata chips */}
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-white/8 border border-white/10 text-blue-200/60">
                          <BookOpen className="w-3 h-3" /> {pages} página{pages !== 1 ? "s" : ""}
                        </span>
                        {words > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-white/8 border border-white/10 text-blue-200/60">
                            <Type className="w-3 h-3" /> {words.toLocaleString("pt-BR")} palavras
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-white/8 border border-white/10 text-blue-200/60">
                          {formatDate(doc.created_at)}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-wrap mt-auto pt-2 border-t border-white/8">
                        <Link
                          href={`/analises/${doc.id}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-300 border border-blue-400/25 bg-blue-400/8 rounded-lg hover:bg-blue-400/15 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" /> Ver análise
                        </Link>
                        {done && (
                          <Link
                            href={`/relatorios?analysis_id=${doc.id}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-300 border border-amber-400/25 bg-amber-400/8 rounded-lg hover:bg-amber-400/15 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" /> Ver relatório
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
      <AppFooter />
    </div>
  );
}
