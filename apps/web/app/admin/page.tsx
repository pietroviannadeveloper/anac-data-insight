"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/layout/AppHeader";
import AppFooter from "@/components/layout/AppFooter";
import {
  Users, ShieldCheck, Loader2, AlertCircle, Plus, X, CheckCircle,
  XCircle, KeyRound, Trash2, RefreshCw, Eye, EyeOff, ChevronLeft,
  ChevronRight, LogIn, LogOut, FileText, FileSpreadsheet, User,
  ClipboardList, Download, BookOpen, Pencil, Check,
} from "lucide-react";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "usuarios" | "acessos" | "arquivos" | "auditoria" | "dicionario";

interface AdminUser {
  id: string;
  username: string;
  role: string;
  is_active: boolean;
  created_at: string | null;
  last_login: string | null;
}

interface AccessLog {
  id: string;
  username: string;
  action: "login_success" | "login_failed";
  ip_address: string | null;
  created_at: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (iso: string | null): string => {
  if (!iso) return "—";
  const utc = iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z";
  return new Date(utc).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

// ─── Modal: Novo usuário ──────────────────────────────────────────────────────

const NewUserModal = ({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim()) return setError("O nome de usuário é obrigatório.");
    if (password.length < 6) return setError("A senha deve ter no mínimo 6 caracteres.");
    if (password !== confirm) return setError("As senhas não coincidem.");

    setLoading(true);
    try {
      await api.post("/api/v1/admin/users", { username: username.trim(), password, role });
      onCreated();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao criar usuário.";
      setError(msg.includes("409") ? "Usuário já existe." : "Erro ao criar usuário.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Novo usuário"
    >
      <div className="bg-[#001233] border border-white/15 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">Novo usuário</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-blue-200/50 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-blue-200/60 mb-1.5" htmlFor="nu-username">
              Nome de usuário
            </label>
            <input
              id="nu-username"
              type="text"
              autoComplete="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-blue-400/60 transition-colors"
              placeholder="ex: ana.silva"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-blue-200/60 mb-1.5" htmlFor="nu-password">
              Senha
            </label>
            <div className="relative">
              <input
                id="nu-password"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-blue-400/60 transition-colors"
                placeholder="Mínimo 6 caracteres"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-200/40 hover:text-white transition-colors"
                aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-blue-200/60 mb-1.5" htmlFor="nu-confirm">
              Confirmar senha
            </label>
            <input
              id="nu-confirm"
              type={showPw ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-blue-400/60 transition-colors"
              placeholder="Repita a senha"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-blue-200/60 mb-1.5" htmlFor="nu-role">
              Perfil de acesso
            </label>
            <select
              id="nu-role"
              value={role}
              onChange={(e) => setRole(e.target.value as "user" | "admin")}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-400/60 transition-colors"
            >
              <option value="user" className="bg-[#001233]">Usuário comum</option>
              <option value="admin" className="bg-[#001233]">Administrador</option>
            </select>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-blue-200/70 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#003A70] hover:bg-[#0057A8] rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Criar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Modal: Redefinir senha ───────────────────────────────────────────────────

const ResetPasswordModal = ({
  user,
  onClose,
  onReset,
}: {
  user: AdminUser;
  onClose: () => void;
  onReset: () => void;
}) => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) return setError("A senha deve ter no mínimo 6 caracteres.");
    if (password !== confirm) return setError("As senhas não coincidem.");

    setLoading(true);
    try {
      await api.patch(`/api/v1/admin/users/${user.id}/password`, { password });
      onReset();
      onClose();
    } catch {
      setError("Erro ao redefinir a senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Redefinir senha"
    >
      <div className="bg-[#001233] border border-white/15 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-white">Redefinir senha</h2>
            <p className="text-xs text-blue-200/50 mt-0.5">{user.username}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-blue-200/50 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-blue-200/60 mb-1.5" htmlFor="rp-password">
              Nova senha
            </label>
            <div className="relative">
              <input
                id="rp-password"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-blue-400/60 transition-colors"
                placeholder="Mínimo 6 caracteres"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-200/40 hover:text-white transition-colors"
                aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-blue-200/60 mb-1.5" htmlFor="rp-confirm">
              Confirmar nova senha
            </label>
            <input
              id="rp-confirm"
              type={showPw ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-blue-400/60 transition-colors"
              placeholder="Repita a nova senha"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-blue-200/70 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#003A70] hover:bg-[#0057A8] rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              Redefinir
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Tab: Usuários ────────────────────────────────────────────────────────────

const UsuariosTab = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get("/api/v1/admin/users");
      setUsers(data);
    } catch {
      setError("Não foi possível carregar os usuários.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleToggleStatus = async (user: AdminUser) => {
    setToggling(user.id);
    try {
      await api.patch(`/api/v1/admin/users/${user.id}/status`, {});
      fetchUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error && err.message.includes("400")
        ? "Não é possível desativar o próprio usuário."
        : "Erro ao alterar status.";
      alert(msg);
    } finally {
      setToggling(null);
    }
  };

  const handleDelete = async (user: AdminUser) => {
    if (!confirm(`Deletar o usuário "${user.username}"? Esta ação não pode ser desfeita.`)) return;
    setDeleting(user.id);
    try {
      await api.delete(`/api/v1/admin/users/${user.id}`);
      fetchUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error && err.message.includes("400")
        ? "Não é possível deletar o próprio usuário."
        : "Erro ao deletar usuário.";
      alert(msg);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      {showNewModal && (
        <NewUserModal onClose={() => setShowNewModal(false)} onCreated={fetchUsers} />
      )}
      {resetTarget && (
        <ResetPasswordModal
          user={resetTarget}
          onClose={() => setResetTarget(null)}
          onReset={fetchUsers}
        />
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-blue-200/50">
            {users.length} usuário{users.length !== 1 ? "s" : ""} cadastrado{users.length !== 1 ? "s" : ""}
          </p>
          <div className="flex gap-2">
            <button
              onClick={fetchUsers}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-blue-200/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
              aria-label="Atualizar lista"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#003A70] hover:bg-[#0057A8] rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Novo usuário
            </button>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-blue-200/50">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Carregando usuários...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-red-400">
              <AlertCircle className="w-7 h-7" />
              <p className="text-sm">{error}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-blue-200/50 text-xs uppercase tracking-wide">
                    Usuário
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-blue-200/50 text-xs uppercase tracking-wide">
                    Perfil
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-blue-200/50 text-xs uppercase tracking-wide">
                    Senha
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-blue-200/50 text-xs uppercase tracking-wide">
                    Criado em
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-blue-200/50 text-xs uppercase tracking-wide">
                    Último acesso
                  </th>
                  <th className="text-center px-5 py-3 font-medium text-blue-200/50 text-xs uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-blue-200/40 text-sm">
                      Nenhum usuário cadastrado.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-[#003A70]/80 border border-blue-400/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-blue-300">
                              {user.username[0].toUpperCase()}
                            </span>
                          </div>
                          <span className="font-medium text-white">{user.username}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {user.role === "admin" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium text-blue-300 bg-blue-400/10 border border-blue-400/20">
                            <ShieldCheck className="w-3 h-3" />
                            Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium text-blue-200/50 bg-white/5 border border-white/10">
                            Usuário
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-blue-200/40 tracking-widest text-sm select-none">
                          ••••••••
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-blue-200/50 text-xs whitespace-nowrap">
                        {fmtDate(user.created_at)}
                      </td>
                      <td className="px-5 py-3.5 text-blue-200/50 text-xs whitespace-nowrap">
                        {fmtDate(user.last_login)}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {user.is_active ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium text-emerald-400 bg-emerald-400/10 border border-emerald-400/20">
                            <CheckCircle className="w-3 h-3" />
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium text-red-400 bg-red-400/10 border border-red-400/20">
                            <XCircle className="w-3 h-3" />
                            Inativo
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleStatus(user)}
                            disabled={toggling === user.id}
                            className="p-1.5 rounded-lg text-blue-200/40 hover:text-yellow-300 hover:bg-yellow-400/10 transition-colors disabled:opacity-40"
                            title={user.is_active ? "Desativar usuário" : "Ativar usuário"}
                            aria-label={user.is_active ? "Desativar" : "Ativar"}
                          >
                            {toggling === user.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : user.is_active ? (
                              <XCircle className="w-3.5 h-3.5" />
                            ) : (
                              <CheckCircle className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => setResetTarget(user)}
                            className="p-1.5 rounded-lg text-blue-200/40 hover:text-blue-300 hover:bg-blue-400/10 transition-colors"
                            title="Redefinir senha"
                            aria-label="Redefinir senha"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(user)}
                            disabled={deleting === user.id}
                            className="p-1.5 rounded-lg text-blue-200/40 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
                            title="Deletar usuário"
                            aria-label="Deletar usuário"
                          >
                            {deleting === user.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
};

// ─── Tab: Acessos ─────────────────────────────────────────────────────────────

const AcessosTab = () => {
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterUsername, setFilterUsername] = useState("");
  const [filterAction, setFilterAction] = useState("");

  const perPage = 20;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
        ...(filterUsername && { username: filterUsername }),
        ...(filterAction && { action: filterAction }),
      });
      const data = await api.get(`/api/v1/admin/access-logs?${params}`);
      setLogs(data.items);
      setTotal(data.total);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, filterUsername, filterAction]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Filtrar por usuário..."
          value={filterUsername}
          onChange={(e) => { setFilterUsername(e.target.value); setPage(1); }}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-blue-200/80 placeholder:text-blue-200/30 focus:outline-none focus:border-blue-400/50 w-44"
        />
        <select
          value={filterAction}
          onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-blue-200/80 focus:outline-none focus:border-blue-400/50"
        >
          <option value="">Todas as ações</option>
          <option value="login_success">Login com sucesso</option>
          <option value="login_failed">Login com falha</option>
        </select>
        <div className="flex-1" />
        <button
          onClick={fetchLogs}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-blue-200/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
          aria-label="Atualizar"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs text-blue-200/30">{total} registro{total !== 1 ? "s" : ""}</span>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-blue-200/50">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Carregando logs...</span>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-blue-200/50 text-xs uppercase tracking-wide">
                    Usuário
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-blue-200/50 text-xs uppercase tracking-wide">
                    Ação
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-blue-200/50 text-xs uppercase tracking-wide">
                    Data / hora
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-blue-200/50 text-xs uppercase tracking-wide">
                    IP
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-blue-200/40 text-sm">
                      Nenhum registro encontrado.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-white/8 flex items-center justify-center flex-shrink-0">
                            <span className="text-[10px] font-bold text-blue-200/60">
                              {log.username[0]?.toUpperCase() ?? "?"}
                            </span>
                          </div>
                          <span className="font-medium text-white/80">{log.username}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {log.action === "login_success" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium text-emerald-400 bg-emerald-400/10 border border-emerald-400/20">
                            <LogIn className="w-3 h-3" />
                            Login efetuado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium text-red-400 bg-red-400/10 border border-red-400/20">
                            <LogOut className="w-3 h-3" />
                            Falha no login
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-blue-200/50 text-xs whitespace-nowrap">
                        {fmtDate(log.created_at)}
                      </td>
                      <td className="px-5 py-3.5 text-blue-200/40 font-mono text-xs">
                        {log.ip_address ?? "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-white/10">
                <p className="text-xs text-blue-200/40">
                  {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} de {total}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg text-blue-200/50 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-30 transition-colors"
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-blue-200/50 min-w-[4rem] text-center">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg text-blue-200/50 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-30 transition-colors"
                    aria-label="Próxima página"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ─── Tab: Arquivos ────────────────────────────────────────────────────────────

interface AdminAnalysis {
  id: string;
  original_filename: string;
  file_type: string;
  detected_type: string;
  status: string;
  total_rows: number;
  description?: string;
  tags?: string[];
  created_by?: string;
  created_by_role?: string;
  created_at: string | null;
  error_message?: string;
}

const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
  admin:   { label: "admin",   cls: "bg-purple-400/15 text-purple-300 border-purple-400/20" },
  analyst: { label: "analyst", cls: "bg-blue-400/15 text-blue-300 border-blue-400/20" },
  viewer:  { label: "viewer",  cls: "bg-white/10 text-white/40 border-white/15" },
};

const TYPE_MAP: Record<string, { label: string; cls: string }> = {
  ciclos:  { label: "Ciclos",    cls: "bg-indigo-400/15 text-indigo-300 border-indigo-400/20" },
  generic: { label: "Genérico",  cls: "bg-teal-400/15 text-teal-300 border-teal-400/20" },
  pdf:     { label: "PDF",       cls: "bg-amber-400/15 text-amber-300 border-amber-400/20" },
  unknown: { label: "?",         cls: "bg-white/8 text-white/30 border-white/10" },
};

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  completed:  { label: "Concluída",   cls: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
  processing: { label: "Processando", cls: "text-blue-300 bg-blue-400/10 border-blue-400/20" },
  error:      { label: "Erro",        cls: "text-red-400 bg-red-400/10 border-red-400/20" },
  pending:    { label: "Pendente",    cls: "text-yellow-300 bg-yellow-400/10 border-yellow-400/20" },
};

const ArquivosTab = () => {
  const [analyses, setAnalyses] = useState<AdminAnalysis[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterUser, setFilterUser] = useState("");
  const [filterType, setFilterType] = useState("");
  const PER_PAGE = 20;

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), per_page: String(PER_PAGE) });
      if (filterType) params.set("detected_type", filterType);
      const data = await api.get(`/api/v1/admin/analyses?${params}`);
      // client-side filter by user since backend doesn't support it yet
      const items: AdminAnalysis[] = filterUser
        ? data.items.filter((a: AdminAnalysis) => (a.created_by ?? "").toLowerCase().includes(filterUser.toLowerCase()))
        : data.items;
      setAnalyses(items);
      setTotal(filterUser ? items.length : data.total);
    } catch {
      setError("Não foi possível carregar o histórico de arquivos.");
    } finally {
      setLoading(false);
    }
  }, [filterUser, filterType]);

  useEffect(() => { load(page); }, [page, load]);
  useEffect(() => { setPage(1); load(1); }, [filterUser, filterType]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input
            value={filterUser}
            onChange={e => setFilterUser(e.target.value)}
            placeholder="Filtrar por usuário..."
            className="pl-8 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-blue-200/80 placeholder-white/25 focus:outline-none focus:border-blue-400/50 w-48"
          />
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-blue-200/80 focus:outline-none focus:border-blue-400/50"
        >
          <option value="">Todos os tipos</option>
          <option value="ciclos">Ciclos</option>
          <option value="generic">Genérico</option>
          <option value="pdf">PDF</option>
        </select>
        {(filterUser || filterType) && (
          <button onClick={() => { setFilterUser(""); setFilterType(""); }}
            className="flex items-center gap-1 px-2.5 py-2 text-xs text-blue-200/60 hover:text-white bg-white/5 border border-white/10 rounded-lg transition-colors">
            <X className="w-3 h-3" /> Limpar
          </button>
        )}
        <span className="text-xs text-blue-200/30 ml-auto">{total} arquivo{total !== 1 ? "s" : ""}</span>
        <a
          href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/admin/analyses/export/zip`}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-300 bg-emerald-400/10 border border-emerald-400/20 rounded-lg hover:bg-emerald-400/20 transition-colors"
          title="Baixar todos os arquivos como ZIP"
        >
          <Download className="w-3.5 h-3.5" />
          Exportar ZIP
        </a>
      </div>

      {/* Table */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-14 gap-2 text-blue-200/50">
            <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Carregando...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-14 gap-2 text-red-400">
            <AlertCircle className="w-5 h-5" /><span className="text-sm">{error}</span>
          </div>
        ) : analyses.length === 0 ? (
          <div className="flex items-center justify-center py-14 text-blue-200/30 text-sm">
            Nenhum arquivo encontrado.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                {["Arquivo", "Tipo", "Status", "Registros", "Criado por", "Data"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-blue-200/60 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {analyses.map(a => {
                const typeInfo  = TYPE_MAP[a.detected_type]   ?? TYPE_MAP.unknown;
                const statusInfo = STATUS_MAP[a.status]       ?? STATUS_MAP.pending;
                const roleInfo  = a.created_by_role ? ROLE_BADGE[a.created_by_role] : null;
                return (
                  <tr key={a.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {a.detected_type === "pdf"
                          ? <FileText className="w-4 h-4 text-amber-300/60 shrink-0" />
                          : <FileSpreadsheet className="w-4 h-4 text-blue-300/50 shrink-0" />}
                        <div className="min-w-0">
                          <a href={`/analises/${a.id}`}
                            className="text-white/90 hover:text-white font-medium truncate block max-w-[220px] transition-colors">
                            {a.original_filename}
                          </a>
                          {a.description && (
                            <p className="text-xs text-blue-200/40 truncate max-w-[220px]">{a.description}</p>
                          )}
                          {a.tags && a.tags.length > 0 && (
                            <div className="flex gap-1 flex-wrap mt-0.5">
                              {a.tags.map(t => (
                                <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-400/10 text-blue-300/70 border border-blue-400/15">{t}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${typeInfo.cls}`}>
                        {typeInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${statusInfo.cls}`}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-blue-200/60 tabular-nums">
                      {a.total_rows.toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      {a.created_by ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs text-blue-200/70">{a.created_by}</span>
                          {roleInfo && (
                            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded border ${roleInfo.cls}`}>
                              <ShieldCheck className="w-2.5 h-2.5" />
                              {roleInfo.label}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-white/20 italic text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-blue-200/50 whitespace-nowrap text-xs">
                      {fmtDate(a.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-blue-200/50">
          <span>Página {page} de {totalPages}</span>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Tab: Auditoria ───────────────────────────────────────────────────────────

interface AuditLog {
  id: string;
  username: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  extra_data: string | null;
  created_at: string | null;
}

const ACTION_COLORS: Record<string, string> = {
  user_created:              "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  user_deleted:              "text-red-400 bg-red-400/10 border-red-400/20",
  user_activated:            "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  user_deactivated:          "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  password_reset:            "text-blue-300 bg-blue-400/10 border-blue-400/20",
  analysis_soft_deleted:     "text-orange-400 bg-orange-400/10 border-orange-400/20",
  analysis_deleted_permanent:"text-red-400 bg-red-400/10 border-red-400/20",
  analysis_restored:         "text-teal-400 bg-teal-400/10 border-teal-400/20",
  bulk_analyses_deleted:     "text-red-400 bg-red-400/10 border-red-400/20",
  analysis_created:          "text-blue-300 bg-blue-400/10 border-blue-400/20",
  excel_exported:            "text-indigo-300 bg-indigo-400/10 border-indigo-400/20",
  pdf_exported:              "text-purple-300 bg-purple-400/10 border-purple-400/20",
};

const ACTION_LABELS: Record<string, string> = {
  user_created:               "Usuário criado",
  user_deleted:               "Usuário excluído",
  user_activated:             "Usuário ativado",
  user_deactivated:           "Usuário desativado",
  password_reset:             "Senha redefinida",
  analysis_soft_deleted:      "Análise movida p/ lixeira",
  analysis_deleted_permanent: "Análise excluída",
  analysis_restored:          "Análise restaurada",
  bulk_analyses_deleted:      "Exclusão em lote",
  analysis_created:           "Análise criada",
  excel_exported:             "Exportação Excel",
  pdf_exported:               "Exportação PDF",
};

const AuditoriaTab = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterUser, setFilterUser] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const perPage = 20;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
        ...(filterUser && { username: filterUser }),
        ...(filterAction && { action: filterAction }),
      });
      const data = await api.get(`/api/v1/admin/audit-logs?${params}`);
      setLogs(data.items);
      setTotal(data.total);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, filterUser, filterAction]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.ceil(total / perPage) || 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Filtrar por usuário..."
          value={filterUser}
          onChange={(e) => { setFilterUser(e.target.value); setPage(1); }}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-blue-200/80 placeholder:text-blue-200/30 focus:outline-none focus:border-blue-400/50 w-44"
        />
        <input
          type="text"
          placeholder="Filtrar por ação..."
          value={filterAction}
          onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-blue-200/80 placeholder:text-blue-200/30 focus:outline-none focus:border-blue-400/50 w-44"
        />
        <div className="flex-1" />
        <button
          onClick={fetchLogs}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-blue-200/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
          aria-label="Atualizar"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs text-blue-200/30">{total} evento{total !== 1 ? "s" : ""}</span>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-blue-200/50">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Carregando auditoria...</span>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  {["Usuário", "Ação", "Entidade", "Detalhes", "Data / hora"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-blue-200/50 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-blue-200/40 text-sm">
                      Nenhum evento registrado.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const cls = ACTION_COLORS[log.action] ?? "text-blue-200/60 bg-white/5 border-white/10";
                    const label = ACTION_LABELS[log.action] ?? log.action;
                    let extra: Record<string, unknown> | null = null;
                    try { if (log.extra_data) extra = JSON.parse(log.extra_data); } catch {}
                    return (
                      <tr key={log.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-white/8 flex items-center justify-center flex-shrink-0">
                              <span className="text-[10px] font-bold text-blue-200/60">
                                {log.username[0]?.toUpperCase() ?? "?"}
                              </span>
                            </div>
                            <span className="font-medium text-white/80 text-xs">{log.username}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
                            {label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-blue-200/50 text-xs">
                          {log.entity_type ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-blue-200/40 font-mono text-xs max-w-[200px] truncate">
                          {extra
                            ? Object.entries(extra).map(([k, v]) => `${k}: ${v}`).join(", ")
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-blue-200/50 text-xs whitespace-nowrap">
                          {fmtDate(log.created_at)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-white/10">
                <p className="text-xs text-blue-200/40">
                  {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} de {total}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg text-blue-200/50 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-30 transition-colors"
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-blue-200/50 min-w-[4rem] text-center">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg text-blue-200/50 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-30 transition-colors"
                    aria-label="Próxima página"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ─── Tab: Dicionário de dados ─────────────────────────────────────────────────

interface DictionaryEntry {
  id: string;
  category: string;
  canonical_value: string;
  aliases: string[];
  active: boolean;
  created_by: string | null;
  created_at: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  gerencia: "Gerência",
  cidade: "Cidade",
  servidor: "Servidor",
  status: "Status",
  categoria_atividade: "Categoria de atividade",
};

const DicionarioTab = () => {
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState("");

  const [newCategory, setNewCategory] = useState("gerencia");
  const [newValue, setNewValue] = useState("");
  const [newAliases, setNewAliases] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editAliases, setEditAliases] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = filterCategory ? `?category=${filterCategory}` : "";
      const data = await api.get(`/api/v1/dictionary${params}`);
      setEntries(data.items);
      setCategories(data.categories);
    } catch {
      setError("Não foi possível carregar o dicionário de dados.");
    } finally {
      setLoading(false);
    }
  }, [filterCategory]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const parseAliases = (raw: string): string[] =>
    raw.split(",").map((a) => a.trim()).filter(Boolean);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!newValue.trim()) { setCreateError("O valor canônico é obrigatório."); return; }
    setCreating(true);
    try {
      await api.post("/api/v1/dictionary", {
        category: newCategory,
        canonical_value: newValue.trim(),
        aliases: parseAliases(newAliases),
      });
      setNewValue("");
      setNewAliases("");
      fetchEntries();
    } catch {
      setCreateError("Erro ao criar entrada.");
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (entry: DictionaryEntry) => {
    setEditingId(entry.id);
    setEditValue(entry.canonical_value);
    setEditAliases(entry.aliases.join(", "));
  };

  const saveEdit = async (id: string) => {
    try {
      await api.patch(`/api/v1/dictionary/${id}`, {
        canonical_value: editValue.trim(),
        aliases: parseAliases(editAliases),
      });
      setEditingId(null);
      fetchEntries();
    } catch {
      alert("Erro ao salvar alterações.");
    }
  };

  const handleDelete = async (entry: DictionaryEntry) => {
    if (!confirm(`Remover "${entry.canonical_value}" do dicionário?`)) return;
    setDeleting(entry.id);
    try {
      await api.delete(`/api/v1/dictionary/${entry.id}`);
      fetchEntries();
    } catch {
      alert("Erro ao remover entrada.");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3 bg-white/5 border border-white/10 rounded-xl p-4">
        <div>
          <label className="block text-xs font-medium text-blue-200/60 mb-1.5">Categoria</label>
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-400/60"
          >
            {(categories.length ? categories : Object.keys(CATEGORY_LABELS)).map((c) => (
              <option key={c} value={c} className="bg-[#001233]">{CATEGORY_LABELS[c] ?? c}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-blue-200/60 mb-1.5">Valor canônico</label>
          <input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="ex: Gerência de Planejamento"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-blue-400/60"
          />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-blue-200/60 mb-1.5">Aliases (separados por vírgula)</label>
          <input
            value={newAliases}
            onChange={(e) => setNewAliases(e.target.value)}
            placeholder="ex: GPA, G. Planejamento"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-blue-400/60"
          />
        </div>
        <button
          type="submit"
          disabled={creating}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#003A70] hover:bg-[#0057A8] rounded-lg transition-colors disabled:opacity-50"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Adicionar
        </button>
        {createError && (
          <p className="w-full text-xs text-red-400">{createError}</p>
        )}
      </form>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-blue-200/80 focus:outline-none focus:border-blue-400/50"
        >
          <option value="">Todas as categorias</option>
          {Object.keys(CATEGORY_LABELS).map((c) => (
            <option key={c} value={c} className="bg-[#001233]">{CATEGORY_LABELS[c]}</option>
          ))}
        </select>
        <div className="flex-1" />
        <button
          onClick={fetchEntries}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-blue-200/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
          aria-label="Atualizar"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs text-blue-200/30">{entries.length} entrada{entries.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-blue-200/50">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Carregando dicionário...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-red-400">
            <AlertCircle className="w-7 h-7" />
            <p className="text-sm">{error}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                {["Categoria", "Valor canônico", "Aliases", "Criado por", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-blue-200/50 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-blue-200/40 text-sm">
                    Nenhuma entrada cadastrada.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-blue-300 bg-blue-400/10 border border-blue-400/20">
                        {CATEGORY_LABELS[entry.category] ?? entry.category}
                      </span>
                    </td>
                    {editingId === entry.id ? (
                      <>
                        <td className="px-4 py-2">
                          <input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-blue-400/60"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            value={editAliases}
                            onChange={(e) => setEditAliases(e.target.value)}
                            placeholder="separados por vírgula"
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-blue-400/60"
                          />
                        </td>
                        <td className="px-4 py-3 text-blue-200/40 text-xs">{entry.created_by ?? "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => saveEdit(entry.id)}
                              className="p-1.5 rounded-lg text-emerald-300 hover:bg-emerald-400/10 transition-colors"
                              title="Salvar"
                              aria-label="Salvar"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1.5 rounded-lg text-blue-200/40 hover:text-white hover:bg-white/10 transition-colors"
                              title="Cancelar"
                              aria-label="Cancelar"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-white/90 font-medium">{entry.canonical_value}</td>
                        <td className="px-4 py-3">
                          {entry.aliases.length > 0 ? (
                            <div className="flex gap-1 flex-wrap">
                              {entry.aliases.map((a) => (
                                <span key={a} className="text-[10px] px-1.5 py-0.5 rounded bg-white/8 text-blue-200/60 border border-white/10">
                                  {a}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-white/20 italic text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-blue-200/40 text-xs">{entry.created_by ?? "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => startEdit(entry)}
                              className="p-1.5 rounded-lg text-blue-200/40 hover:text-blue-300 hover:bg-blue-400/10 transition-colors"
                              title="Editar"
                              aria-label="Editar"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(entry)}
                              disabled={deleting === entry.id}
                              className="p-1.5 rounded-lg text-blue-200/40 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
                              title="Remover"
                              aria-label="Remover"
                            >
                              {deleting === entry.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>("usuarios");
  const router = useRouter();

  useEffect(() => {
    if (!auth.isAdmin()) {
      router.replace("/dashboard");
    }
  }, [router]);

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="flex items-start gap-4 mb-8">
          <div className="p-3 bg-[#003A70]/50 border border-blue-400/20 rounded-xl flex-shrink-0">
            <ShieldCheck className="w-6 h-6 text-blue-300" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Controle de Acesso</h1>
            <p className="text-blue-200/50 text-sm mt-0.5">
              Gerencie usuários e monitore os acessos ao sistema.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white/5 border border-white/10 rounded-xl p-1.5 w-fit">
          <button
            onClick={() => setActiveTab("usuarios")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              activeTab === "usuarios"
                ? "bg-[#003A70] text-white"
                : "text-blue-200/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <Users className="w-4 h-4" />
            Usuários
          </button>
          <button
            onClick={() => setActiveTab("acessos")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              activeTab === "acessos"
                ? "bg-[#003A70] text-white"
                : "text-blue-200/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Histórico de acessos
          </button>
          <button
            onClick={() => setActiveTab("arquivos")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              activeTab === "arquivos"
                ? "bg-[#003A70] text-white"
                : "text-blue-200/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <FileText className="w-4 h-4" />
            Histórico de arquivos
          </button>
          <button
            onClick={() => setActiveTab("auditoria")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              activeTab === "auditoria"
                ? "bg-[#003A70] text-white"
                : "text-blue-200/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Auditoria
          </button>
          <button
            onClick={() => setActiveTab("dicionario")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              activeTab === "dicionario"
                ? "bg-[#003A70] text-white"
                : "text-blue-200/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Dicionário de dados
          </button>
        </div>

        {activeTab === "usuarios" && <UsuariosTab />}
        {activeTab === "acessos" && <AcessosTab />}
        {activeTab === "arquivos" && <ArquivosTab />}
        {activeTab === "auditoria" && <AuditoriaTab />}
        {activeTab === "dicionario" && <DicionarioTab />}
      </main>
      <AppFooter />
    </div>
  );
}
