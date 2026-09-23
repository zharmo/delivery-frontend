// app/(app)/jobs/page.tsx
//
// My Trips — every basket in this driver's hands.
//
// One card per TRIP, not per parcel. A customer who bought from three
// shops is ONE card here: one address, one amount to collect, three shops
// to call at on the way. Before trips existed, the same customer showed up
// as three separate jobs and could even be given to three drivers.
//
// The card says what to do next in words, because a driver reads this
// while walking: "Collect 2 more shops" or "Go to the customer".
"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, MapPin, Package, Store, Truck } from "lucide-react";
import { useAsync } from "@/lib/deliveries";
import { getJobs, jobStyle, type Job } from "@/lib/jobs";
import { Card, EmptyState, ErrorState, PageHeader, SkeletonList, money } from "@/components/ui";

/** What the driver should do next on this trip, in plain words. */
function nextThing(job: Job) {
  if (job.status === "ASSIGNED") {
    const left = job.progress.shopCount - job.progress.collectedCount;
    return left > 0
      ? `Collect ${left} more shop${left === 1 ? "" : "s"}`
      : "Everything collected — set off";
  }
  if (job.status === "ON_THE_WAY") return "Go to the customer";
  if (job.status === "FAILED") return "Try again, or take it back";
  return jobStyle(job.status).label;
}

function JobCard({ job }: { job: Job }) {
  const style = jobStyle(job.status);
  return (
    <Link href={`/jobs/${job.id}`} className="block">
      <Card className="active:bg-surface-sunken">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[15px] font-extrabold text-ink">{job.jobNumber}</span>
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-extrabold"
            style={{ background: style.bg, color: style.fg }}
          >
            {style.label}
          </span>
        </div>

        <div className="text-[13.5px] font-bold text-ink">{job.customer.name}</div>
        <div className="mt-0.5 flex items-start gap-1.5 text-[12.5px] text-ink-muted">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{job.dropLocation || job.customer.address || "Address on the trip page"}</span>
        </div>

        {/* How many shops, and how far through them */}
        <div className="mt-2.5 flex items-center gap-1.5 rounded-xl bg-surface-sunken px-3 py-2">
          <Store className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
          <span className="text-[12.5px] font-bold text-ink">
            {job.progress.shopCount} shop{job.progress.shopCount === 1 ? "" : "s"}
          </span>
          {job.status === "ASSIGNED" && (
            <span className="text-[12px] text-ink-muted">
              · {job.progress.collectedCount} of {job.progress.shopCount} in your bag
            </span>
          )}
          <span className="ml-auto text-[12px] font-bold text-brand">{nextThing(job)}</span>
        </div>

        <div className="mt-2.5 flex items-end justify-between gap-2">
          <div>
            {job.money.amountToCollect > 0 ? (
              <>
                <div className="text-[10.5px] font-bold uppercase tracking-wide text-accent">
                  Collect at the door
                </div>
                <div className="text-[19px] font-extrabold leading-tight text-ink">
                  {money(job.money.amountToCollect)}
                </div>
                <div className="text-[11px] text-ink-faint">
                  incl. {money(job.money.deliveryFee)} delivery
                </div>
              </>
            ) : (
              <>
                <div className="text-[10.5px] font-bold uppercase tracking-wide text-[#2C6B44]">
                  Already paid
                </div>
                <div className="text-[12.5px] text-ink-muted">Nothing to collect</div>
              </>
            )}
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
        </div>
      </Card>
    </Link>
  );
}

export default function JobsPage() {
  const [tab, setTab] = useState<"live" | "done">("live");
  const statuses = tab === "live" ? "ASSIGNED,ON_THE_WAY,FAILED" : "DELIVERED,CANCELLED,RETURNED";
  const { data, loading, error, reload } = useAsync(() => getJobs(statuses), [statuses]);

  return (
    <>
      <PageHeader
        title="My Trips"
        subtitle="One card per customer — however many shops it came from."
      />

      <div className="mb-4 flex gap-2">
        {(
          [
            ["live", "In My Hands"],
            ["done", "Finished"],
          ] as ["live" | "done", string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 rounded-xl px-4 py-2.5 text-[12.5px] font-bold transition-colors ${
              tab === key ? "bg-brand text-white" : "border border-line bg-white text-ink-soft"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonList rows={3} />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          title={tab === "live" ? "Nothing in your hands" : "No finished trips yet"}
          hint={
            tab === "live"
              ? "The office gives you a whole basket at once — every shop for one customer, in one trip."
              : "Trips you have finished will show up here."
          }
          icon={tab === "live" ? <Truck className="h-7 w-7 text-ink-faint" /> : <Package className="h-7 w-7 text-ink-faint" />}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {data.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </>
  );
}