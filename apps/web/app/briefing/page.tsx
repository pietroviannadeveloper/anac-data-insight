"use client";

import { useCallback, useEffect, useState } from "react";
import AppHeader from "@/components/layout/AppHeader";
import AppFooter from "@/components/layout/AppFooter";
import {
  Presentation, Loader2, AlertCircle, TrendingUp, TrendingDown, Minus, Mail, Send,
} from "lucide-react";
import { api } from "@/lib/api";

interface PendenciaItem {
  id: string;
  origem: "ciclo" | "pta_mensal";
  gerencia: string | null;
  cidade: string | null;
  atividade: string | null;
  status: string;
}

const ORIGEM_LABELS: Record<string, string> = { ciclo: "Ciclos", pta_mensal: "PTA Mensal" };

interface BriefingData {
  kpis: {
    total_activities: number;
    realizadas: number;
    agendadas: number;
    sem_agendamento: number;
    average_execution_rate: number | null;
    pendencias_criticas: number;
  };
  comparison: {
    average_execution_rate_previous: number | null;
    delta: number | null;
  };
  pendencias_criticas: { total: number; items: PendenciaItem[] };
  gerencias_atencao: { gerencia: string; criticas: number }[];
  cidades_atencao: { cidade: string; criticas: number }[];
}

function MetricTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white/8 backdrop-blur-sm border border-white/12 rounded-xl p-4">
      <p className="text-xs text-blue-200/50 uppercase tracking-wide mb-2">{label}</p>
      <p className="text-2xl font-bold tabular-nums text-white">{value}</p>
      {sub && <p className="text-xs text-blue-200/35 mt-0.5">{sub}</p>}
    </div>
  );
}

function DeltaIndicator({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  if (delta > 0) return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
      <TrendingUp className="w-3.5 h-3.5" /> +{delta}pp vs. período anterior
    </span>
  );
  if (delta < 0) return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-400">
      <TrendingDown className="w-3.5 h-3.5" /> {delta}pp vs. período anterior
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-200/50">
      <Minus className="w-3.5 h-3.5" /> Sem variação
    </span>
  );
}

export default function BriefingPage() {
  const [data, setData] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [gerencia, setGerencia] = useState("");
  const [cidade, setCidade] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [origem, setOrigem] = useState("");
  const [incluirHistorico, setIncluirHistorico] = useState(true);

  const [availableGerencias, setAvailableGerencias] = useState<string[]>([]);
  const [availableCidades, setAvailableCidades] = useState<string[]>([]);

  const [emailInput, setEmailInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendMessage, setSendMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = origem ? `?origem=${origem}` : "";
    api.get(`/api/v1/pendencias/filtros${params}`)
      .then((result) => {
        setAvailableGerencias(result.gerencias ?? []);
        setAvailableCidades(result.cidades ?? []);
      })
      .catch(() => {});
  }, [origem]);

  const fetchBriefing = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (gerencia) params.set("gerencia", gerencia);
      if (cidade) params.set("cidade", cidade);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      if (origem) params.set("origem", origem);
      params.set("incluir_historico", String(incluirHistorico));
      const result = await api.get(`/api/v1/dashboard/briefing?${params}`);
      setData(result);
    } catch {
      setError("Não foi possível carregar o briefing executivo.");
    } finally {
      setLoading(false);
    }
  }, [gerencia, cidade, dateFrom, dateTo, origem, incluirHistorico]);

  useEffect(() => { fetchBriefing(); }, [fetchBriefing]);

  const handleSendEmail = useCallback(async () => {
    const recipients = emailInput.split(",").map((e) => e.trim()).filter(Boolean);
    if (recipients.length === 0) {
      setSendMessage("Informe ao menos um e-mail.");
      return;
    }
    setSending(true);
    setSendMessage(null);
    try {
      await api.post("/api/v1/dashboard/briefing/email", {
        recipients, gerencia, cidade, date_from: dateFrom, date_to: dateTo,
        origem, incluir_historico: incluirHistorico,
      });
      setSendMessage("Briefing enviado com sucesso.");
    } catch (e) {
      setSendMessage(e instanceof Error ? e.message : "Erro ao enviar o briefing.");
    } finally {
      setSending(false);
    }
  }, [emailInput, gerencia, cidade, dateFrom, dateTo, origem, incluirHistorico]);

  // ponytail: SMTP corporativo bloqueado (sem senha de app) — baixa o PPTX e abre
  // o Outlook Web com destinatário/assunto/corpo prontos; o anexo é manual.
  const handleSendViaOutlook = useCallback(async () => {
    const recipients = emailInput.split(",").map((e) => e.trim()).filter(Boolean);
    if (recipients.length === 0) {
      setSendMessage("Informe ao menos um e-mail.");
      return;
    }
    setSending(true);
    setSendMessage(null);
    try {
      const params = new URLSearchParams();
      if (gerencia) params.set("gerencia", gerencia);
      if (cidade) params.set("cidade", cidade);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      if (origem) params.set("origem", origem);
      params.set("incluir_historico", String(incluirHistorico));
      const blob = await api.download(`/api/v1/dashboard/briefing/pptx?${params}`);
      const now = new Date().toLocaleDateString("pt-BR");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `briefing_executivo_${now.replace(/\//g, "-")}.pptx`;
      a.click();
      URL.revokeObjectURL(url);

      const subject = `[ANAC Data Insight] Briefing Executivo — ${now}`;
      const body = `Segue em anexo o briefing executivo gerado em ${now}, com Ciclos de Fiscalização e PTA Mensal, ` +
        `comparação com o ano anterior e gerências/cidades em atenção.\n\n` +
        `O arquivo foi baixado nesta aba — anexe-o manualmente antes de enviar.`;
      const outlookUrl = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(recipients.join(";"))}` +
        `&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(outlookUrl, "_blank");
      setSendMessage("PPTX baixado e Outlook Web aberto — anexe o arquivo e envie por lá.");
    } catch (e) {
      setSendMessage(e instanceof Error ? e.message : "Erro ao preparar o envio pelo Outlook.");
    } finally {
      setSending(false);
    }
  }, [emailInput, gerencia, cidade, dateFrom, dateTo, origem, incluirHistorico]);

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-start gap-4 mb-8">
          <div className="p-3 bg-[#003A70]/50 border border-blue-400/20 rounded-xl flex-shrink-0">
            <Presentation className="w-6 h-6 text-blue-300" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Briefing Executivo</h1>
            <p className="text-blue-200/50 text-sm mt-0.5">
              Visão consolidada para reuniões — KPIs, riscos e pendências críticas.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <select
            value={origem}
            onChange={(e) => {
              setOrigem(e.target.value);
              setGerencia("");
              setCidade("");
            }}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-blue-200/80 focus:outline-none focus:border-blue-400/50"
          >
            <option value="">Ciclos + PTA Mensal</option>
            <option value="ciclo" className="bg-[#001233]">Só Ciclos</option>
            <option value="pta_mensal" className="bg-[#001233]">Só PTA Mensal</option>
          </select>
          <select
            value={gerencia}
            onChange={(e) => setGerencia(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-blue-200/80 focus:outline-none focus:border-blue-400/50 w-48"
          >
            <option value="">Todas as gerências</option>
            {availableGerencias.map((g) => (
              <option key={g} value={g} className="bg-[#001233]">{g}</option>
            ))}
          </select>
          <select
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-blue-200/80 focus:outline-none focus:border-blue-400/50 w-48"
          >
            <option value="">Todas as cidades</option>
            {availableCidades.map((c) => (
              <option key={c} value={c} className="bg-[#001233]">{c}</option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-blue-200/80 focus:outline-none focus:border-blue-400/50"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-blue-200/80 focus:outline-none focus:border-blue-400/50"
          />
          <label className="flex items-center gap-2 text-sm text-blue-200/60 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={incluirHistorico}
              onChange={(e) => setIncluirHistorico(e.target.checked)}
              className="accent-blue-500"
            />
            Comparar com PTA Histórico
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-6">
          <Mail className="w-4 h-4 text-blue-300/60" />
          <input
            type="text"
            placeholder="email@anac.gov.br, email2@anac.gov.br"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-blue-200/80 focus:outline-none focus:border-blue-400/50 w-72"
          />
          <button
            onClick={handleSendEmail}
            disabled={sending}
            className="flex items-center gap-2 bg-[#003A70] hover:bg-[#004a8c] disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar briefing por e-mail
          </button>
          <button
            onClick={handleSendViaOutlook}
            disabled={sending}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            title="Baixa o PPTX e abre o Outlook Web com o e-mail pronto — use quando o envio automático não estiver configurado."
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            Baixar e enviar pelo Outlook
          </button>
          {sendMessage && <span className="text-xs text-blue-200/60">{sendMessage}</span>}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-blue-200/50">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Carregando briefing...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-red-400">
            <AlertCircle className="w-7 h-7" />
            <p className="text-sm">{error}</p>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <MetricTile label="Total de atividades" value={data.kpis.total_activities.toLocaleString("pt-BR")} />
              <MetricTile label="Realizadas" value={data.kpis.realizadas.toLocaleString("pt-BR")} />
              <MetricTile label="Agendadas" value={data.kpis.agendadas.toLocaleString("pt-BR")} />
              <MetricTile label="Sem agendamento" value={data.kpis.sem_agendamento.toLocaleString("pt-BR")} />
              <MetricTile
                label="Taxa de execução"
                value={data.kpis.average_execution_rate !== null ? `${data.kpis.average_execution_rate}%` : "—"}
              />
              <MetricTile label="Pendências críticas" value={data.kpis.pendencias_criticas} />
            </div>

            <DeltaIndicator delta={data.comparison.delta} />

            {/* Gerências / cidades com atenção necessária */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-200/60 uppercase tracking-wide mb-3">
                  Gerências com atenção necessária
                </p>
                {data.gerencias_atencao.length === 0 ? (
                  <p className="text-sm text-blue-200/30">Nenhuma pendência crítica concentrada.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.gerencias_atencao.map((g) => (
                      <li key={g.gerencia} className="flex items-center justify-between text-sm">
                        <span className="text-white/80">{g.gerencia}</span>
                        <span className="text-red-400 font-medium">{g.criticas} crítica{g.criticas !== 1 ? "s" : ""}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-200/60 uppercase tracking-wide mb-3">
                  Cidades com atenção necessária
                </p>
                {data.cidades_atencao.length === 0 ? (
                  <p className="text-sm text-blue-200/30">Nenhuma pendência crítica concentrada.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.cidades_atencao.map((c) => (
                      <li key={c.cidade} className="flex items-center justify-between text-sm">
                        <span className="text-white/80">{c.cidade}</span>
                        <span className="text-red-400 font-medium">{c.criticas} crítica{c.criticas !== 1 ? "s" : ""}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Pendências críticas */}
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
                <p className="text-xs font-semibold text-blue-200/60 uppercase tracking-wide">
                  Pendências críticas ({data.pendencias_criticas.total})
                </p>
                <a href="/pendencias" className="text-xs text-blue-300 hover:text-blue-200 transition-colors">
                  Ver central de pendências →
                </a>
              </div>
              {data.pendencias_criticas.items.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-blue-200/30 text-sm">
                  Nenhuma pendência crítica ativa.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      {["Origem", "Atividade", "Gerência", "Cidade", "Status"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-blue-200/50 uppercase tracking-wide">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {data.pendencias_criticas.items.map((p) => (
                      <tr key={p.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-2.5 text-blue-200/50 text-xs">{ORIGEM_LABELS[p.origem] ?? p.origem}</td>
                        <td className="px-4 py-2.5 text-white/80">{p.atividade ?? "—"}</td>
                        <td className="px-4 py-2.5 text-blue-200/60">{p.gerencia ?? "—"}</td>
                        <td className="px-4 py-2.5 text-blue-200/60">{p.cidade ?? "—"}</td>
                        <td className="px-4 py-2.5 text-blue-200/60">{p.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : null}
      </main>
      <AppFooter />
    </div>
  );
}
