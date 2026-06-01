"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Search, Filter, SortAsc, SortDesc, Loader2, AlertCircle, Inbox,
} from "lucide-react";

interface ActivityRow {
  id: string;
  item?: string;
  atividade?: string;
  gerencia?: string;
  setor?: string;
  regulado?: string;
  cidade?: string;
  mes?: string;
  mes_agendado?: string;
  mes_realizado?: string;
  giaso?: string;
  processo?: string;
  pcdp?: string;
  prioridade?: string;
  status?: string;
  sem_giaso: number;
  sem_pcdp: number;
  sem_processo: number;
  local_indefinido: number;
  tipo_ciclo?: string;
  criterio_classificacao?: string;
}

interface Filters {
  status: string;
  gerencia: string;
  cidade: string;
  setor: string;
  sem_giaso: string;
  sem_pcdp: string;
  sem_processo: string;
  local_indefinido: string;
  tipo_ciclo: string;
  search: string;
}

const EMPTY_FILTERS: Filters = {
  status: "",
  gerencia: "",
  cidade: "",
  setor: "",
  sem_giaso: "",
  sem_pcdp: "",
  sem_processo: "",
  local_indefinido: "",
  tipo_ciclo: "",
  search: "",
};

const TIPO_CICLO_CONFIG: Record<string, { label: string; className: string }> = {
  CICLO_BASE:       { label: "Base",        className: "bg-indigo-400/15 text-indigo-300 border-indigo-400/25" },
  CICLO_DESEMPENHO: { label: "Desempenho",  className: "bg-purple-400/15 text-purple-300 border-purple-400/25" },
  NAO_PROGRAMADA:   { label: "Não Prog.",   className: "bg-orange-400/15 text-orange-300 border-orange-400/25" },
  INDEFINIDO:       { label: "Indefinido",  className: "bg-white/10 text-white/40 border-white/15" },
};

function TipoBadge({ tipo }: { tipo?: string }) {
  if (!tipo) return <span className="text-white/20 italic">—</span>;
  const cfg = TIPO_CICLO_CONFIG[tipo] ?? TIPO_CICLO_CONFIG.INDEFINIDO;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status?: string }) {
  if (status === "realizado")
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-400/15 text-emerald-400 border border-emerald-400/25">Realizado</span>;
  if (status === "agendado")
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-400/15 text-blue-300 border border-blue-400/25">Agendado</span>;
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-400/15 text-yellow-300 border border-yellow-400/25">Sem Agend.</span>;
}

function PendBadge({ label }: { label: string }) {
  return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-400/15 text-red-400 border border-red-400/25">{label}</span>;
}

function Cell({ value }: { value?: string | null }) {
  return value ? (
    <span className="text-blue-100/70">{value}</span>
  ) : (
    <span className="text-white/20 italic">—</span>
  );
}

export default function ActivityTable({ analysisId }: { analysisId: string }) {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const load = useCallback(async (p: number, f: Filters) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), page_size: String(pageSize) });
      if (f.status) params.set("status", f.status);
      if (f.gerencia) params.set("gerencia", f.gerencia);
      if (f.cidade) params.set("cidade", f.cidade);
      if (f.setor) params.set("setor", f.setor);
      if (f.sem_giaso) params.set("sem_giaso", f.sem_giaso);
      if (f.sem_pcdp) params.set("sem_pcdp", f.sem_pcdp);
      if (f.sem_processo) params.set("sem_processo", f.sem_processo);
      if (f.local_indefinido) params.set("local_indefinido", f.local_indefinido);
      if (f.tipo_ciclo) params.set("tipo_ciclo", f.tipo_ciclo);
      if (f.search) params.set("search", f.search);
      if (sortBy) { params.set("sort_by", sortBy); params.set("sort_order", sortOrder); }

      const data = await api.get(`/api/v1/analyses/${analysisId}/treated-data?${params}`);
      setRows(data.items);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch {
      setError("Não foi possível carregar as atividades.");
    } finally {
      setLoading(false);
    }
  }, [analysisId, pageSize, sortBy, sortOrder]);

  useEffect(() => { load(page, applied); }, [page, applied, load]);

  const applyFilters = () => { setApplied({ ...filters }); setPage(1); };
  const clearFilters = () => { setFilters(EMPTY_FILTERS); setApplied(EMPTY_FILTERS); setPage(1); };

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortOrder(o => o === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortOrder("asc"); }
    setPage(1);
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortBy !== col) return <SortAsc className="w-3 h-3 text-white/20" />;
    return sortOrder === "asc"
      ? <SortAsc className="w-3 h-3 text-blue-300" />
      : <SortDesc className="w-3 h-3 text-blue-300" />;
  };

  const hasFilters = Object.values(applied).some(Boolean);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-blue-100 placeholder-white/25 focus:outline-none focus:border-blue-400/50"
            placeholder="Buscar atividade, regulado, GIASO, PCDP..."
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            onKeyDown={e => e.key === "Enter" && applyFilters()}
          />
        </div>
        <button
          onClick={() => setShowFilters(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
            hasFilters
              ? "bg-blue-500/20 border-blue-400/40 text-blue-300"
              : "bg-white/5 border-white/10 text-blue-200/60 hover:text-blue-200"
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          Filtros{hasFilters ? " ●" : ""}
        </button>
        {hasFilters && (
          <button onClick={clearFilters} className="text-xs text-blue-200/40 hover:text-blue-200/70 transition-colors">
            Limpar filtros
          </button>
        )}
        <span className="text-xs text-blue-200/40 ml-auto">
          {total.toLocaleString("pt-BR")} atividade{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-blue-200/50 mb-1">Status</label>
            <select
              className="w-full bg-[#0d1f3c] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-blue-100 focus:outline-none focus:border-blue-400/50"
              value={filters.status}
              onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
            >
              <option value="">Todos</option>
              <option value="realizado">Realizado</option>
              <option value="agendado">Agendado</option>
              <option value="sem-agendamento">Sem agendamento</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-blue-200/50 mb-1">Gerência</label>
            <input
              className="w-full bg-[#0d1f3c] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-blue-100 placeholder-white/25 focus:outline-none focus:border-blue-400/50"
              placeholder="Filtrar gerência..."
              value={filters.gerencia}
              onChange={e => setFilters(f => ({ ...f, gerencia: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-blue-200/50 mb-1">Cidade</label>
            <input
              className="w-full bg-[#0d1f3c] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-blue-100 placeholder-white/25 focus:outline-none focus:border-blue-400/50"
              placeholder="Filtrar cidade..."
              value={filters.cidade}
              onChange={e => setFilters(f => ({ ...f, cidade: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-blue-200/50 mb-1">Setor</label>
            <input
              className="w-full bg-[#0d1f3c] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-blue-100 placeholder-white/25 focus:outline-none focus:border-blue-400/50"
              placeholder="Filtrar setor..."
              value={filters.setor}
              onChange={e => setFilters(f => ({ ...f, setor: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-blue-200/50 mb-1">Sem GIASO</label>
            <select
              className="w-full bg-[#0d1f3c] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-blue-100 focus:outline-none focus:border-blue-400/50"
              value={filters.sem_giaso}
              onChange={e => setFilters(f => ({ ...f, sem_giaso: e.target.value }))}
            >
              <option value="">Todos</option>
              <option value="1">Sim</option>
              <option value="0">Não</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-blue-200/50 mb-1">Sem PCDP</label>
            <select
              className="w-full bg-[#0d1f3c] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-blue-100 focus:outline-none focus:border-blue-400/50"
              value={filters.sem_pcdp}
              onChange={e => setFilters(f => ({ ...f, sem_pcdp: e.target.value }))}
            >
              <option value="">Todos</option>
              <option value="1">Sim</option>
              <option value="0">Não</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-blue-200/50 mb-1">Sem Processo</label>
            <select
              className="w-full bg-[#0d1f3c] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-blue-100 focus:outline-none focus:border-blue-400/50"
              value={filters.sem_processo}
              onChange={e => setFilters(f => ({ ...f, sem_processo: e.target.value }))}
            >
              <option value="">Todos</option>
              <option value="1">Sim</option>
              <option value="0">Não</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-blue-200/50 mb-1">Local Indefinido</label>
            <select
              className="w-full bg-[#0d1f3c] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-blue-100 focus:outline-none focus:border-blue-400/50"
              value={filters.local_indefinido}
              onChange={e => setFilters(f => ({ ...f, local_indefinido: e.target.value }))}
            >
              <option value="">Todos</option>
              <option value="1">Sim</option>
              <option value="0">Não</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-blue-200/50 mb-1">Tipo de Ciclo</label>
            <select
              className="w-full bg-[#0d1f3c] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-blue-100 focus:outline-none focus:border-blue-400/50"
              value={filters.tipo_ciclo}
              onChange={e => setFilters(f => ({ ...f, tipo_ciclo: e.target.value }))}
            >
              <option value="">Todos</option>
              <option value="CICLO_BASE">Base</option>
              <option value="CICLO_DESEMPENHO">Desempenho</option>
              <option value="NAO_PROGRAMADA">Não Programada</option>
              <option value="INDEFINIDO">Indefinido</option>
            </select>
          </div>
          <div className="col-span-full flex justify-end gap-2 pt-1">
            <button
              onClick={clearFilters}
              className="px-3 py-1.5 text-xs text-blue-200/50 hover:text-blue-200 transition-colors"
            >
              Limpar
            </button>
            <button
              onClick={applyFilters}
              className="px-4 py-1.5 text-xs font-medium bg-blue-500/20 border border-blue-400/40 text-blue-300 rounded-lg hover:bg-blue-500/30 transition-colors"
            >
              Aplicar
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-blue-200/50">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Carregando atividades...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-red-400">
            <AlertCircle className="w-6 h-6" />
            <span className="text-sm">{error}</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-blue-200/40">
            <Inbox className="w-8 h-8" />
            <span className="text-sm">{hasFilters ? "Nenhuma atividade encontrada com estes filtros." : "Nenhuma atividade registrada."}</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  {[
                    { key: "", label: "#", sortable: false },
                    { key: "", label: "Tipo", sortable: false },
                    { key: "atividade", label: "Atividade", sortable: true },
                    { key: "gerencia", label: "Gerência", sortable: true },
                    { key: "setor", label: "Setor", sortable: true },
                    { key: "regulado", label: "Regulado", sortable: false },
                    { key: "cidade", label: "Cidade", sortable: true },
                    { key: "mes", label: "Mês", sortable: true },
                    { key: "mes_agendado", label: "Agendado", sortable: false },
                    { key: "mes_realizado", label: "Realizado", sortable: false },
                    { key: "giaso", label: "GIASO", sortable: false },
                    { key: "processo", label: "Processo", sortable: false },
                    { key: "pcdp", label: "PCDP", sortable: false },
                    { key: "status", label: "Status", sortable: true },
                    { key: "pendencias", label: "Pendências", sortable: false },
                  ].map(({ key, label, sortable }) => (
                    <th
                      key={key || label}
                      className={`text-left px-3 py-2.5 font-medium text-blue-200/60 uppercase tracking-wide whitespace-nowrap ${sortable ? "cursor-pointer hover:text-blue-200 select-none" : ""}`}
                      onClick={sortable ? () => toggleSort(key) : undefined}
                    >
                      <span className="flex items-center gap-1">
                        {label}
                        {sortable && <SortIcon col={key} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((row, i) => {
                  const pends: string[] = [];
                  if (row.sem_giaso) pends.push("GIASO");
                  if (row.sem_pcdp) pends.push("PCDP");
                  if (row.sem_processo) pends.push("Processo");
                  if (row.local_indefinido) pends.push("Local");

                  return (
                    <tr key={row.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-3 py-2 text-white/30">{(page - 1) * pageSize + i + 1}</td>
                      <td className="px-3 py-2 whitespace-nowrap"><TipoBadge tipo={row.tipo_ciclo} /></td>
                      <td className="px-3 py-2 max-w-[180px]"><Cell value={row.atividade} /></td>
                      <td className="px-3 py-2 whitespace-nowrap"><Cell value={row.gerencia} /></td>
                      <td className="px-3 py-2 whitespace-nowrap"><Cell value={row.setor} /></td>
                      <td className="px-3 py-2 whitespace-nowrap"><Cell value={row.regulado} /></td>
                      <td className="px-3 py-2 whitespace-nowrap"><Cell value={row.cidade} /></td>
                      <td className="px-3 py-2 whitespace-nowrap"><Cell value={row.mes} /></td>
                      <td className="px-3 py-2 whitespace-nowrap"><Cell value={row.mes_agendado} /></td>
                      <td className="px-3 py-2 whitespace-nowrap"><Cell value={row.mes_realizado} /></td>
                      <td className="px-3 py-2 whitespace-nowrap"><Cell value={row.giaso} /></td>
                      <td className="px-3 py-2 whitespace-nowrap"><Cell value={row.processo} /></td>
                      <td className="px-3 py-2 whitespace-nowrap"><Cell value={row.pcdp} /></td>
                      <td className="px-3 py-2"><StatusBadge status={row.status} /></td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {pends.length === 0
                            ? <span className="text-white/20 italic">—</span>
                            : pends.map(p => <PendBadge key={p} label={p} />)
                          }
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && !error && total > 0 && (
        <div className="flex items-center justify-between text-xs text-blue-200/50">
          <span>
            Página {page} de {totalPages} · {total.toLocaleString("pt-BR")} registros
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={page === 1}
              className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-3 py-1 bg-white/5 rounded">{page}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
              className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
