import Link from "next/link";
import AppHeader from "@/components/layout/AppHeader";
import AppFooter from "@/components/layout/AppFooter";
import EmptyState from "@/components/ui/EmptyState";
import { RefreshCcw } from "lucide-react";

export default function CiclosPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-6">
          <Link href="/" className="text-sm text-blue-300/60 hover:text-blue-300 transition-colors">
            ← Início
          </Link>
          <h1 className="text-2xl font-bold text-white mt-3">Ciclos de Inspeção</h1>
          <p className="text-blue-200/50 text-sm mt-1">
            Acompanhamento de ciclos operacionais e indicadores de execução.
          </p>
        </div>
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
          <EmptyState
            icon={RefreshCcw}
            title="Nenhum ciclo importado"
            description="Importe uma planilha de ciclos para visualizar os indicadores aqui."
          />
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
