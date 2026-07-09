"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Script from "next/script";
import anacLogo from "@/images/anac-logo.png";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";
import {
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  User,
  KeyRound,
  Plane,
} from "lucide-react";
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

type Phase = "form" | "zoom" | "welcome";

/** "pietro.rocha" → "Pietro Rocha" */
const formatName = (login: string): string =>
  login
    .split("@")[0]
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

/** Cena de fundo: vídeo + véu azul-escuro + radar (anéis, mira e varredura). */
function RadarScene({ zooming }: { zooming: boolean }) {
  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none transition-transform duration-[900ms] ease-[cubic-bezier(0.7,0,0.84,0)] ${
        zooming ? "scale-[7]" : "scale-100"
      }`}
      aria-hidden
    >
      <video
        src="/login-video.mp4"
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover scale-[1.22] origin-[30%_40%]"
      />
      {/* ↑ zoom com origem deslocada esconde a marca-d'água do canto inferior direito */}
      {/* Véu de controle de tráfego — azul profundo, mais denso nas bordas */}
      <div className="absolute inset-0 bg-[#020c1f]/55" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_25%,rgba(2,12,31,0.85)_100%)]" />

      {/* Radar centrado atrás do formulário */}
      <div className="absolute inset-0 hidden sm:flex items-center justify-center">
        <div className="relative w-[88vmin] h-[88vmin]">
          {/* Anéis concêntricos */}
          {["inset-0", "inset-[16%]", "inset-[32%]", "inset-[44%]"].map((inset) => (
            <div
              key={inset}
              className={`absolute ${inset} rounded-full border border-sky-400/15 shadow-[0_0_24px_rgba(56,189,248,0.06)]`}
            />
          ))}
          {/* Mira (crosshair) */}
          <div className="absolute left-0 right-0 top-1/2 h-px bg-gradient-to-r from-transparent via-sky-400/20 to-transparent" />
          <div className="absolute top-0 bottom-0 left-1/2 w-px bg-gradient-to-b from-transparent via-sky-400/20 to-transparent" />
          {/* Varredura brilhante */}
          <div className="absolute inset-0 rounded-full animate-radar-sweep bg-[conic-gradient(from_0deg,rgba(56,189,248,0.28),rgba(56,189,248,0.05)_55deg,transparent_70deg)]" />
        </div>
      </div>
    </div>
  );
}

/** Tela pós-login: interior de cabine / painel de controle com HUD. */
function WelcomeCockpit({ name }: { name: string }) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_center,#08234d_0%,#041331_55%,#020c1f_100%)]">
      {/* Linha do horizonte */}
      <div
        className="absolute left-0 right-0 top-1/2 h-px bg-gradient-to-r from-transparent via-sky-400/50 to-transparent animate-welcome-item"
        style={{ animationDelay: "0.15s" }}
      />
      {/* Cantoneiras HUD */}
      <div className="absolute top-8 left-8 w-14 h-14 border-t-2 border-l-2 border-sky-400/30 rounded-tl-lg" />
      <div className="absolute top-8 right-8 w-14 h-14 border-t-2 border-r-2 border-sky-400/30 rounded-tr-lg" />
      <div className="absolute bottom-8 left-8 w-14 h-14 border-b-2 border-l-2 border-sky-400/30 rounded-bl-lg" />
      <div className="absolute bottom-8 right-8 w-14 h-14 border-b-2 border-r-2 border-sky-400/30 rounded-br-lg" />

      {/* Anel HUD central */}
      <div className="relative w-52 h-52 sm:w-60 sm:h-60 mb-10 animate-welcome-item">
        <div className="absolute inset-0 rounded-full border border-sky-400/30 shadow-[0_0_80px_rgba(56,189,248,0.18),inset_0_0_40px_rgba(56,189,248,0.08)]" />
        <div className="absolute inset-4 rounded-full border border-dashed border-sky-400/20 animate-hud-ring" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Plane className="w-14 h-14 text-sky-300 drop-shadow-[0_0_16px_rgba(56,189,248,0.7)]" />
        </div>
      </div>

      <h2
        className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-3 animate-welcome-item text-center px-6"
        style={{ animationDelay: "0.25s" }}
      >
        Bem-vindo, <span className="text-sky-300">{name}</span>
      </h2>
      <p
        className="text-blue-200/60 text-sm sm:text-base mb-10 animate-welcome-item"
        style={{ animationDelay: "0.4s" }}
      >
        Sistemas iniciados — preparando o painel de controle
      </p>

      {/* Barra de progresso HUD */}
      <div
        className="w-64 h-1 rounded-full bg-white/10 overflow-hidden animate-welcome-item"
        style={{ animationDelay: "0.5s" }}
      >
        <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.8)] animate-hud-progress" />
      </div>

      {/* Instrumentos decorativos */}
      <div
        className="absolute bottom-10 flex gap-8 text-[11px] font-mono tracking-widest text-sky-300/50 animate-welcome-item"
        style={{ animationDelay: "0.6s" }}
      >
        <span>ALT 35.000 FT</span>
        <span>HDG 274°</span>
        <span>GS 460 KT</span>
        <span className="text-emerald-400/70">SYS OK</span>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState<"username" | "password" | null>(null);
  const [phase, setPhase] = useState<Phase>("form");
  const [welcomeName, setWelcomeName] = useState("");
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<number[]>([]);

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
    return () => timersRef.current.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Sequência pós-autenticação: zoom no fundo → cabine de boas-vindas → redirect. */
  const startWelcomeSequence = useCallback(
    (fallbackName: string) => {
      const dest = searchParams.get("redirect") || "/";
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        router.replace(dest);
        return;
      }
      setWelcomeName(formatName(auth.getUsername() || fallbackName));
      setPhase("zoom");
      timersRef.current.push(
        window.setTimeout(() => setPhase("welcome"), 950),
        window.setTimeout(() => router.replace(dest), 3400)
      );
    },
    [router, searchParams]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    setError(null);
    try {
      await api.login(username, password);
      startWelcomeSequence(username);
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
        startWelcomeSequence("");
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Não foi possível entrar com o Google.");
        setGoogleLoading(false);
      }
    },
    [startWelcomeSequence]
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
    <div className="min-h-screen flex relative overflow-hidden bg-gradient-to-b from-[#020c1f] via-[#03153a] to-[#0a2a5e]">
      <RadarScene zooming={phase !== "form"} />

      {/* Flash central durante o warp */}
      {phase === "zoom" && (
        <div className="absolute inset-0 z-20 pointer-events-none animate-login-flash bg-[radial-gradient(circle_at_center,rgba(125,211,252,0.95)_0%,rgba(56,189,248,0.4)_30%,rgba(2,12,31,0)_65%)]" />
      )}

      {phase === "welcome" && <WelcomeCockpit name={welcomeName} />}

      {/* Formulário centralizado */}
      <div
        className={`relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12 transition-all duration-500 ease-in ${
          phase === "form" ? "opacity-100 scale-100" : "opacity-0 scale-90 blur-sm pointer-events-none"
        }`}
      >
        <div className="w-full max-w-md animate-login-card">
          {/* Identidade */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center p-2 shadow-2xl shadow-blue-950/60">
              <Image src={anacLogo} alt="ANAC" width={52} height={52} className="object-contain" />
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-xl">ANAC Data Insight</p>
              <p className="text-blue-300/60 text-sm mt-1">
                Inteligência de dados para a aviação civil
              </p>
            </div>
          </div>

          <div className="glass-card rounded-3xl p-8 sm:p-10">
            <div className="mb-9">
              <h2 className="text-[26px] font-bold text-white mb-1.5 tracking-tight">
                Bem-vindo a bordo
              </h2>
              <p className="text-blue-200/60 text-[15px]">
                Entre com suas credenciais institucionais
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Campo usuário */}
              <div>
                <label className="block text-sm font-semibold text-blue-100/80 mb-2">
                  Usuário
                </label>
                <div
                  className={`flex items-center gap-3 border rounded-xl px-4 py-3.5 transition-all duration-200 ${
                    focused === "username"
                      ? "border-blue-400/80 bg-white/10 shadow-[0_0_0_3px_rgba(96,165,250,0.18)]"
                      : "border-white/15 bg-white/5 hover:border-white/30 hover:bg-white/8"
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
                    className="flex-1 min-w-0 bg-transparent text-base text-white placeholder-white/30 outline-none"
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
                  className={`flex items-center gap-3 border rounded-xl px-4 py-3.5 transition-all duration-200 ${
                    focused === "password"
                      ? "border-blue-400/80 bg-white/10 shadow-[0_0_0_3px_rgba(96,165,250,0.18)]"
                      : "border-white/15 bg-white/5 hover:border-white/30 hover:bg-white/8"
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
                    className="flex-1 min-w-0 bg-transparent text-base text-white placeholder-white/30 outline-none"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="text-white/30 hover:text-white/70 transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Erro */}
              {error && (
                <div className="flex items-center gap-3 text-sm text-red-300 bg-red-500/10 border border-red-400/30 rounded-xl px-4 py-3.5 animate-login-item">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-base">{error}</span>
                </div>
              )}

              {/* Botão */}
              <button
                type="submit"
                disabled={loading || !username || !password}
                className="group relative w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100 text-white font-bold text-base rounded-xl transition-all duration-200 shadow-lg shadow-blue-600/30 hover:shadow-blue-500/40 hover:-translate-y-px mt-2 overflow-hidden"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Autenticando...
                  </>
                ) : (
                  <>
                    Entrar
                    <Plane className="w-[18px] h-[18px] transition-transform duration-300 group-hover:translate-x-1.5 group-hover:-translate-y-0.5" />
                  </>
                )}
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
          </div>

          <p className="text-center text-sm text-blue-200/30 mt-8">
            Agência Nacional de Aviação Civil · Uso interno restrito
          </p>
        </div>
      </div>
    </div>
  );
}
