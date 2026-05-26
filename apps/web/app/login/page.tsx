"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";
import { Loader2, AlertCircle, Eye, EyeOff, User, KeyRound } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState<"username" | "password" | null>(null);

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
      setError(err instanceof Error ? err.message : "Credenciais inválidas.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Painel esquerdo — decorativo */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-[#001f3f] flex-col items-center justify-center overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#003A70]/30 rounded-full blur-2xl" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative z-10 text-center px-12">
          <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
            <Image src="/anac-logo.png" alt="ANAC" width={56} height={56} className="object-contain" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">ANAC Data Insight</h2>
          <p className="text-blue-200/70 text-base leading-relaxed max-w-xs mx-auto">
            Plataforma de análise de dados operacionais da aviação civil brasileira
          </p>

          <div className="mt-10 grid grid-cols-3 gap-4 text-center">
            {[
              { label: "Análises", value: "IA" },
              { label: "Segurança", value: "100%" },
              { label: "Relatórios", value: "PDF" },
            ].map((item) => (
              <div key={item.label} className="bg-white/5 border border-white/10 rounded-xl p-3">
                <p className="text-white font-bold text-lg">{item.value}</p>
                <p className="text-blue-200/50 text-xs mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Painel direito — formulário */}
      <div className="flex-1 bg-gray-50 flex flex-col items-center justify-center px-6 py-12">
        {/* Logo mobile */}
        <div className="lg:hidden flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-[#003A70] rounded-xl flex items-center justify-center p-1.5">
            <Image src="/anac-logo.png" alt="ANAC" width={28} height={28} className="object-contain" />
          </div>
          <span className="text-[#003A70] font-bold text-lg">ANAC Data Insight</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Bem-vindo de volta</h1>
            <p className="text-gray-500 text-sm mt-1">Entre com suas credenciais institucionais</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Campo usuário */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Usuário</label>
              <div
                className={`flex items-center gap-3 bg-white border-2 rounded-xl px-4 py-3 transition-all duration-200 ${
                  focused === "username"
                    ? "border-[#003A70] shadow-[0_0_0_3px_rgba(0,58,112,0.12)]"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <User
                  className={`w-4 h-4 flex-shrink-0 transition-colors ${
                    focused === "username" ? "text-[#003A70]" : "text-gray-400"
                  }`}
                />
                <input
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={() => setFocused("username")}
                  onBlur={() => setFocused(null)}
                  className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
                  placeholder="seu.usuario"
                  required
                />
              </div>
            </div>

            {/* Campo senha */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Senha</label>
              <div
                className={`flex items-center gap-3 bg-white border-2 rounded-xl px-4 py-3 transition-all duration-200 ${
                  focused === "password"
                    ? "border-[#003A70] shadow-[0_0_0_3px_rgba(0,58,112,0.12)]"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <KeyRound
                  className={`w-4 h-4 flex-shrink-0 transition-colors ${
                    focused === "password" ? "text-[#003A70]" : "text-gray-400"
                  }`}
                />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocused("password")}
                  onBlur={() => setFocused(null)}
                  className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Erro */}
            {error && (
              <div className="flex items-center gap-2.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Botão */}
            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#003A70] hover:bg-[#002550] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl transition-all duration-150 shadow-md shadow-blue-900/20"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Autenticando..." : "Entrar na plataforma"}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-8">
            Agência Nacional de Aviação Civil · Uso interno restrito
          </p>
        </div>
      </div>
    </div>
  );
}
