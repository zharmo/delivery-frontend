// lib/api.ts
//
// One thin wrapper around fetch for the whole delivery app, matching the
// Bakhaar backend's `{ success, data, message }` envelope and its AppError
// responses. Same shape as the main frontend's lib/api/client.ts, so the
// two behave identically.
"use client";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api/v1";

const TOKEN_KEY = "bakhaar_delivery_token";

// SECURITY (Phase 3): the real sign-in token is an HttpOnly cookie set by the
// backend. localStorage only keeps the word "cookie" so the app can tell
// "signed in" without holding anything secret. Real tokens an older version
// saved are removed, so the driver signs in once more.
export const COOKIE_MARKER = "cookie";
const CSRF_COOKIE = "bk_csrf";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

if (typeof window !== "undefined") {
  try {
    const old = window.localStorage.getItem(TOKEN_KEY);
    if (old && old !== COOKIE_MARKER) window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

function readCsrfCookie(): string | null {
  try {
    const m = document.cookie.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${CSRF_COOKIE}=`));
    return m ? decodeURIComponent(m.slice(CSRF_COOKIE.length + 1)) : null;
  } catch {
    return null;
  }
}

/** The secret CSRF number: from the cookie, or asked from the server (which also sets the cookie). */
export async function getCsrf(forceNew = false): Promise<string | null> {
  if (!forceNew) {
    const c = readCsrfCookie();
    if (c) return c;
  }
  try {
    const r = await fetch(`${API_BASE}/auth/csrf`, { credentials: "include", cache: "no-store" });
    const j = await r.json();
    return (j?.data?.csrfToken as string | undefined) ?? readCsrfCookie();
  } catch {
    return null;
  }
}

/** Tell the server to clear the sign-in cookie. Best effort. */
export function serverLogout() {
  void fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "delivery" }),
  }).catch(() => undefined);
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(_token: string) {
  try {
    window.localStorage.setItem(TOKEN_KEY, COOKIE_MARKER);
  } catch {
    /* private mode — the session just won't survive a reload */
  }
}

export function clearToken() {
  serverLogout();
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

const PAUSED_KEY = "bakhaar_delivery_paused";

/** The office paused this account (remembered so the login page can explain). */
export function markPaused() {
  try {
    window.localStorage.setItem(PAUSED_KEY, "1");
  } catch {
    /* ignore */
  }
}
export function clearPaused() {
  try {
    window.localStorage.removeItem(PAUSED_KEY);
  } catch {
    /* ignore */
  }
}
export function isPaused() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PAUSED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Thrown for any non-2xx response, carrying the backend's own message. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const unsafe = !SAFE_METHODS.has(method);

  const send = async (csrf: string | null) =>
    fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: "include", // the sign-in cookie
      headers: {
        "Content-Type": "application/json",
        ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        ...(init.headers ?? {}),
      },
    });

  let res: Response;
  try {
    res = await send(unsafe ? await getCsrf() : null);
    // The security number was old or missing: fetch a fresh one and try once more.
    if (unsafe && res.status === 403 && res.headers.get("X-CSRF") === "failed") {
      const fresh = await getCsrf(true);
      if (fresh) res = await send(fresh);
    }
  } catch {
    // fetch() throws for a dead network AND for a CORS block — the browser
    // deliberately won't tell them apart. Saying only "check your internet"
    // sends someone hunting a wifi problem when the real cause is the
    // backend not allowing this app's origin, so name both.
    throw new ApiError(
      `Could not reach the Bakhaar server at ${API_BASE}. Check that the backend is running, ` +
        `and that it allows requests from this app (CORS_ORIGIN must include ${
          typeof window !== "undefined" ? window.location.origin : "http://localhost:3001"
        }).`,
      0
    );
  }

  let body: { success?: boolean; data?: T; message?: string } = {};
  try {
    body = await res.json();
  } catch {
    /* some errors have no body */
  }

  if (!res.ok || body.success === false) {
    // 401 means the session died — get out of the way and re-login.
    if (res.status === 401) {
      clearToken();
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    // 403 "suspended": the office paused this driver — show the paused screen.
    if (res.status === 403 && /suspended/i.test(body.message ?? "")) {
      markPaused();
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/paused")) {
        window.location.href = "/paused";
      }
    }
    throw new ApiError(body.message || `Request failed (${res.status})`, res.status);
  }

  return body.data as T;
}