// app/(app)/earnings/page.tsx — My Money.
//
// Two different things, never mixed:
//   OWED TO YOU    your pay (a share of each delivery fee + return pickups),
//                  minus what the office already paid you
//   CASH TO HAND IN customers' cash you took at the door, minus what you
//                  already handed to the office
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Banknote, CheckCircle2, ChevronRight, CircleDollarSign, Info, Landmark, RotateCcw, Send, Truck, Wallet } from "lucide-react";
import { useAsync } from "@/lib/driver";
import { getEarnings, type LedgerEntry } from "@/lib/pickups";
import { dateTime, dayHeading, dayKey, money, timeOf, toDate } from "@/lib/format";
import { Card, EmptyState, ErrorState, Page, Skeleton, TopBar } from "@/components/ui";

type Filter = "all" | "earned" | "cash" | "paid";

export default function MoneyPage() {
  const { data, loading, error, reload } = useAsync(getEarnings, []);
  const [filter, setFilter] = useState<Filter>("all");

  const week = useMemo(() => {
    const days: { key: string; label: string; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() - i);
      days.push({ key: dayKey(d), label: i === 0 ? "Today" : d.toLocaleDateString("en-GB", { weekday: "short" }), total: 0 });
    }
    for (const l of data?.ledger ?? []) {
      if (l.kind !== "earned") continue;
      const d = toDate(l.at);
      if (!d) continue;
      const slot = days.find((x) => x.key === dayKey(d));
      if (slot) slot.total += l.amount;
    }
    return days;
  }, [data]);

  const groups = useMemo(() => {
    const rows = (data?.ledger ?? []).filter((l) =>
      filter === "all" ? true : filter === "earned" ? l.kind === "earned" : filter === "cash" ? l.kind === "cash_collected" || l.kind === "cash_handed" : l.kind === "paid"
    );
    const map = new Map<string, LedgerEntry[]>();
    for (const r of rows) {
      const d = toDate(r.at);
      const k = d ? dayKey(d) : "unknown";
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return Array.from(map.entries());
  }, [data, filter]);

  return (
    <>
      <TopBar title="My Money" kicker="BAKHAAR · WALLET & CASH" />
      <Page>
        {loading && !data ? (
          <Skeleton rows={3} height={150} />
        ) : error && !data ? (
          <ErrorState message={error} onRetry={reload} />
        ) : data ? (
          <>
            <div className="flex items-center gap-2.5 rounded-2xl bg-brand-mint px-3.5 py-2.5">
              <Info size={16} className="shrink-0 text-brand" />
              <p className="text-[12px] font-bold leading-snug text-brand">
                You earn {data.payPercent}% of each delivery fee{data.pickupPay ? ` + ${money(data.pickupPay)} per return pickup` : ""}.
              </p>
            </div>

            {/* owed to you */}
            <div className="rounded-[24px] bg-gradient-to-br from-brand to-brand-deep p-4 text-white shadow-card">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-white/65">
                  <Wallet size={14} /> Owed to you
                </span>
              </div>
              <p className="mt-1 text-[40px] font-extrabold leading-tight">{money(data.pay.owed)}</p>
              <p className="flex items-center gap-1.5 text-[11.5px] text-white/70">
                <CheckCircle2 size={13} /> {data.pay.lastPaidAt ? `Last paid ${dateTime(data.pay.lastPaidAt)}` : "The office hasn't paid you yet"}
              </p>
              <div className="mt-3.5 grid grid-cols-3 gap-2">
                {[
                  ["Today", data.pay.today],
                  ["This week", data.pay.week],
                  ["This month", data.pay.month],
                ].map(([l, v]) => (
                  <div key={l as string} className="rounded-2xl bg-white/10 px-3 py-2.5">
                    <p className="text-[10.5px] font-bold text-white/65">{l}</p>
                    <p className="text-[16px] font-extrabold">{money(v as number)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* cash to hand in */}
            <div className="rounded-[24px] bg-accent-light p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-deep">
                  <Banknote size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-extrabold text-ink">Cash to hand in</p>
                  <p className="text-[11.5px] text-ink-muted">Customers&apos; cash you hold</p>
                </div>
                {data.cash.toHandOver > 0 && <span className="rounded-full bg-accent px-2.5 py-1 text-[10.5px] font-extrabold text-white">Hand in today</span>}
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
                <span className="text-[34px] font-extrabold leading-none text-accent-deep">{money(data.cash.toHandOver)}</span>
                <span className="pb-1 text-[11.5px] font-semibold text-ink-muted">
                  Taken {money(data.cash.collected)} · Handed {money(data.cash.handed)}
                </span>
              </div>
              {data.cash.oldestUnhandedAt && (
                <p className="mt-2 text-[11.5px] font-semibold text-accent-tint">Oldest cash from {dateTime(data.cash.oldestUnhandedAt)}</p>
              )}
              <button
                onClick={() => setFilter("cash")}
                className="mt-3 flex w-full items-center gap-2 rounded-2xl bg-white px-3.5 py-3 text-[13px] font-extrabold text-ink"
              >
                <Landmark size={16} /> Handovers and receipts <ArrowRight size={16} className="ml-auto" />
              </button>
            </div>

            {/* last 7 days */}
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[16px] font-extrabold text-ink">Last 7 days</p>
                  <p className="text-[11.5px] text-ink-muted">What you earned each day</p>
                </div>
                <p className="text-right text-[11px] font-bold text-ink-muted">
                  TOTAL <span className="block text-[18px] font-extrabold text-ink">{money(week.reduce((t, d) => t + d.total, 0))}</span>
                </p>
              </div>
              <WeekBars days={week} />
            </Card>

            {/* ledger */}
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
              {(
                [
                  ["all", "All"],
                  ["earned", "Earned"],
                  ["cash", "Cash"],
                  ["paid", "Payouts"],
                ] as [Filter, string][]
              ).map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={`shrink-0 rounded-full px-4 py-2 text-[12.5px] font-bold ${filter === k ? "bg-brand text-white" : "bg-white text-ink-soft shadow-card"}`}
                >
                  {l}
                </button>
              ))}
            </div>

            {groups.length === 0 ? (
              <EmptyState icon={CircleDollarSign} title="Nothing here yet" text="Delivered trips, cash and payouts show here as they happen." />
            ) : (
              groups.map(([key, rows]) => (
                <div key={key} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-muted">{key === "unknown" ? "Earlier" : dayHeading(key)}</span>
                    <span className="text-[11px] font-bold text-ink-faint">
                      {rows.length} item{rows.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="overflow-hidden rounded-[22px] bg-white shadow-card">
                    {rows.map((r, i) => (
                      <LedgerRow key={`${r.kind}-${r.ref ?? r.label}-${i}`} r={r} first={i === 0} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </>
        ) : null}
      </Page>
    </>
  );
}

function WeekBars({ days }: { days: { key: string; label: string; total: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.total));
  return (
    <div className="mt-4 flex h-40 items-end gap-2" role="img" aria-label="Earnings for the last 7 days">
      {days.map((d, i) => {
        const today = i === days.length - 1;
        const h = Math.max(6, (d.total / max) * 100);
        return (
          <div key={d.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${d.label}: ${money(d.total)}`}>
            <span className="text-[10px] font-bold text-ink-muted">{d.total > 0 ? `$${d.total.toFixed(1)}` : ""}</span>
            <div className={`w-full rounded-t-lg rounded-b-sm ${today ? "bg-brand" : "bg-line"}`} style={{ height: `${h}%` }} />
            <span className={`text-[10.5px] font-bold ${today ? "text-brand" : "text-ink-muted"}`}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function LedgerRow({ r, first }: { r: LedgerEntry; first: boolean }) {
  const isPickup = r.kind === "earned" && /^Return pickup/i.test(r.label);
  const conf = {
    earned: isPickup
      ? { icon: RotateCcw, bg: "bg-violet-light text-violet", title: r.label, sign: "+", color: "text-violet-tint", tag: "Return pay" }
      : { icon: Truck, bg: "bg-brand-light text-brand", title: `Delivery ${r.label}`, sign: "+", color: "text-brand-tint", tag: r.note ? "Refused trip" : "Earned" },
    cash_collected: /\(delivery fee, refused\)/.test(r.label)
      ? { icon: CircleDollarSign, bg: "bg-accent-light text-accent-tint", title: `Delivery fee ${r.label.replace(/\s*\(delivery fee, refused\)/, "")}`, sign: "+", color: "text-accent-deep", tag: "Refused · in hand" }
      : { icon: CircleDollarSign, bg: "bg-accent-light text-accent-tint", title: `Cash taken ${r.label}`, sign: "+", color: "text-accent-deep", tag: "In your hands" },
    cash_handed: { icon: Landmark, bg: "bg-surface-sunken text-ink-soft", title: "Handed to the office", sign: "−", color: "text-ink", tag: "Receipt" },
    paid: { icon: Send, bg: "bg-violet-light text-violet", title: "Paid to you", sign: "", color: "text-violet-tint", tag: "Sent to you" },
  }[r.kind];
  const sub = [r.by, r.note && r.kind !== "earned" ? r.note : null, timeOf(r.at)].filter(Boolean).join(" · ");
  const body = (
    <div className={`flex items-center gap-3 px-4 py-3.5 ${first ? "" : "border-t border-line"}`}>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${conf.bg}`}>
        <conf.icon size={19} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-extrabold text-ink">{conf.title}</p>
        <p className="truncate text-[11.5px] text-ink-muted">{sub}</p>
      </div>
      <div className="text-right">
        <p className={`text-[16px] font-extrabold ${conf.color}`}>
          {conf.sign}
          {money(r.amount)}
        </p>
        <p className="text-[10.5px] font-bold text-ink-faint">{conf.tag}</p>
      </div>
      {r.kind === "cash_handed" && r.ref && <ChevronRight size={16} className="shrink-0 text-ink-faint" />}
    </div>
  );
  return r.kind === "cash_handed" && r.ref ? <Link href={`/earnings/handover/${r.ref}`}>{body}</Link> : body;
}
