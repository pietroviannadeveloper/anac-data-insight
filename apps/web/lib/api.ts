import { auth } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function authHeaders(): Record<string, string> {
  const token = auth.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function handleUnauthorized(): never {
  auth.clearToken();
  window.location.href = "/login";
  throw new Error("Sessão expirada. Faça login novamente.");
}

export const api = {
  get: (path: string) =>
    fetch(`${API_BASE}${path}`, { headers: authHeaders() }).then((r) => {
      if (r.status === 401) handleUnauthorized();
      if (!r.ok) throw new Error(`API error ${r.status}`);
      return r.json();
    }),

  post: (path: string, body: unknown) =>
    fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    }).then((r) => {
      if (r.status === 401) handleUnauthorized();
      if (!r.ok) throw new Error(`API error ${r.status}`);
      return r.json();
    }),

  delete: async (path: string) => {
    const r = await fetch(`${API_BASE}${path}`, { method: "DELETE", headers: authHeaders() });
    if (r.status === 401) handleUnauthorized();
    if (!r.ok) throw new Error(`Erro ${r.status}`);
  },

  upload: async (path: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    const r = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      body: form,
      headers: authHeaders(),
    });
    if (r.status === 401) handleUnauthorized();
    if (!r.ok) {
      let detail = `Erro ${r.status}`;
      try {
        const body = await r.json();
        detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
      } catch {}
      throw new Error(detail);
    }
    return r.json();
  },

  login: async (username: string, password: string): Promise<void> => {
    const r = await fetch(`${API_BASE}/api/v1/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw new Error(typeof body.detail === "string" ? body.detail : "Credenciais inválidas.");
    }
    const data = await r.json();
    auth.setToken(data.access_token);
  },
};
