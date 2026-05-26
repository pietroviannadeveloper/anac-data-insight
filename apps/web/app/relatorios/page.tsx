import Link from "next/link";
import AppHeader from "@/components/layout/AppHeader";
import AppFooter from "@/components/layout/AppFooter";
import EmptyState from "@/components/ui/EmptyState";
import { FileText } from "lucide-react";

export default function RelatoriosPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-6">
          <Link href="/" className="text-sm text-blue-300/60 hover:text-blue-300 transition-colors">
            ← Início
          </Link>
          <h1 className="text-2xl font-bold text-white mt-3">Relatórios</h1>
          <p className="text-blue-200/50 text-sm mt-1">
            Relatórios executivos gerados com suporte de inteligência artificial.
          </p>
        </div>
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
          <EmptyState
            icon={FileText}
            title="Nenhum relatório disponível"
            description="Conclua uma análise para gerar um relatório executivo automático."
          />
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
