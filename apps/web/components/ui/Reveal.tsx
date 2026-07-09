"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Só monta o conteúdo quando ele entra na viewport, com fade-up no container.
 * Assim as animações de entrada (ex.: gráficos Recharts) rodam na frente do
 * usuário em vez de dispararem no carregamento da página, fora da tela.
 */
export function Reveal({
  height,
  className = "",
  children,
}: {
  /** Altura reservada antes do conteúdo montar, para não deslocar o layout. */
  height: number;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ minHeight: height }}
      className={`transition-all duration-700 ease-out ${
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      } ${className}`}
    >
      {inView && children}
    </div>
  );
}
