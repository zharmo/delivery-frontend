// components/ui.tsx
//
// The pieces every driver screen is built from.
// Used one-handed, outdoors, often in sunlight: main buttons are 54px
// tall, text never goes below 11px, and the important number on a screen
// (the cash to collect) is the biggest thing on it.
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertCircle, ArrowLeft, Bell, Check, CheckCircle2, Loader2, Navigation, PackageOpen, Phone, RefreshCw, Truck, User, X,
} from "lucide-react";
import { initials, mapsHref, telHref } from "@/lib/format";
import { useUnread } from "./useUnread";

/* ── layout ─────────────────────────────────────────────────────────── */

export function Page({ children, className = "", bottom = "nav" }: { children: React.ReactNode; className?: string; bottom?: "nav" | "bar" | "none" }) {
  const pad = bottom === "nav" ? "pb-28" : bottom === "bar" ? "pb-40" : "pb-8";
  return <div className={`flex flex-col gap-3.5 px-4 pt-3 ${pad} ${className}`}>{children}</div>;
}

/** The top of each main tab: logo, title, bell and profile. */
export function TopBar({ title, kicker = "BAKHAAR" }: { title: string; kicker?: string }) {
  const unread = useUnread();
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 bg-surface-page/95 px-4 pb-2 pt-4 backdrop-blur">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white">
        <Truck size={19} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold tracking-[0.12em] text-ink-faint">{kicker}</div>
        <h1 className="truncate text-[18px] font-extrabold leading-tight text-ink">{title}</h1>
      </div>
      <Link href="/notifications" aria-label="Notifications" className="relative flex h-10 w-10 items-center justify-center rounded-full text-ink-soft active:bg-white">
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-extrabold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Link>
      <Link href="/profile" aria-label="Profile" className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-white">
        <User size={17} />
      </Link>
    </header>
  );
}

/** The top of a detail screen: back arrow, title, a status badge. */
export function BackBar({
  title, kicker, href, badge, right,
}: { title: string; kicker?: string; href?: string; badge?: React.ReactNode; right?: React.ReactNode }) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-30 flex items-center gap-2.5 bg-surface-page/95 px-3 pb-2 pt-3.5 backdrop-blur">
      <button
        onClick={() => (href ? router.push(href) : router.back())}
        aria-label="Back"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink active:bg-white"
      >
        <ArrowLeft size={21} />
      </button>
      <div className="min-w-0 flex-1">
        {kicker && <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-faint">{kicker}</div>}
        <h1 className="truncate text-[17px] font-extrabold leading-tight text-ink">{title}</h1>
      </div>
      {badge}
      {right}
    </header>
  );
}

/** A bar that sits at the bottom of the screen, above the phone's home bar. */
export function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="pb-safe fixed bottom-0 left-1/2 z-40 w-full max-w-[480px] -translate-x-1/2 border-t border-line bg-white/95 px-4 pt-3 shadow-float backdrop-blur">
      {children}
    </div>
  );
}

/* ── surfaces ───────────────────────────────────────────────────────── */

export function Card({ children, className = "", onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`rounded-[22px] bg-white p-4 shadow-card ${className}`}>
      {children}
    </div>
  );
}

/** Small uppercase label above a group. */
export function Label({ children, right, className = "" }: { children: React.ReactNode; right?: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center justify-between gap-2 ${className}`}>
      <div className="text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-ink-muted">{children}</div>
      {right}
    </div>
  );
}

type Tone = "brand" | "accent" | "danger" | "violet" | "muted" | "blue";
const PILL: Record<Tone, string> = {
  brand: "bg-brand-light text-brand-tint",
  accent: "bg-accent-light text-accent-tint",
  danger: "bg-danger-light text-danger",
  violet: "bg-violet-light text-violet-tint",
  muted: "bg-surface-sunken text-ink-muted",
  blue: "bg-[#EEF0FA] text-[#3F51B5]",
};
export function Pill({ tone = "muted", dot, children, className = "" }: { tone?: Tone; dot?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[10.5px] font-extrabold ${PILL[tone]} ${className}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/** A pill coloured by its own bg / fg (from a status style table). */
export function StatusPill({ style, dot = true }: { style: { label: string; bg: string; fg: string }; dot?: boolean }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[10.5px] font-extrabold" style={{ background: style.bg, color: style.fg }}>
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: style.fg }} />}
      {style.label}
    </span>
  );
}

export function Avatar({ name, size = 44, className = "", dark }: { name: string | null | undefined; size?: number; className?: string; dark?: boolean }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-extrabold ${dark ? "bg-brand text-white" : "bg-brand-light text-brand"} ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {initials(name)}
    </div>
  );
}

/** A coloured round icon. */
export function IconBubble({ icon: Icon, tone = "brand", size = 40 }: { icon: React.ElementType; tone?: Tone; size?: number }) {
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-2xl ${PILL[tone]}`} style={{ width: size, height: size }}>
      <Icon size={size * 0.45} />
    </div>
  );
}

export function Progress({ value, tone = "brand" }: { value: number; tone?: "brand" | "violet" | "accent" }) {
  const c = tone === "violet" ? "bg-violet" : tone === "accent" ? "bg-accent" : "bg-brand";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-line">
      <div className={`h-full rounded-full ${c} transition-all`} style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} />
    </div>
  );
}

/** A small number box, e.g. "5 Delivered". */
export function MiniStat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-surface-sunken px-1 py-2.5">
      <div className="text-[17px] font-extrabold leading-none text-ink">{value}</div>
      <div className="mt-1 text-[10.5px] font-semibold text-ink-muted">{label}</div>
    </div>
  );
}

/* ── buttons ────────────────────────────────────────────────────────── */

type Variant = "primary" | "secondary" | "danger" | "danger-soft" | "violet" | "accent" | "ghost" | "outline";
const BTN: Record<Variant, string> = {
  primary: "bg-brand text-white active:bg-brand-deep",
  secondary: "bg-[#EBEDF2] text-ink active:bg-line",
  danger: "bg-danger text-white active:bg-danger-deep",
  "danger-soft": "bg-danger-light text-danger active:bg-danger-soft",
  violet: "bg-violet text-white active:bg-violet-tint",
  accent: "bg-accent text-white active:bg-accent-tint",
  ghost: "bg-transparent text-ink-soft active:bg-surface-sunken",
  outline: "border border-line bg-white text-ink active:bg-surface-sunken",
};

export function Button({
  children, onClick, href, variant = "primary", size = "lg", loading, disabled, icon: Icon, iconRight: IconRight, className = "", type = "button", external,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: Variant;
  size?: "lg" | "md" | "sm";
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ElementType;
  iconRight?: React.ElementType;
  className?: string;
  type?: "button" | "submit";
  external?: boolean;
}) {
  const h = size === "lg" ? "min-h-[54px] text-[15px] rounded-2xl px-5" : size === "md" ? "min-h-[46px] text-[13.5px] rounded-2xl px-4" : "min-h-[36px] text-[12px] rounded-xl px-3";
  const cls = `inline-flex items-center justify-center gap-2 font-extrabold transition-colors disabled:opacity-45 ${h} ${BTN[variant]} ${
    disabled || loading ? "pointer-events-none opacity-45" : ""
  } ${className}`;
  const inner = (
    <>
      {loading ? <Loader2 size={size === "sm" ? 14 : 18} className="animate-spin" /> : Icon ? <Icon size={size === "sm" ? 14 : 18} /> : null}
      <span className="truncate">{children}</span>
      {IconRight && !loading && <IconRight size={size === "sm" ? 14 : 18} />}
    </>
  );
  if (href) {
    if (external || /^(tel:|https?:)/.test(href)) {
      return (
        <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className={cls}>
          {inner}
        </a>
      );
    }
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading} className={cls}>
      {inner}
    </button>
  );
}

/** Call / Navigate — the two buttons every customer and shop card has. */
export function CallNav({
  phone, place, callLabel = "Call", navLabel = "Navigate", primary = "nav", size = "md",
}: { phone?: string | null; place?: (string | null | undefined)[]; callLabel?: string; navLabel?: string; primary?: "call" | "nav"; size?: "md" | "sm" }) {
  const tel = telHref(phone);
  const map = place ? mapsHref(...place) : undefined;
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {tel ? (
        <Button href={tel} size={size} variant={primary === "call" ? "primary" : "secondary"} icon={Phone}>
          {callLabel}
        </Button>
      ) : (
        <Button size={size} variant="secondary" icon={Phone} disabled>
          No phone
        </Button>
      )}
      {map ? (
        <Button href={map} size={size} variant={primary === "nav" ? "primary" : "secondary"} icon={Navigation}>
          {navLabel}
        </Button>
      ) : (
        <Button size={size} variant="secondary" icon={Navigation} disabled>
          No address
        </Button>
      )}
    </div>
  );
}

/* ── forms ──────────────────────────────────────────────────────────── */

export const INPUT =
  "w-full rounded-2xl border border-transparent bg-surface-sunken px-4 py-3.5 text-[14.5px] font-semibold text-ink outline-none placeholder:font-medium placeholder:text-ink-faint focus:border-brand focus:bg-white";

/** A big tick box row: "I have $19.00 in my hand". */
export function CheckRow({
  checked, onChange, title, sub, tone = "brand",
}: { checked: boolean; onChange: (v: boolean) => void; title: React.ReactNode; sub?: React.ReactNode; tone?: "brand" | "violet" }) {
  const on = tone === "violet" ? "border-violet bg-violet text-white" : "border-brand bg-brand text-white";
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex w-full items-start gap-3 rounded-2xl border-2 p-3.5 text-left transition-colors ${
        checked ? (tone === "violet" ? "border-violet bg-violet-light/60" : "border-brand bg-brand-light/70") : "border-line bg-white"
      }`}
    >
      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 ${checked ? on : "border-ink-faint/50 bg-white"}`}>
        {checked && <Check size={15} strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-extrabold leading-snug text-ink">{title}</span>
        {sub && <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-muted">{sub}</span>}
      </span>
    </button>
  );
}

/** One choice in a list of reasons. */
export function ChoiceRow({
  selected, onClick, icon: Icon, title, sub, tag, tone = "brand",
}: { selected: boolean; onClick: () => void; icon?: React.ElementType; title: string; sub?: string; tag?: React.ReactNode; tone?: "brand" | "danger" }) {
  const sel = tone === "danger" ? "border-danger bg-danger-light/50" : "border-brand bg-brand-light/60";
  const dot = tone === "danger" ? "border-danger" : "border-brand";
  const fill = tone === "danger" ? "bg-danger" : "bg-brand";
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 rounded-2xl border-2 px-3.5 py-3 text-left ${selected ? sel : "border-line bg-white"}`}>
      {Icon && (
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${selected ? "bg-white" : "bg-surface-sunken"} text-ink-soft`}>
          <Icon size={17} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-[13.5px] font-extrabold text-ink">{title}</span>
          {tag}
        </span>
        {sub && <span className="block text-[11.5px] text-ink-muted">{sub}</span>}
      </span>
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${selected ? dot : "border-ink-faint/40"}`}>
        {selected && <span className={`h-2.5 w-2.5 rounded-full ${fill}`} />}
      </span>
    </button>
  );
}

/* ── states ─────────────────────────────────────────────────────────── */

export function FullLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-ink-muted">
      <Loader2 className="h-7 w-7 animate-spin text-brand" />
      <p className="text-[13px] font-semibold">{label}</p>
    </div>
  );
}

export function Skeleton({ rows = 3, height = 120 }: { rows?: number; height?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-[22px] bg-white p-4 shadow-card" style={{ height }}>
          <div className="h-3 w-1/3 rounded bg-line" />
          <div className="mt-3 h-3 w-2/3 rounded bg-line" />
          <div className="mt-3 h-3 w-1/2 rounded bg-line" />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="flex flex-col items-center px-6 py-10 text-center">
      <IconBubble icon={AlertCircle} tone="danger" size={52} />
      <p className="mt-3 text-[15px] font-extrabold text-ink">Couldn&apos;t load this</p>
      <p className="mt-1 max-w-[300px] text-[12.5px] leading-relaxed text-ink-muted">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="md" icon={RefreshCw} className="mt-4">
          Try again
        </Button>
      )}
    </Card>
  );
}

export function EmptyState({
  icon = PackageOpen, title, text, action, tone = "brand",
}: { icon?: React.ElementType; title: string; text: string; action?: React.ReactNode; tone?: Tone }) {
  return (
    <div className="flex flex-col items-center rounded-[22px] bg-white/70 px-6 py-10 text-center">
      <IconBubble icon={icon} tone={tone} size={60} />
      <p className="mt-4 text-[16px] font-extrabold text-ink">{title}</p>
      <p className="mt-1 max-w-[300px] text-[12.5px] leading-relaxed text-ink-muted">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ── overlays ───────────────────────────────────────────────────────── */

/** A sheet that slides up from the bottom. */
export function Sheet({
  open, onClose, title, subtitle, children, footer,
}: { open: boolean; onClose: () => void; title: string; subtitle?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45" onClick={onClose}>
      <div className="animate-sheet flex max-h-[92vh] w-full max-w-[480px] flex-col rounded-t-[28px] bg-white" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-line" />
        <div className="flex items-start gap-3 px-5 pb-2 pt-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-[19px] font-extrabold leading-tight text-ink">{title}</h3>
            {subtitle && <div className="mt-1 text-[12.5px] leading-snug text-ink-muted">{subtitle}</div>}
          </div>
          <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-ink-muted">
            <X size={17} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="pb-safe border-t border-line px-5 pt-3">{footer}</div>}
      </div>
    </div>
  );
}

/** A short message at the top of the screen. */
export function Toast({ message, tone = "brand", onDone }: { message: string | null; tone?: "brand" | "danger"; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [message, onDone]);
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed left-1/2 top-3 z-[60] w-full max-w-[480px] -translate-x-1/2 px-4">
      <div className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-[13px] font-bold text-white shadow-lg ${tone === "danger" ? "bg-danger" : "bg-brand"}`}>
        {tone === "danger" ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}
        {message}
      </div>
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState<{ message: string; tone: "brand" | "danger" } | null>(null);
  return {
    show: (message: string, tone: "brand" | "danger" = "brand") => setToast({ message, tone }),
    node: <Toast message={toast?.message ?? null} tone={toast?.tone} onDone={() => setToast(null)} />,
  };
}

/** A red line under a form or above a button. */
export function InlineError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 rounded-2xl bg-danger-light px-3.5 py-3 text-[12.5px] font-bold leading-snug text-danger">
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      {message}
    </div>
  );
}
