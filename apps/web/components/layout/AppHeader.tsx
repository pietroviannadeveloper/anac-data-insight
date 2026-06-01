"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, X, LogOut, ShieldCheck, Search, FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/upload", label: "Upload" },
  { href: "/analises", label: "Análises" },
  { href: "/ciclos", label: "Ciclos" },
  { href: "/documentos", label: "Documentos PDF" },
  { href: "/relatorios", label: "Relatórios" },
  { href: "/chat", label: "Chat IA" },
];

interface SearchResult {
  id: string;
  original_filename: string;
  detected_type: string;
  status: string;
  description?: string;
  tags?: string[];
  created_by?: string;
}

function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.get(`/api/v1/search?q=${encodeURIComponent(q)}`);
        setResults(data.analyses ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  useEffect(() => { search(query); }, [query, search]);

  const go = (id: string) => {
    router.push(`/analises/${id}`);
    setOpen(false);
    setQuery("");
    setResults([]);
  };

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="flex items-center gap-2 px-3 py-1.5 text-xs text-blue-200/60 bg-white/10 border border-white/20 rounded-lg hover:bg-white/15 transition-colors"
      >
        <Search className="w-3.5 h-3.5" />
        <span>Buscar</span>
        <kbd className="ml-1 text-[10px] text-blue-200/40 bg-white/10 px-1.5 py-0.5 rounded">⌘K</kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 px-4" onClick={() => setOpen(false)}>
      <div className="bg-[#0d1f3c] border border-white/20 rounded-2xl w-full max-w-xl shadow-2xl shadow-black/50 overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          {loading ? <Loader2 className="w-4 h-4 text-blue-300 animate-spin shrink-0" /> : <Search className="w-4 h-4 text-blue-300/60 shrink-0" />}
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar análises, arquivos, descrições..."
            className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
            autoFocus
          />
          <button onClick={() => setOpen(false)} className="text-white/30 hover:text-white/60">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {!query.trim() ? (
            <p className="text-xs text-blue-200/30 text-center py-8">Digite para buscar análises</p>
          ) : results.length === 0 && !loading ? (
            <p className="text-xs text-blue-200/30 text-center py-8">Nenhum resultado para "{query}"</p>
          ) : (
            <ul className="py-2">
              {results.map(r => (
                <li key={r.id}>
                  <button
                    onClick={() => go(r.id)}
                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-white/8 transition-colors text-left"
                  >
                    {r.detected_type === "pdf"
                      ? <FileText className="w-4 h-4 text-amber-300/70 shrink-0 mt-0.5" />
                      : <FileSpreadsheet className="w-4 h-4 text-blue-300/70 shrink-0 mt-0.5" />
                    }
                    <div className="min-w-0">
                      <p className="text-sm text-white/90 truncate">{r.original_filename}</p>
                      {r.description && <p className="text-xs text-blue-200/50 truncate mt-0.5">{r.description}</p>}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {r.tags?.map(t => (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-400/15 text-blue-300 border border-blue-400/20">{t}</span>
                        ))}
                        {r.created_by && <span className="text-[10px] text-white/25">{r.created_by}</span>}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-4 py-2 border-t border-white/8 text-[10px] text-white/25 flex gap-4">
          <span>↵ Abrir</span><span>Esc Fechar</span>
        </div>
      </div>
    </div>
  );
}

export default function AppHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => { setIsAdmin(auth.isAdmin()); }, []);

  function handleLogout() {
    api.logout();
  }

  return (
    <header className="sticky top-0 z-50 bg-[#003A70] border-b border-[#002550] shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group shrink-0">
            <div className="w-9 h-9 bg-white rounded flex items-center justify-center flex-shrink-0 p-1">
              <Image src="/anac-logo.png" alt="ANAC" width={36} height={36} className="object-contain" />
            </div>
            <div className="hidden sm:block">
              <p className="text-white font-bold text-sm leading-tight tracking-wide">ANAC Data Insight</p>
              <p className="text-blue-200 text-xs leading-tight">Análise de Dados Operacionais</p>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}
                className="px-3 py-2 text-sm font-medium text-blue-100 rounded hover:bg-[#0057A8] hover:text-white transition-colors duration-150">
                {link.label}
              </Link>
            ))}
            {isAdmin && (
              <Link href="/admin"
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-100 rounded hover:bg-[#0057A8] hover:text-white transition-colors duration-150">
                <ShieldCheck className="w-4 h-4" /> Admin
              </Link>
            )}
          </nav>

          {/* Right actions */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <GlobalSearch />
            <button onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-100 rounded hover:bg-[#0057A8] hover:text-white transition-colors duration-150">
              <LogOut className="w-4 h-4" /> Sair
            </button>
          </div>

          {/* Mobile menu button */}
          <button className="md:hidden p-2 rounded text-blue-100 hover:bg-[#0057A8] hover:text-white transition-colors"
            onClick={() => setMobileOpen(v => !v)} aria-label="Toggle menu">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="md:hidden bg-[#002550] border-t border-[#003A70]">
          <nav className="px-4 py-2 flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}
                className="px-3 py-2 text-sm font-medium text-blue-100 rounded hover:bg-[#0057A8] hover:text-white transition-colors">
                {link.label}
              </Link>
            ))}
            {isAdmin && (
              <Link href="/admin" onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-100 rounded hover:bg-[#0057A8] hover:text-white transition-colors">
                <ShieldCheck className="w-4 h-4" /> Admin
              </Link>
            )}
            <button onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-300 rounded hover:bg-[#0057A8] hover:text-white transition-colors">
              <LogOut className="w-4 h-4" /> Sair da conta
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
