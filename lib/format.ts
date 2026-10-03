// lib/format.ts
//
// Money, dates and links — one place, so every screen says them the same way.

/** "$12.50" */
export const money = (v: number | null | undefined) =>
  `$${Number(v ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Dates from the API come as ISO ("2026-10-02T11:03:11.120Z") or as
 * Postgres text ("2026-10-02 14:03:11.12+03"). Both become a Date here.
 */
export function toDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const s = String(v)
    .replace(" ", "T")
    .replace(/\.(\d{3})\d+/, ".$1")
    .replace(/([+-]\d\d)$/, "$1:00");
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "11:44 AM" */
export function timeOf(v: string | null | undefined) {
  const d = toDate(v);
  return d ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
}

/** "3 Oct, 11:44 AM" */
export function dateTime(v: string | null | undefined) {
  const d = toDate(v);
  return d
    ? `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
    : "—";
}

/** "Sun 4 Oct, 10:00 AM" */
export function longDateTime(v: string | null | undefined) {
  const d = toDate(v);
  return d
    ? `${d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
    : "—";
}

/** "Sat 3 Oct" */
export function todayLabel(d = new Date()) {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/** Local day key, "2026-10-03". */
export function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isToday(v: string | null | undefined) {
  const d = toDate(v);
  return Boolean(d && dayKey(d) === dayKey(new Date()));
}

/** "TODAY, SAT 3 OCT" / "YESTERDAY, FRI 2 OCT" / "THU 1 OCT" */
export function dayHeading(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const label = date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const today = dayKey(new Date());
  const yest = dayKey(new Date(Date.now() - 86_400_000));
  if (key === today) return `Today, ${label}`;
  if (key === yest) return `Yesterday, ${label}`;
  return label;
}

/** "24m ago", "3h ago", "2d ago" */
export function ago(v: string | null | undefined) {
  const d = toDate(v);
  if (!d) return "";
  const mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** "Good morning" by the phone's clock. */
export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** "Bashir Yusuf" → "BY" */
export function initials(name: string | null | undefined) {
  return (
    String(name ?? "")
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "B"
  );
}

export const firstName = (name: string | null | undefined) => String(name ?? "").split(/\s+/)[0] || "there";

/** tel: link (spaces and dashes removed). */
export const telHref = (phone: string | null | undefined) => (phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : undefined);

/** Opens Google Maps with a search for the address (no GPS needed). */
export function mapsHref(...parts: (string | null | undefined)[]) {
  const q = parts.filter(Boolean).join(", ");
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : undefined;
}

/** "snake_case_reason" → "Snake case reason" */
export function humanize(s: string | null | undefined) {
  if (!s) return "";
  const t = s.replace(/_/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
