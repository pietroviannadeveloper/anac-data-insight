/**
 * Fundo fixo com rotas aéreas sutis, compartilhado por todas as páginas.
 * Puramente decorativo — fica atrás de todo o conteúdo.
 */
export default function SkyBackdrop() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden>
      <div className="absolute -top-48 -left-48 w-[520px] h-[520px] bg-blue-500/[0.06] rounded-full blur-3xl" />
      <div className="absolute bottom-0 -right-48 w-[560px] h-[560px] bg-indigo-500/[0.05] rounded-full blur-3xl" />
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1000 600"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <path
          d="M -40 480 C 220 320, 520 300, 1040 140"
          stroke="rgba(147,197,253,0.07)"
          strokeWidth="1.5"
          strokeDasharray="6 10"
          className="animate-route-dash"
        />
        <path
          d="M -40 200 C 300 120, 600 260, 1040 420"
          stroke="rgba(147,197,253,0.05)"
          strokeWidth="1.5"
          strokeDasharray="6 10"
          className="animate-route-dash [animation-duration:16s]"
        />
        <path
          d="M 120 640 C 340 420, 700 180, 980 -40"
          stroke="rgba(165,180,252,0.06)"
          strokeWidth="1.5"
          strokeDasharray="6 10"
          className="animate-route-dash [animation-duration:20s]"
        />
      </svg>
    </div>
  );
}
