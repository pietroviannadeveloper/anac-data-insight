"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Script from "next/script";
import anacLogo from "@/images/anac-logo.png";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";
import { Loader2, AlertCircle, Eye, EyeOff, User, KeyRound } from "lucide-react";
import { toast } from "sonner";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, string>) => void;
        };
      };
    };
  }
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState<"username" | "password" | null>(null);
  const googleButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (auth.isAuthenticated()) {
      router.replace(searchParams.get("redirect") || "/");
    }
    // Exibe aviso se a sessão expirou em outra página
    try {
      if (sessionStorage.getItem("anac_session_expired") === "1") {
        sessionStorage.removeItem("anac_session_expired");
        toast.warning("Sua sessão expirou. Faça login novamente.");
      }
    } catch {}
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

  const handleGoogleCredential = useCallback(
    async (response: { credential: string }) => {
      setGoogleLoading(true);
      setError(null);
      try {
        await api.loginWithGoogle(response.credential);
        router.replace(searchParams.get("redirect") || "/");
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Não foi possível entrar com o Google.");
        setGoogleLoading(false);
      }
    },
    [router, searchParams]
  );

  const handleGoogleScriptLoad = () => {
    if (!GOOGLE_CLIENT_ID || !window.google || !googleButtonRef.current) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
    });
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: "filled_black",
      size: "large",
      width: "384",
      text: "continue_with",
      locale: "pt-BR",
    });
  };

  return (
    <div className="min-h-screen flex bg-[#001f3f]">
      {/* Painel esquerdo — decorativo */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center overflow-hidden border-r border-white/10">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-blue-500/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-blue-700/10 rounded-full blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative z-10 text-center px-14">
          {/* Logo em container branco para contrastar */}
          <div className="w-28 h-28 bg-white rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-black/40 p-3">
            <Image
              src={anacLogo}
              alt="ANAC"
              width={88}
              height={88}
              className="object-contain"
            />
          </div>
          <h2 className="text-4xl font-bold text-white mb-4 tracking-tight">
            ANAC Data Insight
          </h2>
          <p className="text-blue-200/70 text-lg leading-relaxed max-w-sm mx-auto">
            Plataforma de análise de dados operacionais da aviação civil brasileira
          </p>

          <div className="mt-12 grid grid-cols-3 gap-4">
            {[
              { label: "Análise IA", value: "Smart" },
              { label: "Segurança", value: "100%" },
              { label: "Relatórios", value: "PDF" },
            ].map((item) => (
              <div key={item.label} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <p className="text-white font-bold text-xl">{item.value}</p>
                <p className="text-blue-300/60 text-sm mt-1">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Painel direito — formulário, mesmo tema escuro */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Logo mobile */}
        <div className="lg:hidden flex flex-col items-center gap-4 mb-10">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center p-2 shadow-xl">
            <Image src={anacLogo} alt="ANAC" width={52} height={52} className="object-contain" />
          </div>
          <span className="text-white font-bold text-xl">ANAC Data Insight</span>
        </div>

        <div className="w-full max-w-md">
          <div className="mb-10">
            <h1 className="text-3xl font-bold text-white mb-2">Bem-vindo de volta</h1>
            <p className="text-blue-200/60 text-base">Entre com suas credenciais institucionais</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Campo usuário */}
            <div>
              <label className="block text-sm font-semibold text-blue-100/80 mb-2">
                Usuário
              </label>
              <div
                className={`flex items-center gap-3 border-2 rounded-xl px-4 py-3.5 transition-all duration-200 ${
                  focused === "username"
                    ? "border-blue-400 bg-white/10 shadow-[0_0_0_3px_rgba(96,165,250,0.15)]"
                    : "border-white/15 bg-white/5 hover:border-white/25 hover:bg-white/8"
                }`}
              >
                <User
                  className={`w-5 h-5 flex-shrink-0 transition-colors ${
                    focused === "username" ? "text-blue-400" : "text-white/40"
                  }`}
                />
                <input
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={() => setFocused("username")}
                  onBlur={() => setFocused(null)}
                  className="flex-1 bg-transparent text-base text-white placeholder-white/30 outline-none"
                  placeholder="seu.usuario"
                  required
                />
              </div>
            </div>

            {/* Campo senha */}
            <div>
              <label className="block text-sm font-semibold text-blue-100/80 mb-2">
                Senha
              </label>
              <div
                className={`flex items-center gap-3 border-2 rounded-xl px-4 py-3.5 transition-all duration-200 ${
                  focused === "password"
                    ? "border-blue-400 bg-white/10 shadow-[0_0_0_3px_rgba(96,165,250,0.15)]"
                    : "border-white/15 bg-white/5 hover:border-white/25 hover:bg-white/8"
                }`}
              >
                <KeyRound
                  className={`w-5 h-5 flex-shrink-0 transition-colors ${
                    focused === "password" ? "text-blue-400" : "text-white/40"
                  }`}
                />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocused("password")}
                  onBlur={() => setFocused(null)}
                  className="flex-1 bg-transparent text-base text-white placeholder-white/30 outline-none"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-white/30 hover:text-white/70 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Erro */}
            {error && (
              <div className="flex items-center gap-3 text-sm text-red-300 bg-red-500/10 border border-red-400/30 rounded-xl px-4 py-3.5">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-base">{error}</span>
              </div>
            )}

            {/* Botão */}
            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full flex items-center justify-center gap-2 py-4 bg-blue-500 hover:bg-blue-400 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold text-base rounded-xl transition-all duration-150 shadow-lg shadow-blue-500/25 mt-2"
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              {loading ? "Autenticando..." : "Entrar na plataforma"}
            </button>
          </form>

          {GOOGLE_CLIENT_ID && (
            <>
              <div className="flex items-center gap-4 mt-8">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-sm text-blue-200/40">ou</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <div className="mt-6 flex justify-center">
                {googleLoading ? (
                  <div className="flex items-center gap-2 text-blue-200/60 text-sm py-3">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Autenticando com o Google...
                  </div>
                ) : (
                  <div ref={googleButtonRef} />
                )}
              </div>

              <Script
                src="https://accounts.google.com/gsi/client"
                strategy="afterInteractive"
                onLoad={handleGoogleScriptLoad}
              />
            </>
          )}

          <p className="text-center text-sm text-blue-200/30 mt-10">
            Agência Nacional de Aviação Civil · Uso interno restrito
          </p>
        </div>
      </div>
    </div>
  );
}
