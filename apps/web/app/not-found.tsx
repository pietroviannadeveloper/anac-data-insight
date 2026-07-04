import Link from "next/link";
import { Home, ArrowLeft, SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col min-h-screen bg-[#00112b] items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* Ícone */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <SearchX className="w-10 h-10 text-blue-400/60" />
          </div>
        </div>

        {/* Código */}
        <p className="text-7xl font-black text-white/10 tabular-nums mb-2">404</p>

        {/* Mensagem */}
        <h1 className="text-xl font-bold text-white mb-3">Página não encontrada</h1>
        <p className="text-blue-200/40 text-sm leading-relaxed mb-8">
          A página que você está procurando não existe ou foi movida.
          Verifique o endereço ou volte para o início.
        </p>

        {/* Ações */}
        <div className="flex gap-3 justify-center">
          <Link
            href="/"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-400/25 text-blue-300 text-sm font-medium transition-colors"
          >
            <Home className="w-4 h-4" />
            Início
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
        </div>

        <p className="text-white/15 text-xs mt-10">ANAC Data Insight · Uso Interno</p>
      </div>
    </div>
  );
}
