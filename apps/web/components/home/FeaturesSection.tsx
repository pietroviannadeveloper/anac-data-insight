import FeatureCard from "./FeatureCard";
import { Upload, BarChart2, Brain, RefreshCcw } from "lucide-react";

const features = [
  {
    icon: Upload,
    title: "Importação Inteligente",
    description:
      "Carregue arquivos CSV ou Excel de qualquer tamanho. O sistema detecta automaticamente o tipo de planilha e aplica as regras de análise corretas.",
    href: "/upload",
  },
  {
    icon: BarChart2,
    title: "Indicadores Automáticos",
    description:
      "Calcule taxas de execução, agendamento, pendências críticas e muito mais — sem configuração manual, diretamente dos dados importados.",
    href: "/analises",
  },
  {
    icon: RefreshCcw,
    title: "Acompanhamento de Ciclos",
    description:
      "Monitore ciclos de inspeção, identifique atividades sem agendamento, sem GIASO e sem PCDP, com visão consolidada por gerência.",
    href: "/ciclos",
  },
  {
    icon: Brain,
    title: "Relatório com IA",
    description:
      "Gere resumos executivos e planos de ação automáticos com suporte de inteligência artificial, baseados exclusivamente nos dados analisados.",
    href: "/relatorios",
  },
];

export default function FeaturesSection() {
  return (
    <section className="bg-[#001a3a] border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="mb-8">
          <p className="text-xs font-semibold text-blue-300/60 uppercase tracking-wider mb-2">
            Funcionalidades
          </p>
          <h2 className="text-2xl font-bold text-white">
            Tudo que você precisa em uma plataforma
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f) => (
            <FeatureCard key={f.href} {...f} />
          ))}
        </div>
      </div>
    </section>
  );
}
