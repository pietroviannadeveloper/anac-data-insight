"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, CheckCircle, AlertCircle, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

type Mode = "spreadsheet" | "pdf";

const MAX_SIZE_MB = 50;

const MODE = {
  spreadsheet: {
    accept:  ".csv,.xlsx,.xls",
    types:   [".csv", ".xlsx", ".xls"],
    mime:    ["text/csv",
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              "application/vnd.ms-excel"],
    label:   "Arraste sua planilha aqui",
    hint:    "CSV, XLSX, XLS — até 50 MB",
    endpoint: "/api/v1/upload-and-analyze",
  },
  pdf: {
    accept:  ".pdf",
    types:   [".pdf"],
    mime:    ["application/pdf"],
    label:   "Arraste seu PDF aqui",
    hint:    "PDF — até 50 MB",
    endpoint: "/api/v1/upload-pdf",
  },
} as const;

export default function QuickUploadSection() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("spreadsheet");
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const cfg = MODE[mode];

  const validate = (f: File): string | null => {
    const ext = "." + f.name.split(".").pop()?.toLowerCase();
    if (!cfg.types.includes(ext as never) && !cfg.mime.includes(f.type as never))
      return `Formato inválido. Use ${cfg.hint.split("—")[0].trim()}.`;
    if (f.size > MAX_SIZE_MB * 1024 * 1024)
      return `Arquivo muito grande. Limite: ${MAX_SIZE_MB} MB.`;
    return null;
  };

  const handleFile = (f: File) => {
    const err = validate(f);
    if (err) { setError(err); setFile(null); }
    else { setError(null); setFile(f); }
  };

  const switchMode = (m: Mode) => {
    setMode(m); setFile(null); setError(null);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDragging(false);
    if (loading) return;
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };
  const onDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); if (!loading) setDragging(true); };
  const onDragLeave = () => setDragging(false);
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) handleFile(f);
  };

  const handleAnalyze = async () => {
    if (!file || loading) return;
    setLoading(true);
    setError(null);
    try {
      const analysis = await api.upload(cfg.endpoint, file);
      router.push(`/analises/${analysis.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao enviar arquivo.");
      setLoading(false);
    }
  };

  return (
    <section className="bg-[#001428] border-b border-white/5">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold text-blue-300/60 uppercase tracking-wider mb-2">
            Início rápido
          </p>
          <h2 className="text-2xl font-bold text-white">Importe um arquivo para análise</h2>
          <p className="text-blue-200/40 text-sm mt-2">
            Planilha de ciclos, Excel genérico ou documento PDF
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex justify-center mb-6">
          <div className="flex gap-2 p-1 bg-white/5 border border-white/10 rounded-xl">
            <button
              onClick={() => switchMode("spreadsheet")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all",
                mode === "spreadsheet"
                  ? "bg-white text-[#003A70] shadow-sm"
                  : "text-blue-200/60 hover:text-blue-200"
              )}
            >
              <FileSpreadsheet className="w-4 h-4" /> Enviar planilha
            </button>
            <button
              onClick={() => switchMode("pdf")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all",
                mode === "pdf"
                  ? "bg-white text-[#003A70] shadow-sm"
                  : "text-blue-200/60 hover:text-blue-200"
              )}
            >
              <FileText className="w-4 h-4" /> Enviar PDF
            </button>
          </div>
        </div>

        {/* Dropzone */}
        <div
          key={mode}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => !loading && inputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 backdrop-blur-sm",
            loading && "cursor-not-allowed opacity-70",
            dragging  ? "border-blue-400 bg-blue-500/15" : "",
            file && !loading ? "border-emerald-400 bg-emerald-500/10" : "",
            error     ? "border-red-400 bg-red-500/10" : "",
            !dragging && !file && !error ? "border-white/20 bg-white/5 hover:border-blue-400/60 hover:bg-white/8" : "",
          )}
        >
          <input
            key={mode}
            ref={inputRef}
            type="file"
            accept={cfg.accept}
            className="hidden"
            onChange={onChange}
            disabled={loading}
          />

          {loading ? (
            <>
              <Loader2 className="w-10 h-10 text-blue-300 animate-spin mb-3" />
              <p className="font-semibold text-blue-200">Processando arquivo...</p>
              <p className="text-sm text-blue-200/50 mt-1">Aguarde enquanto analisamos os dados</p>
            </>
          ) : file ? (
            <>
              <CheckCircle className="w-10 h-10 text-emerald-400 mb-3" />
              <p className="font-semibold text-emerald-300">{file.name}</p>
              <p className="text-sm text-emerald-400/70 mt-1">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
              <button
                onClick={(e) => { e.stopPropagation(); handleAnalyze(); }}
                className="mt-4 px-5 py-2 bg-white text-[#003A70] hover:bg-blue-50 font-semibold text-sm rounded-lg transition-colors shadow-lg shadow-black/20"
              >
                {mode === "pdf" ? "Analisar PDF" : "Iniciar análise"}
              </button>
            </>
          ) : error ? (
            <>
              <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
              <p className="font-semibold text-red-300">{error}</p>
              <p className="text-sm text-red-400/70 mt-1">Clique para tentar novamente</p>
            </>
          ) : (
            <>
              {mode === "pdf"
                ? <FileText className={cn("w-12 h-12 mb-4 transition-colors", dragging ? "text-blue-300" : "text-white/30")} />
                : <UploadCloud className={cn("w-12 h-12 mb-4 transition-colors", dragging ? "text-blue-300" : "text-white/30")} />
              }
              <p className="font-semibold text-white/80 text-base">{cfg.label}</p>
              <p className="text-sm text-white/40 mt-1">ou clique para selecionar</p>
              <p className="text-xs text-white/25 mt-3">{cfg.hint}</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
