"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Plane, X, Send, Loader2, User, Sparkles, ChevronDown, RefreshCw, Copy, Check } from "lucide-react";
import { api } from "@/lib/api";

const BTN_SIZE = 56;
const PANEL_W = 480;
const PANEL_H = 680;
const MARGIN = 24;
const POS_STORAGE_KEY = "anac_ai_chat_pos";

interface Point {
  x: number;
  y: number;
}

function clampPos(p: Point): Point {
  const maxX = Math.max(0, window.innerWidth - BTN_SIZE);
  const maxY = Math.max(0, window.innerHeight - BTN_SIZE);
  return {
    x: Math.min(Math.max(p.x, 0), maxX),
    y: Math.min(Math.max(p.y, 0), maxY),
  };
}

function defaultPos(): Point {
  try {
    const saved = localStorage.getItem(POS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
        return clampPos(parsed);
      }
    }
  } catch {}
  return clampPos({ x: window.innerWidth - BTN_SIZE - MARGIN, y: window.innerHeight - BTN_SIZE - MARGIN });
}

interface Message {
  role: "user" | "assistant";
  text: string;
}

interface AIChatProps {
  pageType: "ptamensal" | "pta_historico" | "geral";
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
  geral: [
    "Como está a execução geral das atividades?",
    "Quais empresas concentram mais pendências?",
    "Quais gerências têm mais atividades?",
    "O que posso fazer nesta plataforma?",
  ],
};

/** Renderiza texto em [nós React] com **negrito**, `código` e links internos. */
function renderInline(text: string): React.ReactNode[] {
  const regex = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\)|`[^`]+`)/g;
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      nodes.push(<strong key={k++} className="text-white font-semibold">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("`")) {
      nodes.push(<code key={k++} className="bg-white/10 px-1 py-0.5 rounded text-[12px]">{tok.slice(1, -1)}</code>);
    } else {
      const label = tok.slice(1, tok.indexOf("]"));
      const href = tok.slice(tok.indexOf("](") + 2, -1);
      nodes.push(
        href.startsWith("/") ? (
          <a key={k++} href={href} className="text-blue-300 underline underline-offset-2 hover:text-blue-200 transition-colors">
            {label}
          </a>
        ) : (
          <span key={k++}>{label}</span>
        )
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Markdown leve para respostas da IA: parágrafos, listas, títulos e inline. */
function MarkdownLite({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  let key = 0;

  const flushList = () => {
    if (list.length === 0) return;
    blocks.push(
      <ul key={key++} className="list-disc pl-4 space-y-1">
        {list.map((item, i) => <li key={i}>{renderInline(item)}</li>)}
      </ul>
    );
    list = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const listMatch = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)/);
    if (listMatch) {
      list.push(listMatch[1]);
      continue;
    }
    flushList();
    if (!line.trim()) continue;
    const heading = line.match(/^#{1,4}\s+(.*)/);
    if (heading) {
      blocks.push(<p key={key++} className="font-semibold text-white/90">{renderInline(heading[1])}</p>);
    } else {
      blocks.push(<p key={key++}>{renderInline(line)}</p>);
    }
  }
  flushList();
  return <div className="space-y-2">{blocks}</div>;
}

/** Botão de copiar resposta com feedback visual. */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }).catch(() => {});
      }}
      aria-label="Copiar resposta"
      className="mt-1 p-1 rounded text-white/20 hover:text-white/60 transition-colors"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

const HISTORY_STORAGE_PREFIX = "anac_ai_chat_history_";

function loadHistory(pageType: string): Message[] {
  try {
    const raw = sessionStorage.getItem(HISTORY_STORAGE_PREFIX + pageType);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.slice(-40);
    }
  } catch {}
  return [];
}

function AIChatInner({ pageType, contextData, suggestedQuestions }: AIChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => loadHistory(pageType));

  // Persiste a conversa na sessão — sobrevive à navegação entre páginas
  useEffect(() => {
    try {
      sessionStorage.setItem(HISTORY_STORAGE_PREFIX + pageType, JSON.stringify(messages.slice(-40)));
    } catch {}
  }, [messages, pageType]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [pos, setPos] = useState<Point>(() => defaultPos());

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

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

  // Keep the floating bubble inside the viewport when the window is resized
  useEffect(() => {
    const onResize = () => setPos((p) => clampPos(p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    draggingRef.current = true;
    movedRef.current = false;
    dragStartRef.current = { x: e.clientX, y: e.clientY, posX: pos.x, posY: pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [pos]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) movedRef.current = true;
    if (movedRef.current) {
      setPos(clampPos({ x: dragStartRef.current.posX + dx, y: dragStartRef.current.posY + dy }));
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (movedRef.current) {
      setPos((p) => {
        try { localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(p)); } catch {}
        return p;
      });
    }
  }, []);

  const handleTriggerClick = useCallback(() => {
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    setOpen((o) => !o);
  }, []);

  // Position the chat panel near the bubble, flipping to stay on screen
  const panelStyle = useCallback((): React.CSSProperties => {
    const w = Math.min(PANEL_W, window.innerWidth - 16);
    const h = Math.min(PANEL_H, window.innerHeight - 16);

    let left = pos.x + BTN_SIZE - w;
    if (left < 8) left = pos.x;
    left = Math.min(Math.max(left, 8), window.innerWidth - w - 8);

    let top = pos.y - h - 12;
    if (top < 8) top = pos.y + BTN_SIZE + 12;
    top = Math.min(Math.max(top, 8), window.innerHeight - h - 8);

    return { left, top, width: w, maxHeight: h };
  }, [pos]);

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
        history: messages.slice(-8).map((m) => ({ role: m.role, text: m.text })),
      });
      setMessages((prev) => [...prev, { role: "assistant", text: res.answer }]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao consultar a IA.";
      setMessages((prev) => [...prev, { role: "assistant", text: `⚠️ ${msg}` }]);
    } finally {
      setLoading(false);
    }
  }, [loading, pageType, contextData, messages]);

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
    try { sessionStorage.removeItem(HISTORY_STORAGE_PREFIX + pageType); } catch {}
  };

  const pageLabel = pageType === "ptamensal" ? "PTA Mensal 2026" : pageType === "pta_historico" ? "Histórico PTA" : "Dados de toda a plataforma";

  return (
    <>
      {/* ── Floating trigger button (avião arrastável) ───────────────── */}
      <button
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleTriggerClick}
        aria-label={open ? "Fechar assistente" : "Abrir assistente de IA"}
        style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 9999, touchAction: "none" }}
        className={`
          relative w-14 h-14 rounded-full shadow-xl
          flex items-center justify-center
          border-2 cursor-grab active:cursor-grabbing
          transition-colors duration-200
          ${open
            ? "bg-[#001E3C] border-blue-400/40 text-blue-300"
            : `bg-gradient-to-br from-sky-400 via-blue-500 to-anac-blue border-white/40 text-white
               hover:from-sky-300 hover:via-blue-400 hover:to-anac-blue-light
               ${!draggingRef.current ? "animate-plane-float" : ""}`
          }
        `}
      >
        {open
          ? <X className="w-6 h-6" />
          : <Plane className="w-7 h-7 -rotate-45 drop-shadow" />
        }
        {!open && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-[#00112b] animate-pulse" />
        )}
      </button>

      {/* ── Chat panel ────────────────────────────────────────────── */}
      {open && (
        <div
          style={{ position: "fixed", zIndex: 9998, ...panelStyle() }}
          className="
            flex flex-col
            rounded-2xl overflow-hidden
            bg-[#001E3C] border border-blue-900/60
            shadow-[0_8px_40px_rgba(0,0,0,0.6)]
            animate-plane-pop-in
          "
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-blue-900/50 bg-[#003A70]/30 shrink-0">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-400 via-blue-500 to-anac-blue border border-white/20 flex items-center justify-center shrink-0">
              <Plane className="w-4 h-4 text-white -rotate-45" />
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
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sky-400 via-blue-500 to-anac-blue border border-white/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Plane className="w-3.5 h-3.5 text-white -rotate-45" />
                </div>
                <div className="bg-[#003A70]/20 border border-blue-900/40 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-white/60 max-w-[88%] leading-relaxed">
                  Olá! Analiso os dados desta página em tempo real. Escolha uma sugestão ou faça sua própria pergunta.
                  {!contextData && pageType !== "geral" && (
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
                  w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5
                  ${msg.role === "user"
                    ? "bg-blue-600/30 border border-blue-400/25"
                    : "bg-gradient-to-br from-sky-400 via-blue-500 to-anac-blue border border-white/20"
                  }
                `}>
                  {msg.role === "user"
                    ? <User className="w-4 h-4 text-blue-300" />
                    : <Plane className="w-3.5 h-3.5 text-white -rotate-45" />
                  }
                </div>
                <div className="max-w-[88%] min-w-0">
                  <div className={`
                    rounded-2xl px-4 py-3 text-sm leading-relaxed
                    ${msg.role === "user"
                      ? "rounded-tr-sm bg-[#003A70]/40 border border-blue-500/20 text-blue-100 whitespace-pre-wrap"
                      : "rounded-tl-sm bg-[#003A70]/20 border border-blue-900/40 text-white/75"
                    }
                  `}>
                    {msg.role === "assistant" ? <MarkdownLite text={msg.text} /> : msg.text}
                  </div>
                  {msg.role === "assistant" && !msg.text.startsWith("⚠️") && <CopyButton text={msg.text} />}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sky-400 via-blue-500 to-anac-blue border border-white/20 flex items-center justify-center shrink-0 mt-0.5 animate-plane-float">
                  <Plane className="w-3.5 h-3.5 text-white -rotate-45" />
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
