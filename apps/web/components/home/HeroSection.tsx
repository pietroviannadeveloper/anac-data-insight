"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  BarChart2,
  FolderOpen,
  ArrowRight,
  Sun,
  Sunset,
  Moon,
} from "lucide-react";
import { auth } from "@/lib/auth";

function getSaudacao(): { texto: string; Icon: React.ElementType } {
  const h = new Date().getHours();
  if (h >= 5 && h < 12)  return { texto: "Bom dia",  Icon: Sun };
  if (h >= 12 && h < 18) return { texto: "Boa tarde", Icon: Sunset };
  return                         { texto: "Boa noite", Icon: Moon };
}

const CARDS = [
  {
    key: "vigente",
    animClass: "animate-card-1",
    href: "/ptamensal",
    icon: CalendarDays,
    iconBg: "bg-blue-500/15 border-blue-400/25",
    iconColor: "text-blue-400",
    arrowHover: "group-hover:text-blue-400",
    borderHover: "hover:border-blue-400/40 hover:bg-blue-500/8",
    title: "Acompanhamento 2026",
    description:
      "Execução mensal, indicadores em tempo real, servidores e atividades do PTA vigente.",
    tag: "PTA vigente",
    tagColor: "bg-blue-500/15 text-blue-300 border-blue-400/20",
  },
  {
    key: "historico",
    animClass: "animate-card-2",
    href: "/pta/historico",
    icon: BarChart2,
    iconBg: "bg-amber-500/15 border-amber-400/25",
    iconColor: "text-amber-400",
    arrowHover: "group-hover:text-amber-400",
    borderHover: "hover:border-amber-400/40 hover:bg-amber-500/8",
    title: "Histórico & Comparativo",
    description:
      "Dados de 2021 a 2025. Compare anos, evolua indicadores e planeje o próximo PTA.",
    tag: "2021 – 2025",
    tagColor: "bg-amber-500/15 text-amber-300 border-amber-400/20",
  },
  {
    key: "analises",
    animClass: "animate-card-3",
    href: "/analises",
    icon: FolderOpen,
    iconBg: "bg-emerald-500/15 border-emerald-400/25",
    iconColor: "text-emerald-400",
    arrowHover: "group-hover:text-emerald-400",
    borderHover: "hover:border-emerald-400/40 hover:bg-emerald-500/8",
    title: "Análises & Relatórios",
    description:
      "Upload de planilhas, documentos PDF, Chat IA, exportações e análises salvas.",
    tag: "Ferramentas",
    tagColor: "bg-emerald-500/15 text-emerald-300 border-emerald-400/20",
  },
];

export default function HeroSection() {
  const [displayName, setDisplayName] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDisplayName(auth.getDisplayName());
  }, []);

  const { texto: saudacao, Icon: SaudacaoIcon } = getSaudacao();

  return (
    <section className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-16 relative overflow-hidden">

      {/* Glow de fundo */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="w-[600px] h-[600px] rounded-full bg-[#0057A8]/10 blur-3xl" />
      </div>
      <div className="pointer-events-none absolute top-0 right-0 w-80 h-80 bg-blue-500/6 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl" />

      <div className="relative w-full max-w-4xl mx-auto">

        {/* Badge institucional */}
        <div className="flex justify-center mb-8 animate-greeting">
          <span className="inline-flex items-center gap-2 bg-white/8 backdrop-blur-sm text-blue-200/70 text-xs font-medium px-4 py-1.5 rounded-full border border-white/12">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Plataforma ANAC — Uso Interno
          </span>
        </div>

        {/* Boas-vindas */}
        <div className="text-center mb-3 animate-greeting">
          {mounted && displayName ? (
            <div className="flex items-center justify-center gap-2.5 text-blue-100/80">
              <SaudacaoIcon className="w-5 h-5 text-amber-300 shrink-0" />
              <span className="text-lg font-medium">
                {saudacao},{" "}
                <strong className="text-white font-semibold">{displayName}</strong>!
              </span>
            </div>
          ) : (
            <div className="h-7" /> /* placeholder para evitar layout shift */
          )}
        </div>

        {/* Pergunta principal */}
        <div className="text-center mb-12 animate-question">
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            O que vamos acompanhar{" "}
            <span className="text-blue-300">hoje?</span>
          </h1>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
          {CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.key}
                href={card.href}
                className={`
                  group relative flex flex-col gap-5 p-6 rounded-2xl
                  bg-white/4 border border-white/10
                  transition-all duration-300 ease-out
                  hover:shadow-xl hover:shadow-black/30 hover:-translate-y-1
                  ${card.borderHover} ${card.animClass}
                `}
              >
                {/* Ícone */}
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${card.iconBg}`}>
                  <Icon className={`w-5 h-5 ${card.iconColor}`} />
                </div>

                {/* Conteúdo */}
                <div className="flex-1">
                  <h2 className="text-white font-semibold text-base mb-2 leading-snug">
                    {card.title}
                  </h2>
                  <p className="text-blue-200/50 text-sm leading-relaxed">
                    {card.description}
                  </p>
                </div>

                {/* Rodapé do card */}
                <div className="flex items-center justify-between">
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${card.tagColor}`}>
                    {card.tag}
                  </span>
                  <ArrowRight
                    className={`w-4 h-4 text-white/20 transition-all duration-200 group-hover:translate-x-1 ${card.arrowHover}`}
                  />
                </div>
              </Link>
            );
          })}
        </div>

        {/* Rodapé sutil */}
        <p className="text-center text-white/20 text-xs mt-10 animate-question">
          ANAC Data Insight · PTA 2026
        </p>
      </div>
    </section>
  );
}
