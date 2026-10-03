// app/(app)/history/page.tsx — every trip and return pickup you finished.
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Ban, CheckCircle2, History, RotateCcw, Undo2, XCircle } from "lucide-react";
import { useAsync } from "@/lib/driver";
import { finishedAt, getJobHistory, type Job } from "@/lib/jobs";
import { getPickupHistory, type Pickup } from "@/lib/pickups";
import { dateTime, dayHeading, dayKey, money, toDate } from "@/lib/format";
import { BackBar, EmptyState, ErrorState, Page, Skeleton } from "@/components/ui";

type Row = { id: string; href: string; at: string | null; title: string; sub: string; amount: number; kind: "delivered" | "returned" | "refused" | "failed" | "pickup" };

function fromJob(j: Job): Row {
  const kind = j.status === "DELIVERED" ? "delivered" : j.status === "RETURNED" ? "returned" : j.status === "CANCELLED" ? "refused" : "failed";
  return {
    id: j.id,
    href: `/jobs/${j.id}`,
    at: finishedAt(j),
    title: `${j.jobNumber} · ${j.customer.name}`,
    sub: kind === "delivered" ? "Delivered" : kind === "returned" ? "Returned to the shops" : kind === "refused" ? "Refused at the door" : "Couldn't deliver",
    amount: j.driverPay ?? 0,
    kind,
  };
}
function fromPickup(p: Pickup): Row {
  return {
    id: p.id,
    href: `/pickups/${p.id}`,
    at: p.timestamps.deliveredAt ?? p.timestamps.createdAt,
    title: `${p.returnNumber} · ${p.customer.name}`,
    sub: p.status === "DELIVERED" ? `Return given to ${p.shop.name}` : "Pickup cancelled",
    amount: p.driverPay,
    kind: "pickup",
  };
}

const ICON = { delivered: CheckCircle2, returned: Undo2, refused: Ban, failed: XCircle, pickup: RotateCcw };
const CLS = {
  delivered: "bg-brand-light text-brand",
  returned: "bg-surface-sunken text-ink-soft",
  refused: "bg-danger-light text-danger",
  failed: "bg-accent-light text-accent-tint",
  pickup: "bg-violet-light text-violet",
};

export default function HistoryPage() {
  const { data, loading, error, reload } = useAsync(async () => {
    const [jobs, pickups] = await Promise.all([getJobHistory(), getPickupHistory()]);
    return [...jobs.filter((j) => j.status !== "FAILED").map(fromJob), ...pickups.map(fromPickup)].sort(
      (a, b) => (toDate(b.at)?.getTime() ?? 0) - (toDate(a.at)?.getTime() ?? 0)
    );
  }, []);
  const [show, setShow] = useState<"all" | "trips" | "pickups">("all");

  const groups = useMemo(() => {
    const rows = (data ?? []).filter((r) => (show === "all" ? true : show === "pickups" ? r.kind === "pickup" : r.kind !== "pickup"));
    const map = new Map<string, Row[]>();
    for (const r of rows) {
      const d = toDate(r.at);
      const k = d ? dayKey(d) : "earlier";
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return Array.from(map.entries());
  }, [data, show]);

  return (
    <>
      <BackBar title="Trip history" href="/profile" />
      <Page>
        <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-white p-1.5 shadow-card">
          {(
            [
              ["all", "All"],
              ["trips", "Trips"],
              ["pickups", "Pickups"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} onClick={() => setShow(k)} className={`min-h-[42px] rounded-xl text-[13px] font-extrabold ${show === k ? "bg-brand text-white" : "text-ink-muted"}`}>
              {l}
            </button>
          ))}
        </div>
        {loading && !data ? (
          <Skeleton rows={4} height={70} />
        ) : error && !data ? (
          <ErrorState message={error} onRetry={reload} />
        ) : groups.length === 0 ? (
          <EmptyState icon={History} title="No history yet" text="Finished trips and return pickups show here." />
        ) : (
          groups.map(([key, rows]) => (
            <div key={key} className="flex flex-col gap-2">
              <p className="px-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-muted">{key === "earlier" ? "Earlier" : dayHeading(key)}</p>
              <div className="overflow-hidden rounded-[22px] bg-white shadow-card">
                {rows.map((r, i) => {
                  const Icon = ICON[r.kind];
                  return (
                    <Link key={r.id} href={r.href} className={`flex items-center gap-3 px-4 py-3.5 ${i ? "border-t border-line" : ""}`}>
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${CLS[r.kind]}`}>
                        <Icon size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-extrabold text-ink">{r.title}</p>
                        <p className="truncate text-[11.5px] text-ink-muted">
                          {r.sub} · {dateTime(r.at)}
                        </p>
                      </div>
                      <span className={`text-[14px] font-extrabold ${r.amount > 0 ? "text-brand-tint" : "text-ink-faint"}`}>{r.amount > 0 ? `+${money(r.amount)}` : "—"}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </Page>
    </>
  );
}
