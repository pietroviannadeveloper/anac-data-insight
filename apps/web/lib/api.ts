import { auth } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// All requests include credentials so the httpOnly anac_token cookie is sent automatically
const _base: RequestInit = { credentials: "include" };

function handleUnauthorized(): never {
  auth.clearSession();
  window.location.href = "/login";
  throw new Error("Sessão expirada. Faça login novamente.");
}

async function _checkResponse(r: Response): Promise<Response> {
  if (r.status === 401) handleUnauthorized();
  if (!r.ok) {
    let detail = `Erro ${r.status}`;
    try {
      const body = await r.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {}
    throw new Error(detail);
  }
  return r;
}

export const api = {
  get: async (path: string) => {
    const r = await fetch(`${API_BASE}${path}`, { ..._base });
    await _checkResponse(r);
    return r.json();
  },

  post: async (path: string, body: unknown) => {
    const r = await fetch(`${API_BASE}${path}`, {
      ..._base,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await _checkResponse(r);
    return r.json();
  },

  delete: async (path: string) => {
    const r = await fetch(`${API_BASE}${path}`, { ..._base, method: "DELETE" });
    await _checkResponse(r);
  },

  patch: async (path: string, body?: unknown) => {
    const r = await fetch(`${API_BASE}${path}`, {
      ..._base,
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    await _checkResponse(r);
    return r.json();
  },

  deleteWithBody: async (path: string, body: unknown) => {
    const r = await fetch(`${API_BASE}${path}`, {
      ..._base,
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await _checkResponse(r);
    return r.json();
  },

  upload: async (path: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    const r = await fetch(`${API_BASE}${path}`, {
      ..._base,
      method: "POST",
      body: form,
    });
    await _checkResponse(r);
    return r.json();
  },

  login: async (username: string, password: string): Promise<void> => {
    const r = await fetch(`${API_BASE}/api/v1/auth/token`, {
      ..._base,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw new Error(typeof body.detail === "string" ? body.detail : "Credenciais inválidas.");
    }
    // Backend sets httpOnly anac_token + readable anac_role cookies automatically
  },

  logout: async (): Promise<void> => {
    try {
      await fetch(`${API_BASE}/api/v1/auth/logout`, { ..._base, method: "POST" });
    } catch {}
    auth.clearSession();
    window.location.href = "/login";
  },

  // Download helper — returns blob for file downloads
  download: async (path: string): Promise<Blob> => {
    const r = await fetch(`${API_BASE}${path}`, { ..._base });
    await _checkResponse(r);
    return r.blob();
  },
};
