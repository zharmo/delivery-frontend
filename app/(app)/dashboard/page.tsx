// app/(app)/dashboard/page.tsx
//
// The driver's home screen. Three things, in the order they matter:
//   1. what they should be doing right now (the active trip)
//   2. everything else in their hands
//   3. today's numbers
//
// Everything here is a TRIP: one customer's whole basket, however many
// shops it came from. A driver is never handed the same customer twice.
"use client";

import Link from "next/link";
import {
  Ban, CheckCircle2, ChevronRight, MapPin, Package, Phone, RotateCcw,
  Store, Truck, XCircle,
} from "lucide-react";
import { useAsync } from "@/lib/deliveries";
import { getJobDashboard, jobStyle, type Job, type JobDashboard } from "@/lib/jobs";
import {
  Button, Card, EmptyState, ErrorState, PageHeader, SkeletonList, money,
} from "@/components/ui";

const STATS: {
  key: keyof JobDashboard["today"];
  label: string;
  icon: React.ElementType;
  bg: string;
  fg: string;
}[] = [
  { key: "assigned", label: "Collecting", icon: Package, bg: "#EEF0FA", fg: "#5B5FA0" },
  { key: "onTheWay", label: "On the Way", icon: Truck, bg: "#FFF1E0", fg: "#D9540F" },
  { key: "delivered", label: "Delivered", icon: CheckCircle2, bg: "#EAF7EE", fg: "#2C6B44" },
  { key: "failed", label: "Failed", icon: XCircle, bg: "#FDEAEA", fg: "#C4362A" },
  { key: "cancelled", label: "Cancelled", icon: Ban, bg: "#FDEAEA", fg: "#C4362A" },
  { key: "returned", label: "Returned", icon: RotateCcw, bg: "#F0F1F6", fg: "#6B7280" },
];

/** What this trip needs next, said the way a driver would say it. */
function nextThing(job: Job) {
  if (job.status === "ASSIGNED") {
    const left = job.progress.shopCount - job.progress.collectedCount;
    return left > 0 ? `Collect ${left} more shop${left === 1 ? "" : "s"}` : "Set off";
  }
  if (job.status === "ON_THE_WAY") return "Go to the customer";
  if (job.status === "FAILED") return "Try again, or take it back";
  return jobStyle(job.status).label;
}

export default function DashboardPage() {
  const { data, loading, error, reload } = useAsync(getJobDashboard);

  if (loading) {
    return (
      <>
        <PageHeader title="Today" subtitle="Loading your trips…" />
        <SkeletonList rows={2} />
      </>
    );
  }
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const active = data.activeJob;
  const others = data.jobs.filter((j) => j.id !== active?.id);

  return (
    <>
      <PageHeader
        title="Today"
        subtitle={`${data.today.delivered} delivered · ${data.activeCount} trip${data.activeCount === 1 ? "" : "s"} in your hands`}
      />

      {/* ── What to do right now ── */}
      {active ? (
        <div className="mb-4 rounded-2xl bg-brand p-4 text-white shadow-[0_8px_24px_rgba(14,59,42,0.25)]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-white/70">
              Active Trip
            </span>
            <span className="rounded-full bg-white/20 px-2.5 py-1 text-[10.5px] font-extrabold text-white">
              {jobStyle(active.status).label}
            </span>
          </div>

          <div className="text-[17px] font-extrabold">{active.jobNumber}</div>
          <div className="mt-0.5 text-[13px] text-white/85">{active.customer.name}</div>

          <div className="mt-2 flex items-start gap-1.5 text-[12.5px] text-white/85">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {active.dropLocation || active.customer.address || "Address on the trip page"}
              {active.customer.landmark ? ` — ${active.customer.landmark}` : ""}
            </span>
          </div>

          {/* How far through the shops — the thing that gates setting off. */}
          <div className="mt-2.5 flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2">
            <Store className="h-3.5 w-3.5 shrink-0 text-white/80" />
            <span className="text-[12.5px] font-bold">
              {active.progress.collectedCount} of {active.progress.shopCount} shop
              {active.progress.shopCount === 1 ? "" : "s"} in your bag
            </span>
            <span className="ml-auto text-[12px] font-bold text-white/80">{nextThing(active)}</span>
          </div>

          {active.money.amountToCollect > 0 && (
            <div className="mt-2.5 rounded-xl bg-white/15 px-3 py-2">
              <span className="text-[11px] font-bold text-white/70">COLLECT AT THE DOOR</span>
              <div className="text-[19px] font-extrabold">{money(active.money.amountToCollect)}</div>
              <div className="text-[10.5px] text-white/70">
                incl. {money(active.money.deliveryFee)} delivery — one fee for the whole basket
              </div>
            </div>
          )}

          <div className="mt-3.5 flex gap-2.5">
            <Link
              href={`/jobs/${active.id}`}
              className="flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-white text-[14px] font-bold text-brand"
            >
              <Truck className="h-4 w-4" />
              Open this trip
            </Link>
            <a
              href={`tel:${active.customer.phone}`}
              aria-label="Call customer"
              className="flex min-h-[48px] w-[52px] shrink-0 items-center justify-center rounded-xl border border-white/30"
            >
              <Phone className="h-4 w-4" />
            </a>
          </div>
        </div>
      ) : (
        <div className="mb-4">
          <EmptyState
            title="No active trip"
            hint="When the office gives you a basket it appears here — every shop for that customer, in one trip."
            icon={<Truck className="h-7 w-7 text-ink-faint" />}
          />
        </div>
      )}

      {/* ── Everything else in hand ── */}
      {others.length > 0 && (
        <Card
          title={`Also in your hands (${others.length})`}
          icon={<MapPin className="h-4 w-4 text-brand" />}
          className="mb-4"
        >
          <div className="flex flex-col gap-2.5">
            {others.map((job) => {
              const style = jobStyle(job.status);
              return (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="rounded-xl border border-line p-3 active:bg-surface-sunken"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-md bg-brand px-1.5 py-0.5 text-[10.5px] font-extrabold text-white">
                          {job.jobNumber}
                        </span>
                        <span
                          className="rounded-full px-2 py-0.5 text-[9.5px] font-extrabold"
                          style={{ background: style.bg, color: style.fg }}
                        >
                          {style.label}
                        </span>
                        {job.progress.shopCount > 1 && (
                          <span className="rounded-md bg-accent-light px-1.5 py-0.5 text-[9.5px] font-extrabold text-accent-tint">
                            {job.progress.shopCount} SHOPS
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-[13px] font-bold text-ink">{job.customer.name}</div>
                      <div className="truncate text-[11.5px] text-ink-muted">
                        {job.dropLocation || "No area given"} · {nextThing(job)}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {job.money.amountToCollect > 0 ? (
                        <>
                          <div className="text-[14px] font-extrabold text-ink">
                            {money(job.money.amountToCollect)}
                          </div>
                          <div className="text-[9.5px] text-ink-faint">
                            incl. {money(job.money.deliveryFee)} delivery
                          </div>
                        </>
                      ) : (
                        <div className="text-[10.5px] font-bold text-brand-tint">PAID</div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── Today's numbers ── */}
      <Card title="Today" className="mb-4">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {STATS.map((s) => (
            <div key={s.key} className="rounded-xl p-2.5 text-center" style={{ background: s.bg }}>
              <s.icon className="mx-auto h-4 w-4" style={{ color: s.fg }} />
              <div className="mt-1 text-[17px] font-extrabold" style={{ color: s.fg }}>
                {data.today[s.key]}
              </div>
              <div className="text-[9.5px] font-bold" style={{ color: s.fg }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2.5 text-center text-[11px] leading-[1.6] text-ink-faint">
          Counted in trips, not parcels — a basket from three shops is one trip.
        </p>
      </Card>

      <Button href="/jobs" tone="secondary">
        See All My Trips
        <ChevronRight className="h-4 w-4" />
      </Button>
    </>
  );
}