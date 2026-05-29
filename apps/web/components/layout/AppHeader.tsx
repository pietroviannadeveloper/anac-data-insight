"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, X, LogOut, ShieldCheck } from "lucide-react";
import { auth } from "@/lib/auth";

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/upload", label: "Upload" },
  { href: "/analises", label: "Análises" },
  { href: "/ciclos", label: "Ciclos" },
  { href: "/relatorios", label: "Relatórios" },
];

export default function AppHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsAdmin(auth.isAdmin());
  }, []);

  function handleLogout() {
    auth.clearToken();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-50 bg-[#003A70] border-b border-[#002550] shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 bg-white rounded flex items-center justify-center flex-shrink-0 p-1">
              <Image
                src="/anac-logo.png"
                alt="ANAC"
                width={36}
                height={36}
                className="object-contain"
              />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight tracking-wide">
                ANAC Data Insight
              </p>
              <p className="text-blue-200 text-xs leading-tight">
                Análise de Dados Operacionais
              </p>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-4 py-2 text-sm font-medium text-blue-100 rounded hover:bg-[#0057A8] hover:text-white transition-colors duration-150"
              >
                {link.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-100 rounded hover:bg-[#0057A8] hover:text-white transition-colors duration-150"
              >
                <ShieldCheck className="w-4 h-4" />
                Admin
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-100 rounded hover:bg-[#0057A8] hover:text-white transition-colors duration-150"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </nav>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded text-blue-100 hover:bg-[#0057A8] hover:text-white transition-colors"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="md:hidden bg-[#002550] border-t border-[#003A70]">
          <nav className="px-4 py-2 flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="px-3 py-2 text-sm font-medium text-blue-100 rounded hover:bg-[#0057A8] hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-100 rounded hover:bg-[#0057A8] hover:text-white transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
                Admin
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-300 rounded hover:bg-[#0057A8] hover:text-white transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sair da conta
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
