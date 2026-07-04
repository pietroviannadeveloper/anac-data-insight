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
  BarChart3,
  FileSpreadsheet,
  Sparkles,
  ShieldCheck,
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

const FEATURES = [
  { icon: BarChart3, label: "Indicadores operacionais em tempo real" },
  { icon: FileSpreadsheet, label: "Análise inteligente de planilhas" },
  { icon: Sparkles, label: "Relatórios e briefings gerados por IA" },
  { icon: ShieldCheck, label: "Governança e auditoria de dados" },
];

/** Esquadrilha de aviões que orbita um ponto e segue o cursor pela tela. */
function PlaneSwarm() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const planes = Array.from(el.children) as HTMLElement[];
    const cx = window.innerWidth * 0.5;
    const cy = window.innerHeight * 0.42;
    const state = planes.map((_, i) => ({
      x: cx,
      y: cy,
      // fase inicial espalhada; metade orbita no sentido contrário
      angle: (i / planes.length) * Math.PI * 2,
      radius: 60 + i * 26,
      speed: (0.45 + (i % 3) * 0.22) * (i % 2 === 0 ? 1 : -1),
    }));
    let target = { x: cx, y: cy };
    const onMove = (e: MouseEvent) => {
      target = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", onMove);

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      for (let i = 0; i < state.length; i++) {
        const s = state[i];
        s.angle += s.speed * dt;
        // órbita elíptica ao redor do alvo, com aproximação suave
        const dx = target.x + Math.cos(s.angle) * s.radius;
        const dy = target.y + Math.sin(s.angle) * s.radius * 0.7;
        const px = s.x;
        const py = s.y;
        s.x += (dx - s.x) * Math.min(1, dt * 3);
        s.y += (dy - s.y) * Math.min(1, dt * 3);
        const heading = (Math.atan2(s.y - py, s.x - px) * 180) / Math.PI;
        // +45° compensa a inclinação nativa do ícone Plane
        planes[i].style.transform = `translate(${s.x}px, ${s.y}px) rotate(${heading + 45}deg)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    el.style.opacity = "1";

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 hidden md:block opacity-0 transition-opacity duration-700"
      aria-hidden
    >
      {[5, 4, 6, 4, 5, 4].map((size, i) => (
        <Plane
          key={i}
          className={`absolute top-0 left-0 will-change-transform ${
            i % 2 === 0 ? "text-blue-200/45" : "text-sky-300/30"
          }`}
          style={{ width: size * 4, height: size * 4, marginLeft: -size * 2, marginTop: -size * 2 }}
        />
      ))}
    </div>
  );
}

/** Céu fotográfico com véu de contraste e esquadrilha interativa. */
function AviationScene() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <Image
        src="/login-sky2.jpg"
        alt=""
        fill
        priority
        quality={95}
        sizes="100vw"
        className="object-cover"
      />
      {/* Véu de leitura — escurece a esquerda (texto) e o topo, deixa o pôr do sol respirar */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#020c1f]/80 via-[#03153a]/40 to-[#03153a]/20" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#020c1f]/45 via-transparent to-[#020c1f]/35" />

      <PlaneSwarm />
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
    <div className="min-h-screen flex relative bg-gradient-to-b from-[#020c1f] via-[#03153a] to-[#0a2a5e]">
      <AviationScene />

      <div className="relative z-10 flex-1 flex items-center justify-center gap-12 xl:gap-20 px-6 lg:px-12 py-12">
      {/* Painel esquerdo — boas-vindas */}
      <div className="hidden lg:block w-full max-w-2xl">
        <div>
          <div
            className="flex items-center gap-4 mb-10 animate-login-item"
            style={{ animationDelay: "0.1s" }}
          >
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center p-2 shadow-2xl shadow-blue-950/60">
              <Image src={anacLogo} alt="ANAC" width={52} height={52} className="object-contain" />
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-tight">ANAC Data Insight</p>
              <p className="text-blue-300/60 text-sm">Agência Nacional de Aviação Civil</p>
            </div>
          </div>

          <h1
            className="text-5xl xl:text-6xl font-bold text-white tracking-tight leading-[1.08] mb-6 animate-login-item text-balance"
            style={{ animationDelay: "0.25s" }}
          >
            Inteligência de dados para a{" "}
            <span className="bg-gradient-to-r from-blue-300 via-sky-300 to-indigo-300 bg-clip-text text-transparent">
              aviação civil
            </span>
          </h1>

          <p
            className="text-blue-200/70 text-lg leading-relaxed mb-12 max-w-lg animate-login-item"
            style={{ animationDelay: "0.4s" }}
          >
            Análise inteligente de dados operacionais, planilhas, relatórios e
            indicadores estratégicos em uma única plataforma.
          </p>

          <ul className="grid grid-cols-2 gap-x-8 gap-y-5">
            {FEATURES.map((f, i) => (
              <li
                key={f.label}
                className="flex items-center gap-3.5 animate-login-item"
                style={{ animationDelay: `${0.55 + i * 0.12}s` }}
              >
                <span className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                  <f.icon className="w-[18px] h-[18px] text-blue-300" />
                </span>
                <span className="text-blue-100/80 text-[15px]">{f.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Painel direito — card de login em glassmorphism */}
      <div className="w-full max-w-md shrink-0">
        <div className="w-full animate-login-card">
          {/* Logo mobile */}
          <div className="lg:hidden flex flex-col items-center gap-4 mb-10">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center p-2 shadow-xl">
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
                    Entrar na plataforma
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
    </div>
  );
}
