"use client";

import { useEffect, useState } from "react";
import { BarChart2, CheckCircle2, AlertTriangle, CalendarDays, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";

interface DashSummary {
  total_analyses: number;
  total_activities: number;
  realizadas: number;
  average_execution_rate: number;
  critical_pending_items: number;
}

interface PtaSummary {
  consolidado?: {
    taxa_execucao?: number;
    total_planejado?: number;
    total_realizado?: number;
  };
}

interface KpiItem {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}

export default function LiveKpiStrip() {
  const [kpis, setKpis] = useState<KpiItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [dash, pta]: [DashSummary, PtaSummary] = await Promise.all([
          api.get("/api/v1/dashboard/summary"),
          api.get("/api/v1/pta-mensal/summary").catch(() => ({})),
        ]);

        if (cancelled) return;

        const taxaPta = pta?.consolidado?.taxa_execucao ?? null;
        const realizadasPta = pta?.consolidado?.total_realizado ?? null;
        const planejadoPta = pta?.consolidado?.total_planejado ?? null;

        const items: KpiItem[] = [
          {
            icon: BarChart2,
            label: "Ciclos analisados",
            value: dash.total_analyses > 0 ? String(dash.total_analyses) : "—",
            color: "text-blue-300",
          },
          {
            icon: CheckCircle2,
            label: "Taxa de execução média",
            value: dash.average_execution_rate > 0
              ? `${dash.average_execution_rate.toFixed(1)}%`
              : "—",
            color: dash.average_execution_rate >= 70
              ? "text-emerald-400"
              : dash.average_execution_rate >= 50
              ? "text-yellow-400"
              : "text-red-400",
          },
          {
            icon: AlertTriangle,
            label: "Pendências críticas",
            value: dash.critical_pending_items > 0
              ? String(dash.critical_pending_items)
              : "0",
            color: dash.critical_pending_items > 0 ? "text-orange-400" : "text-emerald-400",
          },
          {
            icon: CalendarDays,
            label: "PTA 2026 — realizadas",
            value: realizadasPta !== null && planejadoPta !== null && planejadoPta > 0
              ? `${realizadasPta} / ${planejadoPta}`
              : "—",
            color: "text-blue-300",
          },
          {
            icon: TrendingUp,
            label: "PTA 2026 — execução",
            value: taxaPta !== null ? `${taxaPta.toFixed(1)}%` : "—",
            color: taxaPta !== null
              ? taxaPta >= 70 ? "text-emerald-400" : taxaPta >= 50 ? "text-yellow-400" : "text-red-400"
              : "text-white/30",
          },
        ];

        setKpis(items);
      } catch {
        // Silently skip — não bloqueia a home se a API não responder
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  if (!kpis) return null;

  return (
    <div className="mt-10 animate-question">
      <p className="text-center text-white/25 text-[11px] uppercase tracking-widest mb-4 font-medium">
        Indicadores ao vivo
      </p>
      <div className="flex flex-wrap justify-center gap-3 sm:gap-5">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="flex items-center gap-2.5 bg-white/4 border border-white/8 rounded-xl px-4 py-2.5 min-w-[140px]"
            >
              <Icon className={`w-4 h-4 shrink-0 ${kpi.color}`} />
              <div>
                <p className="text-white/35 text-[10px] leading-none mb-1">{kpi.label}</p>
                <p className={`text-sm font-bold tabular-nums leading-none ${kpi.color}`}>
                  {kpi.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
