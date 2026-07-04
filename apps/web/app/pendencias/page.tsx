"use client";

import { useCallback, useEffect, useState } from "react";
import AppHeader from "@/components/layout/AppHeader";
import AppFooter from "@/components/layout/AppFooter";
import EmptyState from "@/components/ui/EmptyState";
import {
  ListChecks, Loader2, AlertCircle, ChevronLeft, ChevronRight,
  RefreshCw, Check, X,
} from "lucide-react";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";

interface Pendencia {
  id: string;
  severity: "baixa" | "media" | "alta" | "critica";
  status: "novo" | "em_analise" | "em_tratamento" | "resolvido" | "ignorado";
  assigned_to: string | null;
  resolution_note: string | null;
  motivo: string;
  recomendacao: string;
  origem: "ciclo" | "pta_mensal";
  origem_id: string;
  atividade: string | null;
  gerencia: string | null;
  cidade: string | null;
  mes: string | null;
  tipo_ciclo: string | null;
  created_at: string | null;
}

const ORIGEM_LABELS: Record<string, string> = { ciclo: "Ciclos", pta_mensal: "PTA Mensal" };

const SEVERITY_CONFIG: Record<string, { label: string; cls: string }> = {
  baixa:   { label: "Baixa",   cls: "text-blue-300 bg-blue-400/10 border-blue-400/20" },
  media:   { label: "Média",   cls: "text-yellow-300 bg-yellow-400/10 border-yellow-400/20" },
  alta:    { label: "Alta",    cls: "text-orange-300 bg-orange-400/10 border-orange-400/20" },
  critica: { label: "Crítica", cls: "text-red-400 bg-red-400/10 border-red-400/20" },
};

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  novo:           { label: "Novo",          cls: "text-blue-200/70 bg-white/5 border-white/10" },
  em_analise:     { label: "Em análise",    cls: "text-yellow-300 bg-yellow-400/10 border-yellow-400/20" },
  em_tratamento:  { label: "Em tratamento", cls: "text-orange-300 bg-orange-400/10 border-orange-400/20" },
  resolvido:      { label: "Resolvido",     cls: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
  ignorado:       { label: "Ignorado",      cls: "text-white/30 bg-white/5 border-white/10" },
};

const STATUS_OPTIONS = Object.keys(STATUS_CONFIG);

const fmtDate = (iso: string | null): string => {
  if (!iso) return "—";
  const utc = iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z";
  return new Date(utc).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

export default function PendenciasPage() {
  const [items, setItems] = useState<Pendencia[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);

  const [filterSeverity, setFilterSeverity] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterGerencia, setFilterGerencia] = useState("");
  const [filterCidade, setFilterCidade] = useState("");
  const [filterOrigem, setFilterOrigem] = useState("");

  const [availableGerencias, setAvailableGerencias] = useState<string[]>([]);
  const [availableCidades, setAvailableCidades] = useState<string[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editNote, setEditNote] = useState("");
  const [saving, setSaving] = useState(false);

  const perPage = 20;

  useEffect(() => {
    setCanEdit(auth.isAnalystOrAdmin());
  }, []);

  useEffect(() => {
    const params = filterOrigem ? `?origem=${filterOrigem}` : "";
    api.get(`/api/v1/pendencias/filtros${params}`)
      .then((data) => {
        setAvailableGerencias(data.gerencias ?? []);
        setAvailableCidades(data.cidades ?? []);
      })
      .catch(() => {});
  }, [filterOrigem]);

  const fetchPendencias = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(perPage) });
      if (filterSeverity) params.set("severity", filterSeverity);
      if (filterStatus) params.set("status", filterStatus);
      if (filterGerencia) params.set("gerencia", filterGerencia);
      if (filterCidade) params.set("cidade", filterCidade);
      if (filterOrigem) params.set("origem", filterOrigem);
      const data = await api.get(`/api/v1/pendencias?${params}`);
      setItems(data.items);
      setTotal(data.total);
    } catch {
      setError("Não foi possível carregar as pendências.");
    } finally {
      setLoading(false);
    }
  }, [page, filterSeverity, filterStatus, filterGerencia, filterCidade, filterOrigem]);

  useEffect(() => { fetchPendencias(); }, [fetchPendencias]);

  const startEdit = (p: Pendencia) => {
    setEditingId(p.id);
    setEditStatus(p.status);
    setEditNote(p.resolution_note ?? "");
  };

  const saveEdit = async (id: string) => {
    setSaving(true);
    try {
      await api.patch(`/api/v1/pendencias/${id}`, { status: editStatus, resolution_note: editNote || null });
      setEditingId(null);
      fetchPendencias();
    } catch {
      alert("Erro ao atualizar a pendência.");
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-start gap-4 mb-8">
          <div className="p-3 bg-[#003A70]/50 border border-blue-400/20 rounded-xl flex-shrink-0">
            <ListChecks className="w-6 h-6 text-blue-300" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Central de Pendências</h1>
            <p className="text-blue-200/50 text-sm mt-0.5">
              Atividades de ciclo sem GIASO, PCDP, processo, local definido ou agendamento.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select
            value={filterSeverity}
            onChange={(e) => { setFilterSeverity(e.target.value); setPage(1); }}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-blue-200/80 focus:outline-none focus:border-blue-400/50"
          >
            <option value="">Todas as severidades</option>
            {Object.entries(SEVERITY_CONFIG).map(([k, v]) => (
              <option key={k} value={k} className="bg-[#001233]">{v.label}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-blue-200/80 focus:outline-none focus:border-blue-400/50"
          >
            <option value="">Todos os status</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s} className="bg-[#001233]">{STATUS_CONFIG[s].label}</option>
            ))}
          </select>
          <select
            value={filterGerencia}
            onChange={(e) => { setFilterGerencia(e.target.value); setPage(1); }}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-blue-200/80 focus:outline-none focus:border-blue-400/50 w-48"
          >
            <option value="">Todas as gerências</option>
            {availableGerencias.map((g) => (
              <option key={g} value={g} className="bg-[#001233]">{g}</option>
            ))}
          </select>
          <select
            value={filterCidade}
            onChange={(e) => { setFilterCidade(e.target.value); setPage(1); }}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-blue-200/80 focus:outline-none focus:border-blue-400/50 w-48"
          >
            <option value="">Todas as cidades</option>
            {availableCidades.map((c) => (
              <option key={c} value={c} className="bg-[#001233]">{c}</option>
            ))}
          </select>
          <select
            value={filterOrigem}
            onChange={(e) => {
              setFilterOrigem(e.target.value);
              setFilterGerencia("");
              setFilterCidade("");
              setPage(1);
            }}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-blue-200/80 focus:outline-none focus:border-blue-400/50"
          >
            <option value="">Ciclos + PTA Mensal</option>
            <option value="ciclo" className="bg-[#001233]">Só Ciclos</option>
            <option value="pta_mensal" className="bg-[#001233]">Só PTA Mensal</option>
          </select>
          <div className="flex-1" />
          <button
            onClick={fetchPendencias}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-blue-200/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
            aria-label="Atualizar"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs text-blue-200/30">{total} pendência{total !== 1 ? "s" : ""}</span>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-blue-200/50">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Carregando pendências...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-red-400">
              <AlertCircle className="w-7 h-7" />
              <p className="text-sm">{error}</p>
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="Nenhuma pendência encontrada"
              description="Não há atividades pendentes para os filtros selecionados."
            />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  {["Severidade", "Origem", "Atividade", "Gerência / Cidade", "Motivo", "Status", "Atualizado", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-blue-200/50 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {items.map((p) => {
                  const sevInfo = SEVERITY_CONFIG[p.severity];
                  const statusInfo = STATUS_CONFIG[p.status];
                  return (
                    <tr key={p.id} className="hover:bg-white/5 transition-colors align-top">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${sevInfo.cls}`}>
                          {sevInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border text-blue-200/60 bg-white/5 border-white/10">
                          {ORIGEM_LABELS[p.origem] ?? p.origem}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/90 max-w-[220px]">
                        {p.origem === "ciclo" ? (
                          <a href={`/analises/${p.origem_id}`} className="hover:text-blue-300 transition-colors">
                            {p.atividade ?? "—"}
                          </a>
                        ) : (
                          <a href="/ptamensal" className="hover:text-blue-300 transition-colors">
                            {p.atividade ?? "—"}
                          </a>
                        )}
                        {p.mes && <p className="text-xs text-blue-200/40 mt-0.5">{p.mes}</p>}
                      </td>
                      <td className="px-4 py-3 text-blue-200/60 text-xs">
                        {p.gerencia ?? "—"}<br />{p.cidade ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-blue-200/60 text-xs max-w-[260px]">
                        <p>{p.motivo}</p>
                        <p className="text-blue-200/40 italic mt-1">{p.recomendacao}</p>
                      </td>
                      <td className="px-4 py-3">
                        {editingId === p.id ? (
                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-400/60"
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s} className="bg-[#001233]">{STATUS_CONFIG[s].label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusInfo.cls}`}>
                            {statusInfo.label}
                          </span>
                        )}
                        {editingId === p.id && (
                          <input
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                            placeholder="Nota (opcional)"
                            className="mt-2 w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-blue-400/60"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3 text-blue-200/40 text-xs whitespace-nowrap">
                        {fmtDate(p.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        {canEdit && (
                          editingId === p.id ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => saveEdit(p.id)}
                                disabled={saving}
                                className="p-1.5 rounded-lg text-emerald-300 hover:bg-emerald-400/10 transition-colors disabled:opacity-50"
                                aria-label="Salvar"
                              >
                                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-1.5 rounded-lg text-blue-200/40 hover:text-white hover:bg-white/10 transition-colors"
                                aria-label="Cancelar"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEdit(p)}
                              className="px-2.5 py-1 text-xs text-blue-300 bg-blue-400/10 border border-blue-400/20 rounded-lg hover:bg-blue-400/20 transition-colors"
                            >
                              Tratar
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {!loading && !error && totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-white/10">
              <p className="text-xs text-blue-200/40">
                {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} de {total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg text-blue-200/50 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-30 transition-colors"
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-blue-200/50 min-w-[4rem] text-center">{page} / {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg text-blue-200/50 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-30 transition-colors"
                  aria-label="Próxima página"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
