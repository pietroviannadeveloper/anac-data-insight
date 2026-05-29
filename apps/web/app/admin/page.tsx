"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/layout/AppHeader";
import AppFooter from "@/components/layout/AppFooter";
import {
  Users, ShieldCheck, Loader2, AlertCircle, Plus, X, CheckCircle,
  XCircle, KeyRound, Trash2, RefreshCw, Eye, EyeOff, ChevronLeft,
  ChevronRight, LogIn, LogOut,
} from "lucide-react";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "usuarios" | "acessos";

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
        </div>

        {activeTab === "usuarios" && <UsuariosTab />}
        {activeTab === "acessos" && <AcessosTab />}
      </main>
      <AppFooter />
    </div>
  );
}
