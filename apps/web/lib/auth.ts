const TOKEN_COOKIE    = "anac_token";
const ROLE_COOKIE     = "anac_role";
const USERNAME_COOKIE = "anac_username";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function deleteCookie(name: string): void {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
}

/** "pietro.rocha" → "Pietro Rocha" */
function formatDisplayName(raw: string): string {
  return raw.replace(/\./g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const auth = {
  getToken: (): string | null => {
    if (typeof window === "undefined") return null;
    return null; // anac_token é httpOnly
  },

  isAuthenticated: (): boolean => {
    return !!getCookie(ROLE_COOKIE);
  },

  getRole: (): string => {
    return getCookie(ROLE_COOKIE) || "viewer";
  },

  getUsername: (): string => {
    return getCookie(USERNAME_COOKIE) || "";
  },

  getDisplayName: (): string => {
    const raw = getCookie(USERNAME_COOKIE) || "";
    return raw ? formatDisplayName(raw) : "";
  },

  isAdmin: (): boolean => {
    return auth.getRole() === "admin";
  },

  isAnalystOrAdmin: (): boolean => {
    return ["admin", "analyst"].includes(auth.getRole());
  },

  clearSession: (): void => {
    deleteCookie(ROLE_COOKIE);
    deleteCookie(TOKEN_COOKIE);
    deleteCookie(USERNAME_COOKIE);
  },

  setToken: (_token: string): void => {},
  setRole: (_role: string): void => {},
};
