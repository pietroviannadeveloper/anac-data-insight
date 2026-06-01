"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/layout/AppHeader";
import AppFooter from "@/components/layout/AppFooter";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";
import {
  Settings, Bell, Mail, Plus, Trash2, Loader2, AlertCircle,
  CheckCircle, ToggleLeft, ToggleRight, ChevronDown, ChevronUp,
  Calendar, Play,
} from "lucide-react";

interface AlertRule {
  id: string;
  label: string;
  metric: string;
  operator: string;
  threshold: number;
  analysis_types: string[];
  enabled: boolean;
  created_by?: string;
}

interface AvailableMetrics {
  ciclos: string[];
  generic: string[];
  pdf: string[];
}

const OPERATOR_LABELS: Record<string, string> = {
  lt: "menor que (<)",
  gt: "maior que (>)",
  lte: "menor ou igual (≤)",
  gte: "maior ou igual (≥)",
  eq: "igual a (=)",
};

const METRIC_LABELS: Record<string, string> = {
  taxa_execucao: "Taxa de execução (%)",
  taxa_agendamento: "Taxa de agendamento (%)",
  realizadas: "Realizadas",
  agendadas: "Agendadas",
  sem_agendamento: "Sem agendamento",
  sem_giaso: "Sem GIASO",
  sem_pcdp: "Sem PCDP",
  sem_processo: "Sem processo",
  locais_indefinidos: "Locais indefinidos",
  pendencias_criticas: "Pendências críticas",
  pcdp_duplicada: "PCDP duplicada",
  multiplas_pcdps: "Múltiplas PCDPs",
  total_rows: "Total de linhas",
  duplicate_rows: "Linhas duplicadas",
  pages: "Páginas",
  word_count: "Palavras",
};

export default function ConfiguracoesPage() {
  const isAdmin = auth.isAdmin();

  // Alert rules
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [availableMetrics, setAvailableMetrics] = useState<AvailableMetrics>({ ciclos: [], generic: [], pdf: [] });
  const [rulesLoading, setRulesLoading] = useState(true);
  const [showNewRule, setShowNewRule] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newLabel, setNewLabel] = useState("");
  const [newMetric, setNewMetric] = useState("taxa_execucao");
  const [newOperator, setNewOperator] = useState("lt");
  const [newThreshold, setNewThreshold] = useState(60);
  const [newTypes, setNewTypes] = useState(["ciclos"]);

  // Scheduled reports
  interface ScheduledReport { id:string; label:string; cron_expression:string; gerencia_filter?:string; recipient_emails:string[]; enabled:boolean; last_run:string|null; }
  const [schedules, setSchedules] = useState<ScheduledReport[]>([]);
  const [cronExamples, setCronExamples] = useState<Record<string,string>>({});
  const [showNewSchedule, setShowNewSchedule] = useState(false);
  const [sLabel, setSLabel] = useState("");
  const [sCron, setSCron] = useState("0 8 1 * *");
  const [sGerencia, setSGerencia] = useState("");
  const [sEmails, setSEmails] = useState("");
  const [sSaving, setSSaving] = useState(false);

  useEffect(() => {
    api.get("/api/v1/scheduled-reports")
      .then(d => { setSchedules(d.items); setCronExamples(d.cron_examples || {}); })
      .catch(() => {});
  }, []);

  const createSchedule = async () => {
    if (!sLabel.trim() || !sCron.trim()) return;
    setSSaving(true);
    try {
      const r = await api.post("/api/v1/scheduled-reports", {
        label: sLabel.trim(), cron_expression: sCron.trim(),
        gerencia_filter: sGerencia.trim() || null,
        recipient_emails: sEmails.split(",").map(e => e.trim()).filter(Boolean),
        enabled: true,
      });
      setSchedules(prev => [r, ...prev]);
      setShowNewSchedule(false); setSLabel(""); setSCron("0 8 1 * *"); setSGerencia(""); setSEmails("");
    } catch { /* silent */ } finally { setSSaving(false); }
  };

  const toggleSchedule = async (s: ScheduledReport) => {
    const updated = await api.patch(`/api/v1/scheduled-reports/${s.id}`, { enabled: !s.enabled }).catch(() => null);
    if (updated) setSchedules(prev => prev.map(r => r.id === s.id ? updated : r));
  };

  const deleteSchedule = async (id: string) => {
    if (!confirm("Excluir este relatório agendado?")) return;
    await api.delete(`/api/v1/scheduled-reports/${id}`).catch(() => {});
    setSchedules(prev => prev.filter(r => r.id !== id));
  };

  const runNow = async (id: string) => {
    await api.post(`/api/v1/scheduled-reports/${id}/run-now`, {}).catch(() => {});
    alert("Relatório enviado agora.");
  };

  useEffect(() => {
    api.get("/api/v1/alert-rules")
      .then(d => { setRules(d.items); setAvailableMetrics(d.available_metrics); })
      .catch(() => {})
      .finally(() => setRulesLoading(false));
  }, []);

  const createRule = async () => {
    if (!newLabel.trim()) return;
    setSaving(true);
    try {
      const r = await api.post("/api/v1/alert-rules", {
        label: newLabel.trim(),
        metric: newMetric,
        operator: newOperator,
        threshold: newThreshold,
        analysis_types: newTypes,
        enabled: true,
      });
      setRules(prev => [r, ...prev]);
      setShowNewRule(false);
      setNewLabel("");
    } catch { /* silent */ } finally { setSaving(false); }
  };

  const toggleRule = async (rule: AlertRule) => {
    try {
      const updated = await api.patch(`/api/v1/alert-rules/${rule.id}`, { enabled: !rule.enabled });
      setRules(prev => prev.map(r => r.id === rule.id ? updated : r));
    } catch { /* silent */ }
  };

  const deleteRule = async (ruleId: string) => {
    if (!confirm("Excluir esta regra de alerta?")) return;
    try {
      await api.delete(`/api/v1/alert-rules/${ruleId}`);
      setRules(prev => prev.filter(r => r.id !== ruleId));
    } catch { /* silent */ }
  };

  const allMetrics = Array.from(new Set([...availableMetrics.ciclos, ...availableMetrics.generic, ...availableMetrics.pdf]));

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-6">
          <Link href="/" className="text-sm text-blue-300/60 hover:text-blue-300 transition-colors">← Início</Link>
          <h1 className="text-2xl font-bold text-white mt-3">Configurações</h1>
          <p className="text-blue-200/50 text-sm mt-1">Parâmetros da plataforma e integrações.</p>
        </div>

        <div className="space-y-6">

          {/* ── Alertas configuráveis ─────────────────────── */}
          <section className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-amber-300/70" />
                <div>
                  <h2 className="text-sm font-semibold text-white">Alertas Configuráveis</h2>
                  <p className="text-xs text-blue-200/40 mt-0.5">Disparam quando uma análise concluída viola um limiar.</p>
                </div>
              </div>
              <button onClick={() => setShowNewRule(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-300 bg-blue-400/10 border border-blue-400/25 rounded-lg hover:bg-blue-400/20 transition-colors">
                {showNewRule ? <><ChevronUp className="w-3.5 h-3.5" /> Cancelar</> : <><Plus className="w-3.5 h-3.5" /> Nova regra</>}
              </button>
            </div>

            {/* New rule form */}
            {showNewRule && (
              <div className="px-6 py-4 bg-blue-500/5 border-b border-white/8 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs text-blue-200/50 block mb-1">Nome da regra</label>
                    <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
                      placeholder="Ex: Taxa de execução baixa"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-blue-100 placeholder-white/25 focus:outline-none focus:border-blue-400/50" />
                  </div>
                  <div>
                    <label className="text-xs text-blue-200/50 block mb-1">Métrica</label>
                    <select value={newMetric} onChange={e => setNewMetric(e.target.value)}
                      className="w-full bg-[#0d1f3c] border border-white/10 rounded-lg px-3 py-2 text-sm text-blue-100 focus:outline-none">
                      {allMetrics.map(m => <option key={m} value={m}>{METRIC_LABELS[m] ?? m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-blue-200/50 block mb-1">Operador</label>
                    <select value={newOperator} onChange={e => setNewOperator(e.target.value)}
                      className="w-full bg-[#0d1f3c] border border-white/10 rounded-lg px-3 py-2 text-sm text-blue-100 focus:outline-none">
                      {Object.entries(OPERATOR_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-blue-200/50 block mb-1">Limiar (threshold)</label>
                    <input type="number" value={newThreshold} onChange={e => setNewThreshold(Number(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-blue-100 focus:outline-none focus:border-blue-400/50" />
                  </div>
                  <div>
                    <label className="text-xs text-blue-200/50 block mb-1">Aplica-se a</label>
                    <div className="flex gap-2 flex-wrap pt-1">
                      {["ciclos","generic","pdf"].map(t => (
                        <label key={t} className="flex items-center gap-1.5 text-xs text-blue-200/70 cursor-pointer">
                          <input type="checkbox" checked={newTypes.includes(t)}
                            onChange={e => setNewTypes(prev => e.target.checked ? [...prev,t] : prev.filter(x=>x!==t))}
                            className="accent-blue-500" />
                          {t}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button onClick={createRule} disabled={saving || !newLabel.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-500/30 border border-blue-400/40 rounded-lg hover:bg-blue-500/40 transition-colors disabled:opacity-40">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Salvar regra
                  </button>
                </div>
              </div>
            )}

            {/* Rules list */}
            {rulesLoading ? (
              <div className="flex items-center justify-center py-10 gap-2 text-blue-200/40">
                <Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">Carregando...</span>
              </div>
            ) : rules.length === 0 ? (
              <div className="py-10 text-center text-sm text-blue-200/30">
                Nenhuma regra configurada. Crie a primeira regra acima.
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {rules.map(r => (
                  <div key={r.id} className="flex items-center gap-3 px-6 py-3">
                    <button onClick={() => toggleRule(r)} className="text-blue-300/60 hover:text-blue-300 transition-colors shrink-0">
                      {r.enabled ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5 text-white/30" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${r.enabled ? "text-white/90" : "text-white/40"}`}>{r.label}</p>
                      <p className="text-xs text-blue-200/40 mt-0.5">
                        {METRIC_LABELS[r.metric] ?? r.metric} {OPERATOR_LABELS[r.operator]?.split(" ")[0] ?? r.operator} {r.threshold}
                        <span className="ml-2 text-white/25">· {r.analysis_types.join(", ")}</span>
                      </p>
                    </div>
                    {isAdmin && (
                      <button onClick={() => deleteRule(r.id)} className="text-white/20 hover:text-red-400 transition-colors shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Relatórios agendados ─────────────────────── */}
          <section className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-teal-300/70" />
                <div>
                  <h2 className="text-sm font-semibold text-white">Relatórios Agendados</h2>
                  <p className="text-xs text-blue-200/40 mt-0.5">Gera e envia PDF automaticamente por cron.</p>
                </div>
              </div>
              <button onClick={() => setShowNewSchedule(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-300 bg-teal-400/10 border border-teal-400/25 rounded-lg hover:bg-teal-400/20 transition-colors">
                {showNewSchedule ? <><ChevronUp className="w-3.5 h-3.5" /> Cancelar</> : <><Plus className="w-3.5 h-3.5" /> Novo</>}
              </button>
            </div>

            {showNewSchedule && (
              <div className="px-6 py-4 bg-teal-500/5 border-b border-white/8 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs text-blue-200/50 block mb-1">Nome do relatório</label>
                    <input value={sLabel} onChange={e => setSLabel(e.target.value)} placeholder="Ex: Relatório mensal GOAG"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-blue-100 placeholder-white/25 focus:outline-none focus:border-teal-400/50" />
                  </div>
                  <div>
                    <label className="text-xs text-blue-200/50 block mb-1">Expressão cron</label>
                    <input value={sCron} onChange={e => setSCron(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-blue-100 focus:outline-none focus:border-teal-400/50" />
                    <div className="mt-1 flex flex-wrap gap-1">
                      {Object.entries(cronExamples).map(([label, expr]) => (
                        <button key={expr} onClick={() => setSCron(expr)}
                          className="text-[10px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-blue-200/50 hover:text-blue-200 hover:bg-white/10 transition-colors">
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-blue-200/50 block mb-1">Filtrar por nome de arquivo (opcional)</label>
                    <input value={sGerencia} onChange={e => setSGerencia(e.target.value)} placeholder="Ex: GOAG"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-blue-100 placeholder-white/25 focus:outline-none focus:border-teal-400/50" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-blue-200/50 block mb-1">Destinatários (emails separados por vírgula)</label>
                    <input value={sEmails} onChange={e => setSEmails(e.target.value)} placeholder="ana@anac.gov.br, joao@anac.gov.br"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-blue-100 placeholder-white/25 focus:outline-none focus:border-teal-400/50" />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button onClick={createSchedule} disabled={sSaving || !sLabel.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-teal-500/30 border border-teal-400/40 rounded-lg hover:bg-teal-500/40 transition-colors disabled:opacity-40">
                    {sSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Salvar
                  </button>
                </div>
              </div>
            )}

            {schedules.length === 0 ? (
              <div className="py-10 text-center text-sm text-blue-200/30">Nenhum relatório agendado.</div>
            ) : (
              <div className="divide-y divide-white/5">
                {schedules.map(s => (
                  <div key={s.id} className="flex items-center gap-3 px-6 py-3">
                    <button onClick={() => toggleSchedule(s)} className="shrink-0">
                      {s.enabled ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5 text-white/30" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${s.enabled ? "text-white/90" : "text-white/40"}`}>{s.label}</p>
                      <p className="text-xs text-blue-200/40 mt-0.5 font-mono">{s.cron_expression}
                        {s.gerencia_filter && <span className="ml-2 not-italic">· filtro: {s.gerencia_filter}</span>}
                        {s.last_run && <span className="ml-2 not-italic">· último envio: {new Date(s.last_run + "Z").toLocaleDateString("pt-BR")}</span>}
                      </p>
                    </div>
                    <button onClick={() => runNow(s.id)} title="Executar agora"
                      className="text-teal-300/50 hover:text-teal-300 transition-colors shrink-0">
                      <Play className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteSchedule(s.id)}
                      className="text-white/20 hover:text-red-400 transition-colors shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Email (SMTP) ──────────────────────────────── */}
          <section className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="flex items-start gap-3 mb-4">
              <Mail className="w-5 h-5 text-blue-300/60 mt-0.5 shrink-0" />
              <div>
                <h2 className="text-sm font-semibold text-white">Notificações por Email (SMTP)</h2>
                <p className="text-xs text-blue-200/40 mt-1">
                  Configure as variáveis abaixo no arquivo <code className="bg-white/10 px-1 rounded">.env</code> do backend para habilitar envio de emails ao concluir análises e ao disparar alertas.
                </p>
              </div>
            </div>
            <div className="bg-black/20 rounded-lg p-4 font-mono text-xs text-blue-200/70 space-y-1">
              <p><span className="text-blue-300">SMTP_HOST</span>=smtp.gmail.com</p>
              <p><span className="text-blue-300">SMTP_PORT</span>=587</p>
              <p><span className="text-blue-300">SMTP_USER</span>=seu@email.com</p>
              <p><span className="text-blue-300">SMTP_PASSWORD</span>=sua-senha-de-app</p>
              <p><span className="text-blue-300">SMTP_FROM</span>=seu@email.com</p>
              <p><span className="text-blue-300">SMTP_TLS</span>=true</p>
            </div>
            <p className="text-xs text-blue-200/30 mt-3">
              Cada usuário deve ter um email configurado no painel Admin para receber notificações. Sem SMTP configurado, os envios são silenciosamente ignorados.
            </p>
          </section>

          {/* ── IA ────────────────────────────────────────── */}
          <section className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <Settings className="w-5 h-5 text-blue-300/60 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-semibold text-white">Inteligência Artificial</h2>
                <p className="text-xs text-blue-200/40 mt-1">
                  Configure a chave de API Gemini ou OpenAI no arquivo <code className="bg-white/10 px-1 rounded">.env</code> do backend.
                </p>
                <div className="bg-black/20 rounded-lg p-3 font-mono text-xs text-blue-200/70 space-y-1 mt-3">
                  <p><span className="text-blue-300">GEMINI_API_KEY</span>=sua-chave  <span className="text-white/25"># preferido</span></p>
                  <p><span className="text-blue-300">OPENAI_API_KEY</span>=sua-chave  <span className="text-white/25"># fallback</span></p>
                </div>
              </div>
            </div>
          </section>

          {/* ── Versão ────────────────────────────────────── */}
          <section className="text-xs text-blue-200/25 space-y-1 px-1">
            <p>Versão da plataforma: <span className="font-mono text-blue-200/40">0.1.0</span></p>
            <p>API: <span className="font-mono text-blue-200/40">{process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}</span></p>
          </section>
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
