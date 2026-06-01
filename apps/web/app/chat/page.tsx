"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/layout/AppHeader";
import AppFooter from "@/components/layout/AppFooter";
import { api } from "@/lib/api";
import {
  Bot, Send, Loader2, FileSpreadsheet, FileText, ChevronDown,
  MessageSquare, Sparkles, RotateCcw,
} from "lucide-react";

interface AnalysisOption {
  id: string;
  original_filename: string;
  detected_type: string;
  status: string;
  total_rows: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Quais empresas têm mais atividades sem GIASO?",
  "Qual a taxa de execução geral?",
  "Quantas atividades estão sem agendamento?",
  "Quais gerências têm mais pendências críticas?",
  "Mostre um resumo dos principais problemas.",
  "Quantas atividades foram realizadas?",
];

export default function ChatPage() {
  const [analyses, setAnalyses] = useState<AnalysisOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingAnalyses, setLoadingAnalyses] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get("/api/v1/analyses?per_page=100")
      .then(d => setAnalyses(d.items ?? []))
      .catch(() => {})
      .finally(() => setLoadingAnalyses(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const selected = analyses.find(a => a.id === selectedId);

  const sendMessage = async (text?: string) => {
    const question = (text ?? input).trim();
    if (!question || loading) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: question }]);
    setLoading(true);
    try {
      const res = await api.post("/api/v1/chat", {
        question,
        analysis_id: selectedId || undefined,
      });
      setMessages(prev => [...prev, { role: "assistant", content: res.answer }]);
    } catch (e: unknown) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: e instanceof Error ? e.message : "Não foi possível obter uma resposta.",
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const clearChat = () => setMessages([]);

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <Link href="/" className="text-sm text-blue-300/60 hover:text-blue-300 transition-colors">← Início</Link>
            <h1 className="text-2xl font-bold text-white mt-2 flex items-center gap-2">
              <Bot className="w-6 h-6 text-purple-300" /> Chat com os dados
            </h1>
            <p className="text-blue-200/50 text-sm mt-1">
              Faça perguntas em linguagem natural sobre qualquer análise.
            </p>
          </div>
          {messages.length > 0 && (
            <button onClick={clearChat}
              className="flex items-center gap-1.5 mt-6 px-3 py-2 text-xs text-blue-200/50 hover:text-white bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors">
              <RotateCcw className="w-3.5 h-3.5" /> Limpar
            </button>
          )}
        </div>

        {/* Analysis selector */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-blue-200/60 shrink-0">
            <Sparkles className="w-4 h-4 text-purple-300/70" />
            Contexto:
          </div>
          <div className="relative flex-1">
            {loadingAnalyses ? (
              <div className="flex items-center gap-2 text-sm text-blue-200/40">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando análises...
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedId}
                  onChange={e => { setSelectedId(e.target.value); clearChat(); }}
                  className="w-full bg-[#0d1f3c] border border-white/10 rounded-lg px-3 py-2 text-sm text-blue-100 focus:outline-none focus:border-purple-400/50 appearance-none cursor-pointer pr-8"
                >
                  <option value="">Todas as análises (visão geral)</option>
                  {analyses.filter(a => a.status === "completed").map(a => (
                    <option key={a.id} value={a.id}>
                      {a.original_filename.length > 60 ? a.original_filename.slice(0, 60) + "…" : a.original_filename}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-200/40 pointer-events-none" />
              </div>
            )}
          </div>
          {selected && (
            <div className="flex items-center gap-2 text-xs text-blue-200/40 shrink-0">
              {selected.detected_type === "pdf"
                ? <FileText className="w-3.5 h-3.5 text-amber-300/60" />
                : <FileSpreadsheet className="w-3.5 h-3.5 text-blue-300/50" />}
              {selected.total_rows.toLocaleString("pt-BR")} {selected.detected_type === "pdf" ? "páginas" : "linhas"}
              <Link href={`/analises/${selected.id}`} className="text-blue-300/50 hover:text-blue-300 transition-colors ml-1">
                Ver análise →
              </Link>
            </div>
          )}
        </div>

        {/* Chat area */}
        <div className="flex-1 bg-white/5 border border-white/10 rounded-xl flex flex-col overflow-hidden" style={{ minHeight: "52vh" }}>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 py-10">
                <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-400/20 flex items-center justify-center">
                  <MessageSquare className="w-8 h-8 text-purple-300/60" />
                </div>
                <div className="text-center">
                  <p className="text-blue-200/60 text-sm font-medium">Comece fazendo uma pergunta</p>
                  <p className="text-blue-200/30 text-xs mt-1">
                    {selectedId ? "sobre esta análise" : "sobre todas as análises disponíveis"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center max-w-lg mt-2">
                  {SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => sendMessage(s)}
                      className="text-xs px-3 py-1.5 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 text-blue-200/60 hover:text-blue-200 transition-colors text-left">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-purple-500/20 border border-purple-400/25 flex items-center justify-center mr-2 mt-0.5 shrink-0">
                      <Bot className="w-3.5 h-3.5 text-purple-300" />
                    </div>
                  )}
                  <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-blue-500/20 border border-blue-400/25 text-blue-100 rounded-br-sm"
                      : "bg-white/8 border border-white/10 text-blue-100/85 rounded-bl-sm"
                  }`}>
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>
                </div>
              ))
            )}

            {loading && (
              <div className="flex justify-start">
                <div className="w-7 h-7 rounded-full bg-purple-500/20 border border-purple-400/25 flex items-center justify-center mr-2 shrink-0">
                  <Bot className="w-3.5 h-3.5 text-purple-300" />
                </div>
                <div className="bg-white/8 border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-300/70" />
                  <span className="text-xs text-blue-200/50">Analisando dados...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-white/8 flex items-center gap-3">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={selectedId ? "Pergunte sobre esta análise..." : "Pergunte sobre todas as análises..."}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-blue-100 placeholder-white/25 focus:outline-none focus:border-purple-400/40 transition-colors"
              disabled={loading}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-purple-500/20 border border-purple-400/30 hover:bg-purple-500/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-purple-300 shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

      </main>
      <AppFooter />
    </div>
  );
}
