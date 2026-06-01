const TOKEN_COOKIE = "anac_token";
const ROLE_COOKIE = "anac_role";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function deleteCookie(name: string): void {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
}

export const auth = {
  // Used only by api.ts for backward-compat Bearer header (cookie also sent via credentials:include)
  getToken: (): string | null => {
    if (typeof window === "undefined") return null;
    // anac_token is httpOnly — cannot be read by JS. Return null intentionally.
    // All API calls rely on credentials: "include" to send the cookie automatically.
    return null;
  },

  isAuthenticated: (): boolean => {
    // Presence of the role cookie is the proxy indicator since anac_token is httpOnly
    return !!getCookie(ROLE_COOKIE);
  },

  getRole: (): string => {
    return getCookie(ROLE_COOKIE) || "viewer";
  },

  isAdmin: (): boolean => {
    return auth.getRole() === "admin";
  },

  isAnalystOrAdmin: (): boolean => {
    return ["admin", "analyst"].includes(auth.getRole());
  },

  clearSession: (): void => {
    // Only clears the readable role cookie; anac_token (httpOnly) is cleared by backend logout
    deleteCookie(ROLE_COOKIE);
    deleteCookie(TOKEN_COOKIE); // in case non-httpOnly token still exists from old sessions
  },

  // No-op kept for legacy calls
  setToken: (_token: string): void => {},
  setRole: (_role: string): void => {},
};
