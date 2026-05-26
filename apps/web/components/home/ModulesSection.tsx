import Link from "next/link";
import { RefreshCcw, BarChart2, FileText, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const modules = [
  {
    icon: RefreshCcw,
    title: "Ciclos de Inspeção",
    description:
      "Importe planilhas de ciclo, calcule indicadores automáticos e identifique atividades sem agendamento ou pendências críticas.",
    available: true,
    href: "/ciclos",
  },
  {
    icon: BarChart2,
    title: "Análise Genérica",
    description:
      "Analise qualquer planilha tabular: perfil de dados, valores nulos, distribuições e alertas de qualidade.",
    available: true,
    href: "/analises",
  },
  {
    icon: FileText,
    title: "Relatórios Executivos",
    description:
      "Gere relatórios em PDF prontos para compartilhamento com gestores, com suporte de inteligência artificial.",
    available: true,
    href: "/relatorios",
  },
  {
    icon: Zap,
    title: "Integração Power BI",
    description:
      "Exporte indicadores calculados diretamente para dashboards Power BI via conector dedicado.",
    available: false,
    href: "#",
  },
];

export default function ModulesSection() {
  return (
    <section className="bg-[#001a3a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="mb-8">
          <p className="text-xs font-semibold text-blue-300/60 uppercase tracking-wider mb-2">
            Módulos
          </p>
          <h2 className="text-2xl font-bold text-white">Escolha um módulo</h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {modules.map(({ icon: Icon, title, description, available, href }) => (
            <div
              key={title}
              className={cn(
                "relative rounded-xl p-6 flex flex-col gap-4 transition-all duration-200 backdrop-blur-sm",
                available
                  ? "bg-white/8 border border-white/12 hover:bg-white/12 hover:border-white/22 hover:-translate-y-0.5"
                  : "bg-white/4 border border-white/7 opacity-60"
              )}
            >
              <div className="flex items-start justify-between">
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    available ? "bg-blue-500/20" : "bg-white/8"
                  )}
                >
                  <Icon className={cn("w-5 h-5", available ? "text-blue-300" : "text-white/30")} />
                </div>
                <span
                  className={cn(
                    "text-xs font-semibold px-2.5 py-1 rounded-full",
                    available
                      ? "bg-blue-500/20 text-blue-300 border border-blue-400/20"
                      : "bg-white/8 text-white/40 border border-white/10"
                  )}
                >
                  {available ? "Disponível" : "Em breve"}
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1.5">{title}</h3>
                <p className="text-sm text-blue-100/50 leading-relaxed">{description}</p>
              </div>
              {available && (
                <Link
                  href={href}
                  className="mt-auto text-sm font-semibold text-blue-300 hover:text-blue-200 transition-colors"
                >
                  Acessar →
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
