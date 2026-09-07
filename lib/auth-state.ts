const AUTH_KEY = "bloc:auth";

export type OfflineAuthState = {
  userId: string;
  authenticated: boolean;
};

export function setOfflineAuth(userId: string) {
  if (typeof window === "undefined") return;
  try {
    const state: OfflineAuthState = { userId, authenticated: true };
    window.localStorage.setItem(AUTH_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("[auth-state] Failed to set offline auth:", e);
  }
}

export function getOfflineAuth(): OfflineAuthState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OfflineAuthState;
    if (parsed && parsed.authenticated && parsed.userId) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function clearOfflineAuth() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(AUTH_KEY);
  } catch {}
}
