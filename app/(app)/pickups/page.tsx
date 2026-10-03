// app/(app)/pickups/page.tsx — Return pickups.
//
// A customer is sending something back. Go to them, check the item, then
// give it to the shop. Each finished pickup pays a set amount.
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Check, CheckCircle2, CornerDownLeft, Phone, RotateCcw, Store, Truck } from "lucide-react";
import { useAsync } from "@/lib/driver";
import { getEarnings, getPickupHistory, getPickups, type Pickup } from "@/lib/pickups";
import { ago, dateTime, isToday, money, telHref, timeOf } from "@/lib/format";
import { Card, EmptyState, ErrorState, Page, Pill, Skeleton, TopBar } from "@/components/ui";

async function loadPickups() {
  const [live, history, earnings] = await Promise.all([getPickups(), getPickupHistory(), getEarnings().catch(() => null)]);
  return { live, history, pickupPay: earnings?.pickupPay ?? null };
}

type Filter = "all" | "collect" | "shop";

export default function PickupsPage() {
  const { data, loading, error, reload } = useAsync(loadPickups, []);
  const [tab, setTab] = useState<"todo" | "done">("todo");
  const [filter, setFilter] = useState<Filter>("all");

  const lists = useMemo(() => {
    const live = data?.live ?? [];
    const collect = live.filter((p) => p.status === "ASSIGNED" || p.status === "FAILED");
    const shop = live.filter((p) => p.status === "PICKED_UP");
    const done = (data?.history ?? []).filter((p) => p.status === "DELIVERED");
    return { live, collect, shop, done, doneToday: done.filter((p) => isToday(p.timestamps.deliveredAt)) };
  }, [data]);

  const shown = filter === "collect" ? lists.collect : filter === "shop" ? lists.shop : lists.live;
  const pay = data?.pickupPay ?? null;

  return (
    <>
      <TopBar title="Return Pickups" />
      <Page>
        {loading && !data ? (
          <Skeleton rows={3} height={180} />
        ) : error && !data ? (
          <ErrorState message={error} onRetry={reload} />
        ) : data ? (
          <>
            <div className="flex items-center gap-3 rounded-[22px] bg-violet-light p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet text-white">
                <RotateCcw size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-violet-tint">Returns</p>
                <p className="text-[16px] font-extrabold text-ink">{pay !== null ? `You earn +${money(pay)} per pickup` : "Return pickups"}</p>
              </div>
              {lists.doneToday.length > 0 && (
                <span className="rounded-2xl bg-white px-3 py-2 text-center text-[11px] font-bold text-ink-muted">
                  <span className="block text-[16px] font-extrabold text-violet-tint">{lists.doneToday.length}</span>today
                </span>
              )}
            </div>
            <p className="-mt-1 px-1 text-[12.5px] leading-snug text-ink-muted">
              Collect the item from the customer, check it, and give it to the shop by hand.
            </p>

            <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-white p-1.5 shadow-card">
              <button
                onClick={() => setTab("todo")}
                className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl text-[13.5px] font-extrabold ${tab === "todo" ? "bg-violet text-white" : "text-ink-muted"}`}
              >
                To do <span className={`rounded-full px-1.5 text-[11px] ${tab === "todo" ? "bg-white/25" : "bg-surface-sunken"}`}>{lists.live.length}</span>
              </button>
              <button
                onClick={() => setTab("done")}
                className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl text-[13.5px] font-extrabold ${tab === "done" ? "bg-violet text-white" : "text-ink-muted"}`}
              >
                Done <span className={`rounded-full px-1.5 text-[11px] ${tab === "done" ? "bg-white/25" : "bg-surface-sunken"}`}>{lists.done.length}</span>
              </button>
            </div>

            {tab === "todo" ? (
              <>
                {lists.live.length > 0 && (
                  <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
                    {(
                      [
                        ["all", `All (${lists.live.length})`],
                        ["collect", `Collect from customer (${lists.collect.length})`],
                        ["shop", `Take to shop (${lists.shop.length})`],
                      ] as [Filter, string][]
                    ).map(([k, l]) => (
                      <button
                        key={k}
                        onClick={() => setFilter(k)}
                        className={`shrink-0 rounded-full px-3.5 py-2 text-[12px] font-bold ${filter === k ? "bg-violet text-white" : "bg-white text-ink-soft shadow-card"}`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                )}
                {shown.length === 0 ? (
                  <EmptyState
                    icon={CheckCircle2}
                    tone="violet"
                    title="No return pickups right now"
                    text="When the office gives you a return to collect, it shows here and on the bell."
                  />
                ) : (
                  shown.map((p) => <PickupCard key={p.id} p={p} pay={pay} />)
                )}
                {lists.doneToday.length > 0 && (
                  <Card className="bg-white/70">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-extrabold text-ink-soft">Done today</span>
                      <button onClick={() => setTab("done")} className="text-[12px] font-extrabold text-violet-tint">
                        View all {lists.done.length}
                      </button>
                    </div>
                    <div className="mt-2.5 flex flex-col gap-2">
                      {lists.doneToday.slice(0, 2).map((p) => (
                        <DoneRow key={p.id} p={p} />
                      ))}
                    </div>
                  </Card>
                )}
              </>
            ) : lists.done.length === 0 ? (
              <EmptyState icon={RotateCcw} tone="violet" title="No finished pickups yet" text="Pickups you hand to a shop show here with what you earned." />
            ) : (
              <div className="flex flex-col gap-2">
                {lists.done.map((p) => (
                  <DoneRow key={p.id} p={p} />
                ))}
              </div>
            )}
          </>
        ) : null}
      </Page>
    </>
  );
}

function DoneRow({ p }: { p: Pickup }) {
  return (
    <Link href={`/pickups/${p.id}`} className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-card">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand">
        <Check size={17} strokeWidth={3} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-extrabold text-ink">{p.returnNumber}</p>
        <p className="truncate text-[11.5px] text-ink-muted">
          Returned to {p.shop.name} · {isToday(p.timestamps.deliveredAt) ? timeOf(p.timestamps.deliveredAt) : dateTime(p.timestamps.deliveredAt)}
        </p>
      </div>
      <span className="rounded-full bg-brand-light px-2.5 py-1 text-[12px] font-extrabold text-brand-tint">+{money(p.driverPay)}</span>
    </Link>
  );
}

function PickupCard({ p, pay }: { p: Pickup; pay: number | null }) {
  const earn = p.payOnDone ?? pay;
  const where = [p.customer.area || p.customer.address, p.customer.landmark].filter(Boolean).join(", ");

  if (p.status === "FAILED") {
    return (
      <Card>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-light text-accent-tint">
            <RotateCcw size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-extrabold text-ink">{p.returnNumber}</p>
            <p className="text-[11.5px] text-ink-muted">Try {p.attempts} didn&apos;t work</p>
          </div>
          <Pill tone="accent">
            <AlertTriangle size={11} /> Try again
          </Pill>
        </div>
        <div className="mt-3 rounded-2xl bg-accent-light/70 p-3.5">
          <p className="text-[13.5px] font-extrabold text-accent-deep">
            {p.failureReason ?? "Couldn't collect"} · {timeOf(p.timestamps.failedAt)}
          </p>
          <p className="mt-0.5 text-[12px] text-accent-deep/80">
            {p.customer.name}
            {where ? ` · ${where}` : ""}
          </p>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <CornerDownLeft size={15} className="text-violet" />
          <span className="flex-1 truncate text-[12.5px] font-bold text-ink-soft">
            {p.shop.name} · {p.itemCount} item{p.itemCount === 1 ? "" : "s"}
          </span>
          <Link href={`/pickups/${p.id}`} className="rounded-xl bg-surface-sunken px-3 py-2 text-[12px] font-extrabold text-ink">
            Open
          </Link>
        </div>
      </Card>
    );
  }

  const toShop = p.status === "PICKED_UP";
  return (
    <Card>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-light text-violet">
          {toShop ? <Truck size={19} /> : <CornerDownLeft size={19} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-extrabold text-ink">{p.returnNumber}</p>
          <p className="text-[11.5px] text-ink-muted">{toShop ? "In your vehicle" : `Given to you ${ago(p.timestamps.assignedAt ?? p.timestamps.createdAt)}`}</p>
        </div>
        <Pill tone={toShop ? "blue" : "violet"} dot>
          {toShop ? "Take to shop" : "Go to customer"}
        </Pill>
      </div>

      <div className="mt-3 rounded-2xl bg-surface-sunken p-3.5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-[15.5px] font-extrabold text-ink">
              {toShop && <span className="h-2 w-2 rounded-full bg-[#22A06B]" />}
              {p.customer.name}
              {toShop && <Pill tone="brand">Collected</Pill>}
            </p>
            <p className="mt-0.5 text-[12px] text-ink-muted">
              {toShop ? "Item checked and with you." : where || p.customer.city || "No address given — call the customer"}
            </p>
          </div>
          {!toShop && telHref(p.customer.phone) && (
            <a href={telHref(p.customer.phone)} aria-label="Call the customer" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-violet shadow-card">
              <Phone size={18} />
            </a>
          )}
        </div>
      </div>

      <div className={`mt-2.5 flex items-start gap-3 rounded-2xl ${toShop ? "bg-surface-sunken p-3.5" : "px-1"}`}>
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-light text-violet">
          <Store size={14} />
        </span>
        <div className="min-w-0">
          <p className="text-[13.5px] font-extrabold text-ink">
            {toShop ? p.shop.name : `Return to: ${p.shop.name}`}
          </p>
          <p className="truncate text-[11.5px] text-ink-muted">
            {toShop && p.shop.location ? `${p.shop.location} · ` : ""}
            {p.itemCount} item{p.itemCount === 1 ? "" : "s"} · {p.reasonLabel}
          </p>
        </div>
      </div>

      <div className="mt-3.5 flex items-center gap-2.5">
        {earn !== null && (
          <span className="shrink-0 rounded-full bg-brand-light px-3 py-1.5 text-[11.5px] font-extrabold text-brand-tint">+{money(earn)} when done</span>
        )}
        <Link
          href={`/pickups/${p.id}`}
          className={`flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-2xl text-[13.5px] font-extrabold text-white ${toShop ? "bg-brand" : "bg-violet"}`}
        >
          {toShop ? "Deliver to shop" : "Go to customer"} <ArrowRight size={16} />
        </Link>
      </div>
    </Card>
  );
}
