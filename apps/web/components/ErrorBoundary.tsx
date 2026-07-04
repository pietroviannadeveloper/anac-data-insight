"use client";

import React from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || "Erro desconhecido" };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  override render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex flex-col min-h-screen bg-[#00112b] items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
          </div>

          <h1 className="text-xl font-bold text-white mb-2">Algo deu errado</h1>
          <p className="text-blue-200/40 text-sm leading-relaxed mb-2">
            Ocorreu um erro inesperado nesta página.
          </p>
          {this.state.message && (
            <p className="text-red-400/60 text-xs font-mono bg-red-500/5 border border-red-500/15 rounded-lg px-3 py-2 mb-6 break-all">
              {this.state.message}
            </p>
          )}

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => this.setState({ hasError: false, message: "" })}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-400/25 text-blue-300 text-sm font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Tentar novamente
            </button>
            <a
              href="/"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 text-sm font-medium transition-colors"
            >
              <Home className="w-4 h-4" />
              Início
            </a>
          </div>
        </div>
      </div>
    );
  }
}
