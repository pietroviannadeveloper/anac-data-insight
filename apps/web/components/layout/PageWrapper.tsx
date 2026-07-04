"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { AIChat } from "@/components/ui/AIChat";

// Páginas que já possuem seu próprio assistente de IA com contexto específico,
// ou onde o widget flutuante não faz sentido.
const HIDE_GLOBAL_CHAT = ["/login", "/ptamensal", "/pta/historico", "/chat"];

export default function PageWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Força reflow para reiniciar a animação a cada troca de rota
    el.classList.remove("animate-page-in");
    void el.offsetWidth;
    el.classList.add("animate-page-in");
  }, [pathname]);

  return (
    <div ref={ref} className="animate-page-in">
      {children}
      {!HIDE_GLOBAL_CHAT.includes(pathname) && (
        <AIChat pageType="geral" contextData={null} />
      )}
    </div>
  );
}
