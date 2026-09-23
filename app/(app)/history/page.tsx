// app/(app)/history/page.tsx
//
// Finished work: delivered, failed, cancelled and returned. Filtered by
// date on the client, since the history endpoint already returns only this
// driver's own finished trips.
//
// Counted in TRIPS, not parcels — a basket from three shops is one line
// here, the same as it was one journey on the day.
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Ban, CheckCircle2, ChevronRight, History, RotateCcw, XCircle } from "lucide-react";
import { useAsync } from "@/lib/deliveries";
import { getJobHistory, jobStyle, type Job } from "@/lib/jobs";
import {
  Card, EmptyState, ErrorState, PageHeader, SkeletonList, dateTime, money,
} from "@/components/ui";

type RangeKey = "today" | "yesterday" | "week" | "month" | "all";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "all", label: "All" },
];

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "FAILED", label: "Failed" },
  { key: "CANCELLED", label: "Cancelled" },
  { key: "RETURNED", label: "Returned" },
];

/** Start of the period, in the driver's own timezone. */
function rangeStart(key: RangeKey): Date | null {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (key) {
    case "today":
      return midnight;
    case "yesterday":
      return new Date(midnight.getTime() - 86400000);
    case "week": {
      const d = new Date(midnight);
      d.setDate(d.getDate() - d.getDay());
      return d;
    }
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    default:
      return null;
  }
}

export default function HistoryPage() {
  const { data, loading, error, reload } = useAsync(getJobHistory);
  const [range, setRange] = useState<RangeKey>("today");
  const [status, setStatus] = useState("");

  const filtered = useMemo(() => {
    if (!data) return [];
    const start = rangeStart(range);
    const end = range === "yesterday" ? rangeStart("today") : null;

    return data.filter((d: Job) => {
      // Sort by when the trip actually finished, not when it was created.
      const finishedAt = new Date(
        d.timestamps.deliveredAt ?? d.timestamps.returnedAt ?? d.timestamps.cancelledAt ?? d.timestamps.failedAt ?? d.updatedAt
      );
      if (start && finishedAt < start) return false;
      if (end && finishedAt >= end) return false;

      if (status && d.status !== status) return false;
      return true;
    });
  }, [data, range, status]);

  // Only money actually taken: a cash order that was delivered AND paid.
  // A cancelled order collected nothing and must never be counted here.
  const collected = filtered
    .filter((d) => d.status === "DELIVERED" && d.money.isCod && d.money.isPaid)
    .reduce((sum, d) => sum + d.money.orderTotal, 0);
  const deliveredCount = filtered.filter((d) => d.status === "DELIVERED").length;

  return (
    <>
      <PageHeader title="History" subtitle="Your finished trips" />

      {/* Date range */}
      <div className="no-scrollbar -mx-4 mb-2.5 flex gap-2 overflow-x-auto px-4">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2.5 text-[12.5px] font-bold ${
              range === r.key ? "bg-brand text-white" : "border border-line bg-white text-ink-soft"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Outcome */}
      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key || "all"}
            onClick={() => setStatus(t.key)}
            className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-[11.5px] font-bold ${
              status === t.key ? "bg-ink text-white" : "border border-line bg-white text-ink-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <SkeletonList rows={3} />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && (
        <>
          {/* A driver cashing up at the end of a shift wants these two numbers. */}
          {filtered.length > 0 && (
            <Card className="mb-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-brand-light p-3 text-center">
                  <div className="text-[20px] font-extrabold text-brand-tint">{deliveredCount}</div>
                  <div className="text-[10.5px] font-bold text-brand-tint">Delivered</div>
                </div>
                <div className="rounded-xl bg-accent-light p-3 text-center">
                  <div className="text-[20px] font-extrabold text-accent-tint">{money(collected)}</div>
                  <div className="text-[10.5px] font-bold text-accent-tint">Cash Collected</div>
                </div>
              </div>
              <p className="mt-2.5 text-center text-[10.5px] leading-[1.5] text-ink-faint">
                Cash taken on delivered cash trips in this period. A refused shop is not counted,
                because nothing was sold.
              </p>
            </Card>
          )}

          {filtered.length === 0 ? (
            <EmptyState
              title="No finished trips found"
              hint="Try a wider date range, or check back after your next trip."
              icon={<History className="h-7 w-7 text-ink-faint" />}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map((d) => {
                const Icon =
                  d.status === "DELIVERED"
                    ? CheckCircle2
                    : d.status === "RETURNED"
                    ? RotateCcw
                    : d.status === "CANCELLED"
                    ? Ban
                    : XCircle;
                const tint =
                  d.status === "DELIVERED" ? "#2C6B44" : d.status === "RETURNED" ? "#6B7280" : "#C4362A";
                const finishedAt =
                  d.timestamps.deliveredAt ?? d.timestamps.returnedAt ?? d.timestamps.cancelledAt ?? d.timestamps.failedAt ?? d.updatedAt;
                return (
                  <Link key={d.id} href={`/jobs/${d.id}`}>
                    <Card className="active:bg-surface-sunken">
                      <div className="flex items-start gap-3">
                        <Icon className="mt-0.5 h-5 w-5 shrink-0" style={{ color: tint }} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[13.5px] font-extrabold text-ink">{d.jobNumber}</span>
                            <span
                              className="rounded-full px-2 py-0.5 text-[9.5px] font-extrabold"
                              style={{ background: jobStyle(d.status).bg, color: jobStyle(d.status).fg }}
                            >
                              {jobStyle(d.status).label}
                            </span>
                          </div>
                          <div className="mt-0.5 truncate text-[12px] text-ink-soft">
                            {d.customer.name}
                            {` · ${d.progress.shopCount} shop${d.progress.shopCount === 1 ? "" : "s"}`}
                            {d.dropLocation ? ` · ${d.dropLocation}` : ""}
                          </div>
                          <div className="mt-0.5 text-[11px] text-ink-faint">
                            {dateTime(finishedAt)} ·{" "}
                            {d.money.isCod ? `Cash ${money(d.money.orderTotal)}` : "Paid online"}
                          </div>
                        </div>
                        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-ink-faint" />
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}