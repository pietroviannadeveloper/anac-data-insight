"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";
import { Loader2, Lock, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.isAuthenticated()) {
      router.replace(searchParams.get("redirect") || "/");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    setError(null);
    try {
      await api.login(username, password);
      router.replace(searchParams.get("redirect") || "/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao autenticar.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#001f3f] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#003A70] border border-white/15 mb-4">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">ANAC Data Insight</h1>
          <p className="text-blue-200/50 text-sm mt-1">Acesso restrito — use suas credenciais institucionais</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-blue-200/70 mb-1.5">Usuário</label>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-white/8 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-blue-400/60 focus:bg-white/10 transition-colors"
              placeholder="seu.usuario"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-blue-200/70 mb-1.5">Senha</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/8 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-blue-400/60 focus:bg-white/10 transition-colors"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-300 bg-red-500/10 border border-red-400/20 rounded-lg px-3 py-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-white text-[#003A70] hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-sm rounded-lg transition-colors"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="text-center text-xs text-blue-200/25 mt-6">
          Agência Nacional de Aviação Civil · Uso interno restrito
        </p>
      </div>
    </div>
  );
}
