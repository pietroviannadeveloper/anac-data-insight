"use client";

import { useEffect, useState } from "react";
import { FileSpreadsheet, AlertTriangle, FileText, RefreshCcw } from "lucide-react";
import { api } from "@/lib/api";
import { LucideIcon } from "lucide-react";

interface Stats {
  arquivos: number;
  pendencias: number;
  ciclos: number;
}

function GlassMetric({ title, value, icon: Icon }: { title: string; value: number; icon: LucideIcon }) {
  return (
    <div className="bg-white/8 backdrop-blur-md border border-white/12 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-blue-300" />
        </div>
        <span className="text-xs font-medium text-blue-200/60 uppercase tracking-wide leading-tight">
          {title}
        </span>
      </div>
      <p className="text-3xl font-bold text-white tabular-nums">{value}</p>
    </div>
  );
}

export default function StatsSection() {
  const [stats, setStats] = useState<Stats>({ arquivos: 0, pendencias: 0, ciclos: 0 });

  useEffect(() => {
    api.get("/api/v1/analyses?per_page=100")
      .then((data) => {
        const items = data.items ?? [];
        const ciclos = items.filter((a: { detected_type: string }) => a.detected_type === "ciclos");
        const pendencias = ciclos.reduce(
          (sum: number, a: { indicators?: { pendencias_criticas?: number } }) =>
            sum + (a.indicators?.pendencias_criticas ?? 0),
          0
        );
        setStats({ arquivos: data.total, pendencias, ciclos: ciclos.length });
      })
      .catch(() => {});
  }, []);

  const cards = [
    { title: "Arquivos processados", value: stats.arquivos, icon: FileSpreadsheet },
    { title: "Pendências identificadas", value: stats.pendencias, icon: AlertTriangle },
    { title: "Relatórios gerados", value: stats.arquivos, icon: FileText },
    { title: "Ciclos acompanhados", value: stats.ciclos, icon: RefreshCcw },
  ];

  return (
    <section className="bg-[#001428] border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <p className="text-xs font-semibold text-blue-300/60 uppercase tracking-wider mb-5">
          Visão geral
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((s) => (
            <GlassMetric key={s.title} {...s} />
          ))}
        </div>
      </div>
    </section>
  );
}
