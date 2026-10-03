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

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* private mode — the session just won't survive a reload */
  }
}

export function clearToken() {
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
  const token = getToken();

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });
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
