"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { UploadCloud, CheckCircle, AlertCircle, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadDropzoneProps {
  onFileSelect?: (file: File) => void;
  loading?: boolean;
  className?: string;
}

const MAX_SIZE_MB = 50;
const ALLOWED_TYPES = [".csv", ".xlsx", ".xls"];
const ALLOWED_MIME = [
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

export default function UploadDropzone({ onFileSelect, loading, className }: UploadDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = (f: File): string | null => {
    const ext = "." + f.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_TYPES.includes(ext) && !ALLOWED_MIME.includes(f.type)) {
      return "Formato não suportado. Use CSV, XLSX ou XLS.";
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      return `Arquivo excede o limite de ${MAX_SIZE_MB} MB.`;
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
      onFileSelect?.(f);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (loading) return;
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!loading) setDragging(true);
  };

  const onDragLeave = () => setDragging(false);

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const reset = () => {
    setFile(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={() => !loading && inputRef.current?.click()}
      className={cn(
        "relative border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 select-none backdrop-blur-sm",
        loading && "cursor-not-allowed opacity-70",
        dragging ? "border-blue-400 bg-blue-500/15" : "",
        file && !loading ? "border-emerald-400 bg-emerald-500/10" : "",
        error ? "border-red-400 bg-red-500/10" : "",
        !dragging && !file && !error ? "border-white/20 bg-white/5 hover:border-blue-400/60 hover:bg-white/8" : "",
        className
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={onChange}
        disabled={loading}
      />

      {loading ? (
        <>
          <Loader2 className="w-10 h-10 text-blue-300 animate-spin mb-3" />
          <p className="font-semibold text-blue-200">Processando arquivo...</p>
          <p className="text-sm text-blue-200/50 mt-1">Aguarde enquanto analisamos seus dados</p>
        </>
      ) : file ? (
        <>
          <CheckCircle className="w-10 h-10 text-emerald-400 mb-3" />
          <p className="font-semibold text-emerald-300 text-center">{file.name}</p>
          <p className="text-sm text-emerald-400/70 mt-1">
            {(file.size / 1024 / 1024).toFixed(2)} MB
          </p>
          <button
            onClick={(e) => { e.stopPropagation(); reset(); }}
            className="mt-3 flex items-center gap-1 text-xs text-blue-200/40 hover:text-blue-200/70 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Remover arquivo
          </button>
        </>
      ) : error ? (
        <>
          <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
          <p className="font-semibold text-red-300 text-center">{error}</p>
          <p className="text-sm text-red-400/60 mt-1">Clique para tentar novamente</p>
        </>
      ) : (
        <>
          <UploadCloud
            className={cn(
              "w-12 h-12 mb-4 transition-colors",
              dragging ? "text-blue-300" : "text-white/25"
            )}
          />
          <p className="font-semibold text-white/75 text-base">
            Arraste um arquivo CSV ou XLSX aqui
          </p>
          <p className="text-sm text-white/40 mt-1">ou clique para selecionar</p>
          <p className="text-xs text-white/25 mt-3">
            Formatos aceitos: CSV, XLSX, XLS — até {MAX_SIZE_MB} MB
          </p>
        </>
      )}
    </div>
  );
}
