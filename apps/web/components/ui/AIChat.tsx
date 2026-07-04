"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, X, Send, Loader2, Bot, User, Sparkles, ChevronDown, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  text: string;
}

interface AIChatProps {
  pageType: "ptamensal" | "pta_historico";
  contextData: Record<string, unknown> | null;
  suggestedQuestions?: string[];
}

const DEFAULT_SUGGESTIONS: Record<string, string[]> = {
  ptamensal: [
    "Qual a taxa de execução atual e como está o cronograma?",
    "Quais gerências têm mais atividades sem agendamento?",
    "Quantas atividades estão sem GIASO ou sem PCDP?",
    "Como está o andamento em relação ao mês vigente?",
    "Quais são os principais riscos identificados?",
  ],
  pta_historico: [
    "Qual foi o melhor ano em taxa de execução?",
    "Como evoluiu o total de atividades ao longo dos anos?",
    "Qual tipo de ciclo tem maior taxa de realização histórica?",
    "Quais tendências você observa nos dados históricos?",
    "Como o desempenho de 2024 se compara aos anos anteriores?",
  ],
};

function AIChatInner({ pageType, contextData, suggestedQuestions }: AIChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const suggestions = suggestedQuestions ?? DEFAULT_SUGGESTIONS[pageType] ?? [];

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 120);
      if (messages.length === 0) setShowSuggestions(true);
    }
  }, [open, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = useCallback(async (question: string) => {
    if (!question.trim() || loading) return;
    setShowSuggestions(false);
    setMessages((prev) => [...prev, { role: "user", text: question.trim() }]);
    setInput("");
    setLoading(true);
    try {
      const res = await api.post("/api/v1/chat/page", {
        question: question.trim(),
        page_type: pageType,
        context: contextData ?? {},
      });
      setMessages((prev) => [...prev, { role: "assistant", text: res.answer }]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao consultar a IA.";
      setMessages((prev) => [...prev, { role: "assistant", text: `⚠️ ${msg}` }]);
    } finally {
      setLoading(false);
    }
  }, [loading, pageType, contextData]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  const handleReset = () => {
    setMessages([]);
    setShowSuggestions(true);
    setInput("");
  };

  const pageLabel = pageType === "ptamensal" ? "PTA Mensal 2026" : "Histórico PTA";

  return (
    <>
      {/* ── Floating trigger button ────────────────────────────────── */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Fechar assistente" : "Abrir assistente de IA"}
        style={{ position: "fixed", bottom: "1.5rem", right: "1.5rem", zIndex: 9999 }}
        className={`
          w-14 h-14 rounded-2xl shadow-xl
          flex items-center justify-center gap-2
          border transition-all duration-200
          ${open
            ? "bg-[#001E3C] border-blue-400/30 text-blue-300 hover:border-blue-400/50"
            : "bg-[#003A70] border-blue-500/40 text-white hover:bg-[#004a8f] hover:border-blue-400/60"
          }
        `}
      >
        {open
          ? <X className="w-5 h-5" />
          : <>
              <MessageCircle className="w-5 h-5" />
              <span className="text-xs font-semibold pr-1 hidden sm:block">IA</span>
            </>
        }
      </button>

      {/* ── Chat panel ────────────────────────────────────────────── */}
      {open && (
        <div
          style={{ position: "fixed", bottom: "5.5rem", right: "1.5rem", zIndex: 9998 }}
          className="
            w-[480px] max-h-[680px] flex flex-col
            rounded-2xl overflow-hidden
            bg-[#001E3C] border border-blue-900/60
            shadow-[0_8px_40px_rgba(0,0,0,0.6)]
          "
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-blue-900/50 bg-[#003A70]/30 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-[#003A70] border border-blue-500/30 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5 text-blue-200" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-white/90 leading-tight">Assistente ANAC</p>
              <p className="text-xs text-blue-300/50">{pageLabel}</p>
            </div>
            {messages.length > 0 && (
              <button
                onClick={handleReset}
                title="Nova conversa"
                className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
            {/* Welcome */}
            {messages.length === 0 && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#003A70] border border-blue-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-blue-200" />
                </div>
                <div className="bg-[#003A70]/20 border border-blue-900/40 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-white/60 max-w-[88%] leading-relaxed">
                  Olá! Analiso os dados desta página em tempo real. Escolha uma sugestão ou faça sua própria pergunta.
                  {!contextData && (
                    <span className="block mt-2 text-orange-400/60 text-xs">
                      ⚠ Aguardando dados da página...
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* History */}
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                <div className={`
                  w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5
                  ${msg.role === "user"
                    ? "bg-blue-600/30 border border-blue-400/25"
                    : "bg-[#003A70] border border-blue-500/30"
                  }
                `}>
                  {msg.role === "user"
                    ? <User className="w-4 h-4 text-blue-300" />
                    : <Bot className="w-4 h-4 text-blue-200" />
                  }
                </div>
                <div className={`
                  rounded-2xl px-4 py-3 text-sm max-w-[88%] whitespace-pre-wrap leading-relaxed
                  ${msg.role === "user"
                    ? "rounded-tr-sm bg-[#003A70]/40 border border-blue-500/20 text-blue-100"
                    : "rounded-tl-sm bg-[#003A70]/20 border border-blue-900/40 text-white/75"
                  }
                `}>
                  {msg.text}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#003A70] border border-blue-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-blue-200" />
                </div>
                <div className="bg-[#003A70]/20 border border-blue-900/40 rounded-2xl rounded-tl-sm px-3 py-2.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="px-4 pt-3 pb-2 border-t border-blue-900/40 shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5 text-xs text-blue-300/50 font-medium uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" /> Sugestões
                </span>
                <button
                  onClick={() => setShowSuggestions(false)}
                  className="text-white/20 hover:text-white/50 transition-colors"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pb-1">
                {suggestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(q)}
                    disabled={loading}
                    className="
                      text-left text-xs px-3 py-2 rounded-lg
                      bg-[#003A70]/15 hover:bg-[#003A70]/40
                      border border-blue-900/30 hover:border-blue-500/30
                      text-white/45 hover:text-blue-200
                      transition-all disabled:opacity-30 disabled:cursor-not-allowed
                    "
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="px-4 py-3 border-t border-blue-900/40 shrink-0 bg-[#001530]">
            <div className="flex gap-2.5 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Faça sua pergunta… (Enter envia, Shift+Enter nova linha)"
                rows={2}
                disabled={loading}
                style={{
                  minHeight: "52px",
                  maxHeight: "120px",
                  colorScheme: "dark",
                  backgroundColor: "#0a1929",
                  color: "rgba(255,255,255,0.85)",
                  fontSize: "13px",
                }}
                className="
                  flex-1 resize-none rounded-xl px-4 py-2.5
                  border border-blue-900/50 focus:border-blue-500/50
                  placeholder:text-white/20
                  focus:outline-none focus:ring-1 focus:ring-blue-500/30
                  overflow-y-auto leading-relaxed
                  disabled:opacity-50
                "
              />
              <button
                onClick={() => handleSend(input)}
                disabled={loading || !input.trim()}
                aria-label="Enviar"
                className="
                  w-10 h-10 shrink-0 mb-0.5
                  flex items-center justify-center rounded-xl
                  bg-[#003A70] hover:bg-[#004a8f]
                  border border-blue-500/30 hover:border-blue-400/50
                  text-blue-200 transition-colors
                  disabled:opacity-30 disabled:cursor-not-allowed
                "
              >
                {loading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Send className="w-4 h-4" />
                }
              </button>
            </div>
            {!showSuggestions && (
              <button
                onClick={() => setShowSuggestions(true)}
                className="mt-2 text-xs text-blue-400/30 hover:text-blue-300/60 transition-colors flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" /> Ver sugestões
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// Portal wrapper — renders outside any transformed parent, guaranteeing fixed positioning
export function AIChat(props: AIChatProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(<AIChatInner {...props} />, document.body);
}
