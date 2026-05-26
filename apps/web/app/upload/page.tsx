"use client";

import AppHeader from "@/components/layout/AppHeader";
import AppFooter from "@/components/layout/AppFooter";
import UploadDropzone from "@/components/upload/UploadDropzone";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { AlertCircle } from "lucide-react";

export default function UploadPage() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setError(null);

    try {
      const analysis = await api.upload("/api/v1/upload-and-analyze", selectedFile);
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
          <h1 className="text-2xl font-bold text-white mt-3 mb-1">Importar planilha</h1>
          <p className="text-blue-200/50 text-sm">
            Selecione um arquivo CSV ou Excel para iniciar a análise automática.
          </p>
        </div>

        <UploadDropzone onFileSelect={handleFileSelect} loading={loading} />

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
              Iniciar análise
            </button>
          </div>
        )}
      </main>
      <AppFooter />
    </div>
  );
}
