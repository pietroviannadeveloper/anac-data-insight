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

export default function UploadPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("spreadsheet");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleModeChange = (m: Mode) => {
    setMode(m);
    setSelectedFile(null);
    setError(null);
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setError(null);

    try {
      const endpoint = mode === "pdf" ? "/api/v1/upload-pdf" : "/api/v1/upload-and-analyze";
      const analysis = await api.upload(endpoint, selectedFile);
      router.push(`/analises/${analysis.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao enviar arquivo.";
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

        {selectedFile && !loading && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSubmit}
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
