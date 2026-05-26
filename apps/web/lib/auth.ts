const TOKEN_COOKIE = "anac_token";

function setCookie(name: string, value: string, hours: number): void {
  const expires = new Date(Date.now() + hours * 36e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Strict`;
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function deleteCookie(name: string): void {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
}

export const auth = {
  getToken: (): string | null => {
    if (typeof window === "undefined") return null;
    return getCookie(TOKEN_COOKIE);
  },

  setToken: (token: string): void => {
    setCookie(TOKEN_COOKIE, token, 8); // 8 horas
  },

  clearToken: (): void => {
    deleteCookie(TOKEN_COOKIE);
  },

  isAuthenticated: (): boolean => {
    return !!auth.getToken();
  },
};
