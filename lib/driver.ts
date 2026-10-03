// lib/driver.ts
//
// The driver: signing in and out, their profile, their duty status
// (online / busy / offline), their password and their notifications.
"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, setToken, clearToken, clearPaused, ApiError } from "./api";

/* ── types ──────────────────────────────────────────────────────────── */

export type DutyStatus = "ACTIVE" | "BUSY" | "OFFLINE";

export interface DriverProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  profileImage: string | null;
  /** ACTIVE (online), BUSY, OFFLINE — or SUSPENDED (paused by the office). */
  status: string;
  vehicleType: string | null;
  vehicleNumber: string | null;
  assignedLocation: string | null;
  joinedAt: string;
  editableFields: string[];
}

export interface Session {
  token: string;
  user: { id: string; name: string; email: string };
  driver: { id: string; status: string };
}

export interface DriverNotification {
  id: string;
  /** trip · taken · office · pickup · paid · cash */
  kind: string;
  title: string;
  body: string | null;
  at: string;
  link: string | null;
}

export const VEHICLES: { value: string; label: string; hint: string }[] = [
  { value: "motorbike", label: "Motorbike", hint: "Most trips" },
  { value: "car", label: "Car / Van", hint: "Big and heavy items" },
  { value: "bicycle", label: "Bicycle", hint: "Small parcels, short trips" },
  { value: "on foot", label: "On foot", hint: "Market area only" },
];

export const DUTY: Record<DutyStatus, { label: string; help: string }> = {
  ACTIVE: { label: "Online", help: "The office can give you trips." },
  BUSY: { label: "Busy", help: "You're working — no new trips for now." },
  OFFLINE: { label: "Offline", help: "You're off duty — no trips." },
};

/* ── auth ───────────────────────────────────────────────────────────── */

const USER_KEY = "bakhaar_delivery_user";

export async function login(email: string, password: string): Promise<Session> {
  const data = await apiFetch<Session>("/delivery/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setToken(data.token);
  clearPaused();
  try {
    window.localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  } catch {
    /* ignore */
  }
  return data;
}

export function logout() {
  clearToken();
  try {
    window.localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
  window.location.href = "/login";
}

export function storedUser(): { id: string; name: string; email: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/* ── profile ────────────────────────────────────────────────────────── */

export const getProfile = () => apiFetch<DriverProfile>("/delivery/profile");

export const updateProfile = (body: { phone?: string; vehicleType?: string; vehicleNumber?: string }) =>
  apiFetch<DriverProfile>("/delivery/profile", { method: "PATCH", body: JSON.stringify(body) });

export const setAvailability = (status: DutyStatus) =>
  apiFetch<{ status: string }>("/delivery/availability", { method: "PATCH", body: JSON.stringify({ status }) });

export const changePassword = (currentPassword: string, newPassword: string) =>
  apiFetch<{ changed: boolean }>("/delivery/password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });

/* ── notifications ──────────────────────────────────────────────────── */

export const getNotifications = () => apiFetch<DriverNotification[]>("/delivery/ops/notifications");

const SEEN_KEY = "bakhaar_delivery_notif_seen";

/** When the driver last opened the notifications page. */
export function lastSeen(): number {
  try {
    return Number(window.localStorage.getItem(SEEN_KEY) || 0);
  } catch {
    return 0;
  }
}
export function markSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, String(Date.now()));
    window.dispatchEvent(new Event("bakhaar-notif-seen"));
  } catch {
    /* ignore */
  }
}

/** Sound / vibrate / reminders — saved on this phone only. */
export interface NotifPrefs {
  newTrip: boolean;
  pickups: boolean;
  office: boolean;
  money: boolean;
  sound: boolean;
  vibrate: boolean;
}
const PREFS_KEY = "bakhaar_delivery_notif_prefs";
export const DEFAULT_PREFS: NotifPrefs = { newTrip: true, pickups: true, office: true, money: true, sound: true, vibrate: true };

export function readPrefs(): NotifPrefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}
export function savePrefs(p: NotifPrefs) {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

/** Which notification kinds a setting covers. */
export const PREF_KINDS: Record<string, keyof NotifPrefs> = {
  trip: "newTrip",
  taken: "newTrip",
  office: "office",
  pickup: "pickups",
  paid: "money",
  cash: "money",
};

/* ── a tiny data hook ───────────────────────────────────────────────── */

/** loading / error (with retry) / data — the three states every screen needs. */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loader()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Something went wrong");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => run(), [run]);

  /** Reload without flashing the loading state. */
  const refresh = useCallback(() => {
    loader()
      .then(setData)
      .catch(() => {
        /* keep what is on screen */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, reload: run, refresh, setData };
}

export const errorText = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong — try again");
