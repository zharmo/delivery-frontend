// components/ui.tsx
//
// The shared pieces every delivery screen is built from.
//
// Sizing note: this is used one-handed, outdoors, often in sunlight and
// sometimes in a hurry. Primary buttons are 56px tall, text doesn't go below
// 12px, and the important number on a screen (the cash to collect) is the
// biggest thing on it.
"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertCircle, CheckCircle2, Loader2, PackageX, RefreshCw, X } from "lucide-react";
import { STATUS_STYLE } from "@/lib/deliveries";

/* ── money & time ───────────────────────────────────────────────────── */

export const money = (v: number) =>
  `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function timeOf(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function dateTime(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* ── card ───────────────────────────────────────────────────────────── */

export function Card({
  children,
  className = "",
  title,
  icon,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl bg-white p-4 shadow-[0_4px_14px_rgba(16,24,32,0.05)] ${className}`}>
      {title && (
        <div className="mb-3 flex items-center gap-1.5">
          {icon}
          <h2 className="text-[13.5px] font-extrabold text-ink">{title}</h2>
        </div>
      )}
      {children}
    </div>
  );
}

/* ── status badge ───────────────────────────────────────────────────── */

export function StatusBadge({ status, large = false }: { status: string; large?: boolean }) {
  const style = STATUS_STYLE[status] ?? { label: status, bg: "#F0F1F6", fg: "#6B7280" };
  return (
    <span
      className={`inline-block shrink-0 rounded-full font-extrabold ${
        large ? "px-4 py-2 text-[13px]" : "px-2.5 py-1 text-[10.5px]"
      }`}
      style={{ background: style.bg, color: style.fg }}
    >
      {style.label}
    </span>
  );
}

/* ── buttons ────────────────────────────────────────────────────────── */

type ButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  loading?: boolean;
  tone?: "primary" | "secondary" | "danger" | "ghost";
  className?: string;
  type?: "button" | "submit";
};

export function Button({
  children,
  onClick,
  href,
  disabled,
  loading,
  tone = "primary",
  className = "",
  type = "button",
}: ButtonProps) {
  const tones: Record<string, string> = {
    primary: "bg-brand text-white active:bg-brand/90",
    secondary: "border border-line bg-white text-brand active:bg-surface-sunken",
    danger: "border border-[#F4C7C2] bg-white text-[#C4362A] active:bg-[#FDEAEA]",
    ghost: "text-ink-muted active:bg-surface-sunken",
  };
  const base = `flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-bold transition-colors disabled:opacity-50 ${tones[tone]} ${className}`;

  if (href && !disabled) {
    return (
      <Link href={href} className={base}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading} className={base}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

/* ── states ─────────────────────────────────────────────────────────── */

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <Loader2 className="h-6 w-6 animate-spin text-brand" />
      <p className="text-[13px] font-semibold text-ink-faint">{label}</p>
    </div>
  );
}

/** Skeleton rows — shown while a list loads, so the page doesn't jump. */
export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-2xl bg-white p-4 shadow-[0_4px_14px_rgba(16,24,32,0.05)]">
          <div className="mb-3 flex items-center justify-between">
            <div className="h-3.5 w-24 rounded bg-line" />
            <div className="h-5 w-20 rounded-full bg-line" />
          </div>
          <div className="mb-2 h-3 w-40 rounded bg-line-soft" />
          <div className="h-3 w-28 rounded bg-line-soft" />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-white py-12 text-center shadow-[0_4px_14px_rgba(16,24,32,0.05)]">
      <AlertCircle className="h-7 w-7 text-[#C4362A]" />
      <p className="px-6 text-[13px] font-semibold text-ink">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 flex items-center gap-1.5 rounded-xl border border-line px-4 py-2.5 text-[12.5px] font-bold text-brand"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Try Again
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  icon,
}: {
  title: string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl bg-white py-14 text-center shadow-[0_4px_14px_rgba(16,24,32,0.05)]">
      {icon ?? <PackageX className="h-7 w-7 text-ink-faint" />}
      <p className="text-[13.5px] font-bold text-ink">{title}</p>
      {hint && <p className="max-w-[280px] px-6 text-[12px] leading-[1.6] text-ink-muted">{hint}</p>}
    </div>
  );
}

/* ── toast ──────────────────────────────────────────────────────────── */

export function Toast({
  tone,
  message,
  onClose,
}: {
  tone: "success" | "error";
  message: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  const good = tone === "success";
  return (
    <div className="fixed inset-x-3 bottom-[84px] z-50 md:left-auto md:right-6 md:w-[360px]">
      <div
        className="flex items-start gap-2.5 rounded-2xl p-3.5 shadow-[0_10px_30px_rgba(16,24,32,0.18)]"
        style={{ background: good ? "#EAF7EE" : "#FDEAEA" }}
      >
        {good ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#2C6B44]" />
        ) : (
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#C4362A]" />
        )}
        <p className="flex-1 text-[12.5px] font-semibold leading-[1.5]" style={{ color: good ? "#2C6B44" : "#C4362A" }}>
          {message}
        </p>
        <button onClick={onClose} aria-label="Dismiss">
          <X className="h-3.5 w-3.5" style={{ color: good ? "#2C6B44" : "#C4362A" }} />
        </button>
      </div>
    </div>
  );
}

/* ── confirm dialog ─────────────────────────────────────────────────── */

/**
 * Used before anything that can't be undone. A rider tapping while walking
 * shouldn't be one stray touch away from marking an order delivered.
 */
export function ConfirmSheet({
  open,
  title,
  body,
  confirmLabel,
  tone = "primary",
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  tone?: "primary" | "danger";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative w-full max-w-[480px] rounded-t-3xl bg-white p-5 pb-8">
        <h3 className="mb-2 text-[16px] font-extrabold text-ink">{title}</h3>
        <div className="mb-4 text-[13px] leading-[1.6] text-ink-muted">{body}</div>
        <div className="flex flex-col gap-2.5">
          <Button tone={tone} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
          <Button tone="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── page header ────────────────────────────────────────────────────── */

export function PageHeader({
  title,
  subtitle,
  right,
  back,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  back?: string;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        {back && (
          <Link href={back} className="mb-1 inline-block text-[12px] font-bold text-brand">
            ← Back
          </Link>
        )}
        <h1 className="truncate text-[20px] font-extrabold text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[12.5px] text-ink-muted">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

/* ── label / value row ──────────────────────────────────────────────── */

export function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="shrink-0 text-[12.5px] text-ink-muted">{label}</span>
      <span className="text-right text-[12.5px] font-semibold text-ink">{value}</span>
    </div>
  );
}
