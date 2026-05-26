"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { UploadCloud, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_SIZE_MB = 50;
const ALLOWED_TYPES = [".csv", ".xlsx", ".xls"];
const ALLOWED_MIME = [
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

export default function QuickUploadSection() {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = (f: File): string | null => {
    const ext = "." + f.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_TYPES.includes(ext) && !ALLOWED_MIME.includes(f.type)) {
      return "Formato inválido. Use CSV, XLSX ou XLS.";
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      return `Arquivo muito grande. Limite: ${MAX_SIZE_MB} MB.`;
    }
    return null;
  };

  const handleFile = (f: File) => {
    const err = validate(f);
    if (err) {
      setError(err);
      setFile(null);
    } else {
      setError(null);
      setFile(f);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
  };

  const onDragLeave = () => setDragging(false);

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  return (
    <section className="bg-[#001428] border-b border-white/5">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold text-blue-300/60 uppercase tracking-wider mb-2">
            Início rápido
          </p>
          <h2 className="text-2xl font-bold text-white">Importe sua planilha agora</h2>
        </div>

        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 backdrop-blur-sm",
            dragging
              ? "border-blue-400 bg-blue-500/15"
              : file
              ? "border-emerald-400 bg-emerald-500/10"
              : error
              ? "border-red-400 bg-red-500/10"
              : "border-white/20 bg-white/5 hover:border-blue-400/60 hover:bg-white/8"
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={onChange}
          />

          {file ? (
            <>
              <CheckCircle className="w-10 h-10 text-emerald-400 mb-3" />
              <p className="font-semibold text-emerald-300">{file.name}</p>
              <p className="text-sm text-emerald-400/70 mt-1">
                {(file.size / 1024 / 1024).toFixed(2)} MB — pronto para análise
              </p>
            </>
          ) : error ? (
            <>
              <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
              <p className="font-semibold text-red-300">{error}</p>
              <p className="text-sm text-red-400/70 mt-1">Clique para tentar novamente</p>
            </>
          ) : (
            <>
              <UploadCloud
                className={cn(
                  "w-12 h-12 mb-4 transition-colors",
                  dragging ? "text-blue-300" : "text-white/30"
                )}
              />
              <p className="font-semibold text-white/80 text-base">
                Arraste um arquivo CSV ou XLSX aqui
              </p>
              <p className="text-sm text-white/40 mt-1">ou clique para selecionar</p>
              <p className="text-xs text-white/25 mt-3">Tamanho máximo: {MAX_SIZE_MB} MB</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
