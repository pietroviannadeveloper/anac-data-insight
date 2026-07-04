"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppHeader from "@/components/layout/AppHeader";
import AppFooter from "@/components/layout/AppFooter";
import { auth } from "@/lib/auth";
import { History, CalendarDays, ArrowRight, BarChart2 } from "lucide-react";

export default function PTAHubPage() {
  const router = useRouter();

  useEffect(() => {
    if (!auth.isAuthenticated()) router.replace("/login");
  }, [router]);

  return (
    <div className="flex flex-col min-h-screen bg-[#001E3C]">
      <AppHeader />
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-2xl">

          {/* Título */}
          <div className="text-center mb-10">
            <div className="flex items-center justify-center gap-3 mb-3">
              <BarChart2 className="w-7 h-7 text-amber-400" />
              <h1 className="text-3xl font-bold text-white">PTA</h1>
            </div>
            <p className="text-blue-200/50 text-sm">
              Plano de Trabalho Anual — escolha a área que deseja acessar
            </p>
          </div>

          {/* Cards de opção */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

            {/* PTA Histórico */}
            <Link
              href="/pta/historico"
              className="group flex flex-col gap-4 p-7 bg-white/4 hover:bg-amber-500/10 border border-white/10 hover:border-amber-500/30 rounded-2xl transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/20">
                  <History className="w-6 h-6 text-amber-400" />
                </div>
                <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-amber-400 group-hover:translate-x-1 transition-all duration-200" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-lg mb-1">PTA Histórico</h2>
                <p className="text-blue-200/50 text-sm leading-relaxed">
                  Dados de 2021 a 2025. Comparativo entre anos, evolução de indicadores e base para planejamento.
                </p>
              </div>
              <span className="text-xs text-amber-300/60 font-medium">2021 – 2025</span>
            </Link>

            {/* Acompanhamento Vigente */}
            <Link
              href="/ptamensal"
              className="group flex flex-col gap-4 p-7 bg-white/4 hover:bg-blue-500/10 border border-white/10 hover:border-blue-400/30 rounded-2xl transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-xl bg-blue-500/15 border border-blue-400/20">
                  <CalendarDays className="w-6 h-6 text-blue-400" />
                </div>
                <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-blue-400 group-hover:translate-x-1 transition-all duration-200" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-lg mb-1">Acompanhamento PTA Vigente</h2>
                <p className="text-blue-200/50 text-sm leading-relaxed">
                  PTA 2026 em tempo real. Dashboard BI, upload de planilhas por tipo, filtros mensais e indicadores de execução.
                </p>
              </div>
              <span className="text-xs text-blue-300/60 font-medium">2026 — Vigente</span>
            </Link>

          </div>
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
