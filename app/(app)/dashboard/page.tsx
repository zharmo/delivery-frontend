// app/(app)/dashboard/page.tsx — Home.
//
// Three states, one screen:
//   • a trip in your hands → the big green "your trip now" card
//   • online with nothing  → "waiting for your next trip"
//   • offline              → "go online to get trips"
// Under that: today's money, cash to hand in, return pickups, today's numbers.
"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Banknote, Bell, Bike, ChevronRight, CloudOff, Phone, RotateCcw, Store, TrendingUp, Wallet, Zap } from "lucide-react";
import { getProfile, setAvailability, useAsync, errorText, type DutyStatus } from "@/lib/driver";
import { getLiveJobs, getJobDashboard, nextStep, jobStyle, type Job } from "@/lib/jobs";
import { getEarnings, getPickups, getPickupHistory } from "@/lib/pickups";
import { firstName, greeting, isToday, money, telHref, todayLabel } from "@/lib/format";
import { Avatar, Button, Card, ErrorState, Label, MiniStat, Page, Pill, Skeleton, StatusPill, TopBar, useToast } from "@/components/ui";

async function loadHome() {
  const [profile, jobs, dash, earnings, pickups, pickupHistory] = await Promise.all([
    getProfile(),
    getLiveJobs(),
    getJobDashboard(),
    getEarnings(),
    getPickups(),
    getPickupHistory().catch(() => []),
  ]);
  return { profile, jobs, dash, earnings, pickups, pickupsToday: pickupHistory.filter((p) => p.status === "DELIVERED" && isToday(p.timestamps.deliveredAt)).length };
}

export default function HomePage() {
  const { data, loading, error, reload, setData } = useAsync(loadHome, []);
  const [switching, setSwitching] = useState(false);
  const toast = useToast();

  async function setDuty(status: DutyStatus) {
    if (!data) return;
    setSwitching(true);
    try {
      const r = await setAvailability(status);
      setData({ ...data, profile: { ...data.profile, status: r.status } });
      toast.show(r.status === "OFFLINE" ? "You're offline — no new trips" : "You're online — the office can give you trips");
    } catch (e) {
      toast.show(errorText(e), "danger");
    } finally {
      setSwitching(false);
    }
  }

  return (
    <>
      {toast.node}
      <TopBar title="Home" />
      <Page>
        {loading && !data ? (
          <Skeleton rows={4} />
        ) : error && !data ? (
          <ErrorState message={error} onRetry={reload} />
        ) : data ? (
          <HomeBody data={data} switching={switching} onDuty={setDuty} />
        ) : null}
      </Page>
    </>
  );
}

function HomeBody({
  data, switching, onDuty,
}: { data: Awaited<ReturnType<typeof loadHome>>; switching: boolean; onDuty: (s: DutyStatus) => void }) {
  const { profile, jobs, dash, earnings, pickups } = data;
  const online = profile.status === "ACTIVE" || profile.status === "BUSY";
  const current = jobs[0] ?? null;
  const others = jobs.slice(1, 4);
  const pickupsToDo = pickups.filter((p) => p.status !== "DELIVERED" && p.status !== "CANCELLED");
  const cashDueBy = earnings.cash.toHandOver > 0;

  return (
    <>
      {/* greeting */}
      <Card className="flex items-center gap-3">
        <Avatar name={profile.name} size={46} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16.5px] font-extrabold text-ink">
            {greeting()}, {firstName(profile.name)}
          </p>
          <p className="truncate text-[12px] font-medium text-ink-muted">
            {todayLabel()}
            {profile.assignedLocation ? ` · ${profile.assignedLocation}` : ""}
          </p>
        </div>
        <Link href="/notifications" aria-label="Notifications" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-sunken text-ink-soft">
          <Bell size={19} />
        </Link>
      </Card>

      {/* online / offline */}
      <Card className="flex items-center gap-3 py-3.5">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${online ? (profile.status === "BUSY" ? "bg-accent" : "bg-[#22A06B]") : "bg-ink-faint"}`} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-extrabold uppercase tracking-wide text-ink">
            {profile.status === "BUSY" ? "You are busy" : online ? "You are online" : "You are offline"}
          </p>
          <p className="truncate text-[11.5px] text-ink-muted">
            {profile.status === "BUSY"
              ? "No new trips for now — change it in Profile"
              : online
                ? "The office can give you trips"
                : "You won't get new trips"}
          </p>
        </div>
        <button
          role="switch"
          aria-checked={online}
          aria-label="Online"
          disabled={switching}
          onClick={() => onDuty(online ? "OFFLINE" : "ACTIVE")}
          className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-50 ${online ? "bg-brand" : "bg-line"}`}
        >
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${online ? "left-7" : "left-1"}`} />
        </button>
      </Card>

      {/* the trip in your hands, or what to do without one */}
      {current ? (
        <CurrentTrip job={current} />
      ) : online ? (
        <Card className="flex flex-col items-center bg-gradient-to-b from-white to-brand-light/40 py-8 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-light text-brand">
            <Bike size={38} />
          </div>
          <p className="mt-4 text-[18px] font-extrabold text-ink">Waiting for your next trip</p>
          <p className="mt-1 max-w-[280px] text-[12.5px] leading-relaxed text-ink-muted">
            Stay online. When the office gives you a trip it shows here and on the bell.
          </p>
        </Card>
      ) : (
        <Card className="flex flex-col items-center py-7 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-sunken text-ink-muted">
            <CloudOff size={28} />
          </div>
          <p className="mt-3 text-[17px] font-extrabold text-ink">You&apos;re resting</p>
          <p className="mt-1 max-w-[280px] text-[12.5px] leading-relaxed text-ink-muted">You don&apos;t get trips while you&apos;re offline.</p>
          <Button onClick={() => onDuty("ACTIVE")} loading={switching} icon={Zap} className="mt-4 w-full">
            Go online to get trips
          </Button>
        </Card>
      )}

      {others.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label right={<span className="text-[11px] font-bold text-ink-faint">{others.length} more</span>}>Next in your hands</Label>
          {others.map((j) => (
            <Link key={j.id} href={`/jobs/${j.id}`} className="flex items-center gap-3 rounded-[20px] bg-white p-3.5 shadow-card">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-sunken text-ink-soft">
                <Store size={19} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-extrabold text-ink">{j.jobNumber}</span>
                  <StatusPill style={jobStyle(j.status)} dot={false} />
                </div>
                <p className="truncate text-[11.5px] text-ink-muted">
                  {nextStep(j).label} · {j.dropLocation ?? j.customer.name}
                </p>
              </div>
              {j.status === "CANCELLED" || (j.status === "FAILED" && j.mustReturn) ? (
                <span className="shrink-0 rounded-full bg-danger-light px-2.5 py-1 text-[10.5px] font-extrabold text-danger">Return</span>
              ) : (
                <div className="text-right">
                  <div className="text-[14px] font-extrabold text-ink">{j.money.amountToCollect > 0 ? money(j.money.amountToCollect) : "Paid"}</div>
                  <div className="text-[10px] font-bold text-ink-faint">{j.money.amountToCollect > 0 ? "cash" : "online"}</div>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* money */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/earnings" className="rounded-[22px] bg-white p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold text-ink-muted">Earned today</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-light text-brand">
              <TrendingUp size={15} />
            </span>
          </div>
          <div className="mt-2 text-[24px] font-extrabold leading-none text-ink">{money(earnings.pay.today)}</div>
          <div className="mt-1.5 text-[11px] font-bold text-brand-tint">
            {earnings.deliveredToday} trip{earnings.deliveredToday === 1 ? "" : "s"} delivered
          </div>
        </Link>
        <Link href="/earnings" className="rounded-[22px] bg-white p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold text-ink-muted">Cash to hand in</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-light text-accent-tint">
              <Wallet size={15} />
            </span>
          </div>
          <div className={`mt-2 text-[24px] font-extrabold leading-none ${cashDueBy ? "text-accent-tint" : "text-ink"}`}>{money(earnings.cash.toHandOver)}</div>
          <div className={`mt-1.5 text-[11px] font-bold ${cashDueBy ? "text-accent-tint" : "text-ink-faint"}`}>
            {cashDueBy ? "Hand it in at the office" : "Nothing to hand in"}
          </div>
        </Link>
      </div>

      <Link href="/pickups" className="flex items-center gap-3 rounded-[22px] bg-white p-4 shadow-card">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-light text-violet">
          <RotateCcw size={19} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-extrabold text-ink">Return pickups</p>
          <p className="text-[11.5px] text-ink-muted">
            {pickupsToDo.length === 0 ? "Nothing to collect" : `${pickupsToDo.length} to do · +${money(earnings.pickupPay ?? 0)} each`}
          </p>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-sunken text-ink-soft">
          <ChevronRight size={17} />
        </span>
      </Link>

      <Card>
        <Label className="mb-3">Today</Label>
        <div className="grid grid-cols-4 gap-2">
          <MiniStat value={dash.today.delivered} label="Delivered" />
          <MiniStat value={dash.today.failed} label="Failed" />
          <MiniStat value={dash.today.cancelled} label="Refused" />
          <MiniStat value={data.pickupsToday} label="Pickups" />
        </div>
      </Card>
    </>
  );
}

/** The big green card: the trip you are on right now. */
function CurrentTrip({ job }: { job: Job }) {
  const step = nextStep(job);
  const cash = job.money.amountToCollect;
  return (
    <div className="rounded-[24px] bg-brand p-4 text-white shadow-card">
      <div className="flex items-center gap-2">
        <span className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-white/60">Your trip now</span>
        <span className="text-[17px] font-extrabold">{job.jobNumber}</span>
        <span className="ml-auto">
          <Pill tone={job.status === "ON_THE_WAY" ? "accent" : job.status === "ASSIGNED" ? "violet" : "danger"} dot>
            {jobStyle(job.status).label}
          </Pill>
        </span>
      </div>
      <p className="mt-3 text-[18px] font-extrabold">{job.customer.name}</p>
      <p className="mt-0.5 line-clamp-1 text-[12.5px] text-white/75">
        {[job.customer.area || job.customer.district, job.customer.landmark].filter(Boolean).join(" · ") || job.customer.address || "Address on the trip"}
      </p>
      <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/10 px-3.5 py-3">
        <span className="flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-wide">
          <Banknote size={17} /> {cash > 0 ? "Collect cash" : "Paid — take no money"}
        </span>
        {cash > 0 && <span className="text-[22px] font-extrabold">{money(cash)}</span>}
      </div>
      <p className="mt-3 text-[12px] font-bold text-white/80">Next: {step.label}</p>
      <div className="mt-3 flex gap-2.5">
        <Link href={`/jobs/${job.id}`} className="flex min-h-[50px] flex-1 items-center justify-center gap-2 rounded-2xl bg-white text-[14.5px] font-extrabold text-brand">
          Open trip <ArrowRight size={17} />
        </Link>
        {telHref(job.customer.phone) && (
          <a href={telHref(job.customer.phone)} aria-label="Call the customer" className="flex h-[50px] w-[50px] items-center justify-center rounded-2xl bg-white/15">
            <Phone size={19} />
          </a>
        )}
      </div>
    </div>
  );
}
