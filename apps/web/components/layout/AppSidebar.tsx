"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  BarChart2,
  RefreshCcw,
  FileText,
  FileScan,
  Bot,
  Settings,
  ShieldCheck,
  LogOut,
  ListChecks,
  Presentation,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";

export default function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsAdmin(auth.isAdmin());
  }, []);

  function handleLogout() {
    api.logout();
  }

  function navClass(href: string) {
    const active = pathname === href || pathname.startsWith(href + "/");
    return cn(
      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
      active ? "bg-[#003A70] text-white" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
    );
  }

  return (
    <aside className="w-60 min-h-screen bg-white border-r border-gray-200 flex flex-col">
      <nav className="flex-1 px-3 py-4 space-y-1">
        <Link href="/dashboard" className={navClass("/dashboard")}>
          <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
          Dashboard
        </Link>
        <Link href="/upload" className={navClass("/upload")}>
          <Upload className="w-4 h-4 flex-shrink-0" />
          Upload
        </Link>
        <Link href="/analises" className={navClass("/analises")}>
          <BarChart2 className="w-4 h-4 flex-shrink-0" />
          Análises
        </Link>
        <Link href="/ciclos" className={navClass("/ciclos")}>
          <RefreshCcw className="w-4 h-4 flex-shrink-0" />
          Ciclos
        </Link>
        <Link href="/pendencias" className={navClass("/pendencias")}>
          <ListChecks className="w-4 h-4 flex-shrink-0" />
          Pendências
        </Link>
        <Link href="/briefing" className={navClass("/briefing")}>
          <Presentation className="w-4 h-4 flex-shrink-0" />
          Briefing
        </Link>
        <Link href="/documentos" className={navClass("/documentos")}>
          <FileScan className="w-4 h-4 flex-shrink-0" />
          Documentos PDF
        </Link>
        <Link href="/relatorios" className={navClass("/relatorios")}>
          <FileText className="w-4 h-4 flex-shrink-0" />
          Relatórios
        </Link>
        <Link href="/chat" className={navClass("/chat")}>
          <Bot className="w-4 h-4 flex-shrink-0" />
          Chat IA
        </Link>

        {isAdmin && (
          <Link href="/admin" className={navClass("/admin")}>
            <ShieldCheck className="w-4 h-4 flex-shrink-0" />
            Administração
          </Link>
        )}

        <Link href="/configuracoes" className={navClass("/configuracoes")}>
          <Settings className="w-4 h-4 flex-shrink-0" />
          Configurações
        </Link>
      </nav>

      <div className="px-3 pb-3 border-t border-gray-100 pt-3">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          Sair da conta
        </button>
        <p className="px-3 text-xs text-gray-400 pt-2">v0.1.0 — MVP</p>
      </div>
    </aside>
  );
}
