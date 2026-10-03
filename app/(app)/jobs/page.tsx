// app/(app)/jobs/page.tsx — My Trips.
//
// "Now" is everything still in your hands (collect, on the way, failed,
// refused-and-going-back). "Done today" is what you finished today.
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardList, MapPin, Navigation, PackageCheck, Store, Truck, Undo2 } from "lucide-react";
import { useAsync } from "@/lib/driver";
import { finishedAt, getJobHistory, getLiveJobs, jobStyle, nextStep, type Job } from "@/lib/jobs";
import { isToday, mapsHref, money, telHref, timeOf } from "@/lib/format";
import { Button, Card, EmptyState, ErrorState, Page, Pill, Skeleton, StatusPill, TopBar } from "@/components/ui";

async function loadTrips() {
  const [live, history] = await Promise.all([getLiveJobs(), getJobHistory()]);
  const done = history
    .filter((j) => (j.status === "DELIVERED" || j.status === "RETURNED") && isToday(finishedAt(j)))
    .sort((a, b) => String(finishedAt(b)).localeCompare(String(finishedAt(a))));
  return { live, done };
}

export default function TripsPage() {
  const { data, loading, error, reload } = useAsync(loadTrips, []);
  const [tab, setTab] = useState<"now" | "done">("now");
  const earnedToday = useMemo(() => (data?.done ?? []).reduce((t, j) => t + (j.driverPay ?? 0), 0), [data]);

  return (
    <>
      <TopBar title="My Trips" />
      <Page>
        {loading && !data ? (
          <Skeleton rows={3} height={190} />
        ) : error && !data ? (
          <ErrorState message={error} onRetry={reload} />
        ) : data ? (
          <>
            <Card className="flex items-center gap-3 py-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-light text-brand">
                <Truck size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-ink-muted">In your hands</p>
                <p className="text-[16px] font-extrabold text-ink">
                  {data.live.length} active trip{data.live.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10.5px] font-bold text-ink-muted">Done today</p>
                <p className="text-[16px] font-extrabold text-ink">{data.done.length}</p>
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-white p-1.5 shadow-card">
              <button
                onClick={() => setTab("now")}
                className={`flex min-h-[46px] items-center justify-center gap-2 rounded-xl text-[13.5px] font-extrabold ${tab === "now" ? "bg-brand text-white" : "text-ink-muted"}`}
              >
                <Navigation size={15} /> Now ({data.live.length})
              </button>
              <button
                onClick={() => setTab("done")}
                className={`flex min-h-[46px] items-center justify-center gap-2 rounded-xl text-[13.5px] font-extrabold ${tab === "done" ? "bg-brand text-white" : "text-ink-muted"}`}
              >
                <CheckCircle2 size={15} /> Done today ({data.done.length})
              </button>
            </div>

            {tab === "now" ? (
              data.live.length === 0 ? (
                <EmptyState icon={ClipboardList} title="No trips right now" text="When the office gives you a trip it shows here. Stay online on the Home tab." />
              ) : (
                data.live.map((j) => <TripCard key={j.id} job={j} />)
              )
            ) : data.done.length === 0 ? (
              <EmptyState icon={PackageCheck} title="Nothing finished yet today" text="Delivered and returned trips from today show here." />
            ) : (
              <Card>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light text-brand">
                    <CheckCircle2 size={19} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[15px] font-extrabold text-ink">
                      Done today ({data.done.length})
                    </p>
                    <p className="text-[11.5px] font-semibold text-brand-tint">+{money(earnedToday)} earned on these trips</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  {data.done.map((j) => (
                    <Link key={j.id} href={`/jobs/${j.id}`} className="flex items-center gap-3 rounded-2xl bg-surface-sunken px-3.5 py-3">
                      {j.status === "DELIVERED" ? <CheckCircle2 size={18} className="text-brand-tint" /> : <Undo2 size={18} className="text-ink-muted" />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-extrabold text-ink">
                          {j.jobNumber} · {j.customer.name}
                        </p>
                        <p className="truncate text-[11px] text-ink-muted">
                          {timeOf(finishedAt(j))} · {j.status === "DELIVERED" ? "Delivered" : "Returned to the shops"}
                        </p>
                      </div>
                      <span className={`text-[15px] font-extrabold ${(j.driverPay ?? 0) > 0 ? "text-brand-tint" : "text-ink-faint"}`}>
                        {(j.driverPay ?? 0) > 0 ? `+${money(j.driverPay)}` : "—"}
                      </span>
                    </Link>
                  ))}
                </div>
              </Card>
            )}
          </>
        ) : null}
      </Page>
    </>
  );
}

function TripCard({ job }: { job: Job }) {
  const step = nextStep(job);
  const stripe =
    job.status === "ON_THE_WAY" ? "bg-accent" : job.status === "ASSIGNED" ? "bg-violet" : "bg-danger";
  const cash = job.money.amountToCollect;
  const shops = job.shopNames ?? [];
  const goBack = job.status === "CANCELLED" || (job.status === "FAILED" && job.mustReturn);

  return (
    <div className="overflow-hidden rounded-[22px] bg-white shadow-card">
      <div className={`h-1.5 ${stripe}`} />
      <div className="p-4">
        {job.isIntercity && (
          <div className="mb-2.5 flex items-center justify-between">
            <Pill tone="brand">
              <MapPin size={11} /> BETWEEN CITIES{job.destinationCity ? ` → ${job.destinationCity}` : ""}
            </Pill>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Link href={`/jobs/${job.id}`} className="text-[19px] font-extrabold text-ink">
            {job.jobNumber}
          </Link>
          {job.status === "FAILED" && (
            <Pill tone="danger">
              TRY {job.attemptCount} DONE
            </Pill>
          )}
          <span className="ml-auto">
            <StatusPill style={jobStyle(job.status)} />
          </span>
        </div>
        <p className="mt-2 text-[16px] font-extrabold text-ink">{job.customer.name}</p>
        <p className="mt-0.5 flex items-start gap-1.5 text-[12.5px] text-ink-muted">
          <MapPin size={14} className="mt-0.5 shrink-0" />
          <span className="line-clamp-2">
            <b className="font-bold text-ink-soft">{job.customer.area || job.customer.district || job.customer.address || "No area given"}</b>
            {job.customer.landmark ? ` · ${job.customer.landmark}` : ""}
          </span>
        </p>
        {shops.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {shops.map((s) => (
              <span key={s} className="inline-flex items-center gap-1 rounded-lg bg-surface-sunken px-2 py-1 text-[11px] font-bold text-ink-soft">
                <Store size={12} /> {s}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center gap-3 border-t border-line pt-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${goBack ? "bg-danger-light text-danger" : "bg-surface-sunken text-ink-soft"}`}>
            {goBack ? <AlertTriangle size={16} /> : <Navigation size={16} />}
          </div>
          <p className={`min-w-0 flex-1 text-[13.5px] font-extrabold leading-tight ${goBack ? "text-danger" : "text-ink"}`}>{step.label}</p>
          {goBack ? (
            <Pill tone="muted">NO CASH</Pill>
          ) : cash > 0 ? (
            <span className="rounded-xl bg-accent-light px-2.5 py-1.5 text-[11px] font-extrabold text-accent-tint">
              COD <span className="text-[15px]">{money(cash)}</span>
            </span>
          ) : (
            <Pill tone="brand">PAID</Pill>
          )}
        </div>

        <div className="mt-3">
          {job.status === "ON_THE_WAY" ? (
            <div className="grid grid-cols-2 gap-2.5">
              <Button href={telHref(job.customer.phone)} variant="secondary" size="md" disabled={!job.customer.phone}>
                Call customer
              </Button>
              <Button href={`/jobs/${job.id}`} size="md" iconRight={ArrowRight}>
                Open trip
              </Button>
            </div>
          ) : goBack ? (
            <Button href={`/jobs/${job.id}`} variant="danger-soft" size="md" icon={Undo2} className="w-full">
              Return to the shops
            </Button>
          ) : job.status === "FAILED" ? (
            <div className="grid grid-cols-2 gap-2.5">
              <Button href={mapsHref(job.customer.address, job.customer.area, job.customer.landmark)} variant="secondary" size="md">
                Navigate
              </Button>
              <Button href={`/jobs/${job.id}`} size="md" iconRight={ArrowRight}>
                Open trip
              </Button>
            </div>
          ) : (
            <Button href={`/jobs/${job.id}`} variant="secondary" size="md" icon={Store} className="w-full">
              Collect from the shops
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
