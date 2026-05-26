import Link from "next/link";
import { ArrowRight, History } from "lucide-react";

export default function HeroSection() {
  return (
    <section className="relative bg-gradient-to-br from-[#00112b] via-[#002050] to-[#003A70] overflow-hidden">
      <div className="absolute top-0 right-0 w-[32rem] h-[32rem] bg-[#0057A8]/25 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#001428]/60 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-blue-200 text-xs font-semibold px-4 py-2 rounded-full mb-8 border border-white/20">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-300 animate-pulse" />
          Plataforma ANAC — Uso Interno
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6 text-balance">
          Transforme planilhas operacionais em{" "}
          <span className="text-blue-300">inteligência para decisão.</span>
        </h1>

        <p className="text-lg text-blue-100/75 max-w-3xl mx-auto mb-10 text-balance leading-relaxed">
          Importe arquivos CSV ou Excel, identifique inconsistências, acompanhe
          ciclos, gere indicadores e receba análises executivas com apoio de
          inteligência artificial.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/upload"
            className="inline-flex items-center justify-center gap-2 bg-white text-[#003A70] hover:bg-blue-50 font-semibold px-8 py-3.5 rounded-lg transition-colors shadow-lg shadow-black/20"
          >
            Nova análise
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/analises"
            className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/18 backdrop-blur-sm border border-white/25 text-white font-semibold px-8 py-3.5 rounded-lg transition-colors"
          >
            <History className="w-4 h-4" />
            Ver histórico
          </Link>
        </div>
      </div>
    </section>
  );
}
