import Link from "next/link";
import AppHeader from "@/components/layout/AppHeader";
import AppFooter from "@/components/layout/AppFooter";
import { Settings } from "lucide-react";

export default function ConfiguracoesPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-6">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            ← Início
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-3">Configurações</h1>
          <p className="text-gray-500 text-sm mt-1">
            Parâmetros do ambiente e integrações.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Settings className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Inteligência Artificial</h2>
              <p className="text-sm text-gray-500 mt-1">
                Configure a chave de API OpenAI para habilitar resumos executivos automáticos.
                Defina a variável <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">OPENAI_API_KEY</code> no arquivo <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">.env</code> do backend.
              </p>
            </div>
          </div>

          <hr className="border-gray-100" />

          <div className="text-sm text-gray-400 space-y-1">
            <p>Versão da plataforma: <span className="font-mono">0.1.0</span></p>
            <p>Ambiente: <span className="font-mono">development</span></p>
            <p>API URL: <span className="font-mono">{process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}</span></p>
          </div>
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
