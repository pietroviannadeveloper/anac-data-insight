"use client";

import AppHeader from "@/components/layout/AppHeader";
import AppFooter from "@/components/layout/AppFooter";
import UploadDropzone from "@/components/upload/UploadDropzone";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { AlertCircle, FileSpreadsheet, FileText } from "lucide-react";

type Mode = "spreadsheet" | "pdf";

interface QualityIssue {
  code: string;
  message: string;
  affected_rows?: number;
}

interface QualityReport {
  score: number;
  errors: QualityIssue[];
  warnings: QualityIssue[];
  suggestions: string[];
  total_rows: number;
}

export default function UploadPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("spreadsheet");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qualityReport, setQualityReport] = useState<QualityReport | null>(null);

  const handleModeChange = (m: Mode) => {
    setMode(m);
    setSelectedFile(null);
    setError(null);
    setQualityReport(null);
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setError(null);
    setQualityReport(null);
  };

  const handleSubmit = async (force = false) => {
    if (!selectedFile) return;
    setLoading(true);
    setError(null);
    setQualityReport(null);

    try {
      const endpoint = mode === "pdf" ? "/api/v1/upload-pdf" : "/api/v1/upload-and-analyze";
      const path = force ? `${endpoint}?force=true` : endpoint;
      const analysis = await api.upload(path, selectedFile);
      router.push(`/analises/${analysis.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao enviar arquivo.";
      try {
        const parsed = JSON.parse(message);
        if (parsed && parsed.quality_report) {
          setQualityReport(parsed.quality_report);
          setLoading(false);
          return;
        }
      } catch {}
      setError(message);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-12">
        <div className="mb-8">
          <Link href="/" className="text-sm text-blue-300/60 hover:text-blue-300 transition-colors">
            ← Início
          </Link>
          <h1 className="text-2xl font-bold text-white mt-3 mb-1">Importar arquivo</h1>
          <p className="text-blue-200/50 text-sm">
            Envie uma planilha ou um PDF para iniciar a análise automática.
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-6 p-1 bg-white/5 border border-white/10 rounded-xl w-fit">
          <button
            onClick={() => handleModeChange("spreadsheet")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              mode === "spreadsheet"
                ? "bg-white text-[#003A70] shadow-sm"
                : "text-blue-200/60 hover:text-blue-200"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Enviar planilha
          </button>
          <button
            onClick={() => handleModeChange("pdf")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              mode === "pdf"
                ? "bg-white text-[#003A70] shadow-sm"
                : "text-blue-200/60 hover:text-blue-200"
            }`}
          >
            <FileText className="w-4 h-4" />
            Enviar PDF
          </button>
        </div>

        {/* Description */}
        <p className="text-xs text-blue-200/40 mb-4">
          {mode === "spreadsheet"
            ? "Planilhas de ciclos (Base, Desempenho, Não Programadas) recebem análise completa com indicadores. Planilhas genéricas recebem perfil de colunas e estatísticas."
            : "O sistema extrai o texto do PDF, exibe um resumo e permite gerar análise com IA."}
        </p>

        <UploadDropzone
          key={mode}
          mode={mode}
          onFileSelect={handleFileSelect}
          loading={loading}
        />

        {error && (
          <div className="mt-4 flex items-start gap-2 text-sm text-red-300 bg-red-500/10 border border-red-400/25 rounded-lg px-4 py-3">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {qualityReport && (
          <div className="mt-4 bg-red-500/10 border border-red-400/25 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-red-300">Qualidade dos dados insuficiente</h2>
              <span className="text-xs text-red-200/60">Score: {qualityReport.score}/100</span>
            </div>
            <ul className="space-y-1.5">
              {qualityReport.errors.map((e, i) => (
                <li key={i} className="text-xs text-red-200/80 flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>{e.message}</span>
                </li>
              ))}
              {qualityReport.warnings.map((w, i) => (
                <li key={`w-${i}`} className="text-xs text-yellow-200/70 flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>{w.message}</span>
                </li>
              ))}
            </ul>
            {qualityReport.suggestions.length > 0 && (
              <p className="text-xs text-blue-200/50 italic">{qualityReport.suggestions.join(" ")}</p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setQualityReport(null)}
                className="px-4 py-2 text-sm font-medium text-blue-200/70 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleSubmit(true)}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600/80 hover:bg-red-600 rounded-lg transition-colors"
              >
                Prosseguir mesmo assim
              </button>
            </div>
          </div>
        )}

        {selectedFile && !loading && !qualityReport && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={() => handleSubmit(false)}
              className="px-6 py-2.5 bg-white text-[#003A70] hover:bg-blue-50 font-semibold text-sm rounded-lg transition-colors shadow-lg shadow-black/20"
            >
              {mode === "pdf" ? "Analisar PDF" : "Iniciar análise"}
            </button>
          </div>
        )}
      </main>
      <AppFooter />
    </div>
  );
}
