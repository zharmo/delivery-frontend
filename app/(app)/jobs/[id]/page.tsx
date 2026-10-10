// app/(app)/jobs/[id]/page.tsx — one trip.
//
// The screen changes with the trip:
//   ASSIGNED    collect every shop's bag, then "start delivery"
//   ON_THE_WAY  the customer, the money, what's in your bag → hand over
//   FAILED      what happened, the office's new time → try again / return
//   no tries left, or refused → the return-to-shops checklist
//   DELIVERED / RETURNED → a short summary
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle, ArrowRight, Ban, Banknote, CalendarClock, Check, CheckCircle2, ChevronDown, ChevronUp, Clock, Headphones,
  Lock, MapPin, MessageSquareText, PackageCheck, PhoneOff, RefreshCw, RotateCcw, ShoppingBag, Store, Undo2, UserX, Wallet, XCircle,
} from "lucide-react";
import { errorText, useAsync } from "@/lib/driver";
import {
  collectStop, failJob, getJob, jobStyle, reasonLabel, returnJob, startJob, uncollectStop, JOB_FAILURE_REASONS, type JobDetail, type JobStop,
} from "@/lib/jobs";
import { dateTime, longDateTime, money, telHref, timeOf } from "@/lib/format";
import { OFFICE_PHONE } from "@/lib/office";
import {
  BackBar, BottomBar, Button, CallNav, Card, CheckRow, ChoiceRow, ErrorState, FullLoader, INPUT, InlineError, Label, Page, Pill, Progress,
  Sheet, StatusPill, useToast,
} from "@/components/ui";
import { ItemThumb, itemsLine, MoneyLine, Stepper, stopCash } from "@/components/trip";

export default function TripPage() {
  const { id } = useParams<{ id: string }>();
  const { data: job, loading, error, reload, refresh } = useAsync(() => getJob(id), [id]);
  const [returning, setReturning] = useState(false);
  const toast = useToast();

  if (loading && !job) return <FullLoader label="Opening the trip…" />;
  if (error && !job)
    return (
      <>
        <BackBar title="Trip" href="/jobs" />
        <Page bottom="none">
          <ErrorState message={error} onRetry={reload} />
        </Page>
      </>
    );
  if (!job) return null;

  const mustGoBack = job.status === "CANCELLED" || (job.status === "FAILED" && job.mustReturn) || (job.status === "FAILED" && returning);

  return (
    <>
      {toast.node}
      <BackBar title={job.jobNumber} kicker="Trip" href="/jobs" badge={<StatusPill style={jobStyle(job.status)} />} />
      {job.status === "ASSIGNED" ? (
        <CollectView job={job} onChange={refresh} toast={toast.show} />
      ) : job.status === "ON_THE_WAY" ? (
        <OnTheWayView job={job} onChange={refresh} toast={toast.show} />
      ) : mustGoBack ? (
        <ReturnView job={job} onChange={refresh} onCancel={job.status === "FAILED" && !job.mustReturn ? () => setReturning(false) : undefined} toast={toast.show} />
      ) : job.status === "FAILED" ? (
        <FailedView job={job} onChange={refresh} onReturn={() => setReturning(true)} toast={toast.show} />
      ) : (
        <DoneView job={job} />
      )}
    </>
  );
}

type ViewProps = { job: JobDetail; onChange: () => void; toast: (m: string, t?: "brand" | "danger") => void };

/* ── the head of every view ─────────────────────────────────────────── */

function TripHead({ job, step, tag }: { job: JobDetail; step: number; tag?: React.ReactNode }) {
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[17px] font-extrabold text-ink">Trip {job.jobNumber}</span>
        {job.isIntercity && (
          <Pill tone="brand">
            <MapPin size={11} /> To {job.destinationCity ?? "another city"}
          </Pill>
        )}
        {tag}
      </div>
      <div className="mt-4">
        <Stepper current={step} />
      </div>
    </Card>
  );
}

function CustomerCard({ job, title = "Customer drop-off", children }: { job: JobDetail; title?: string; children?: React.ReactNode }) {
  const c = job.customer;
  return (
    <Card>
      <Label>
        <span className="flex items-center gap-1.5">
          <MapPin size={13} /> {title}
        </span>
      </Label>
      <p className="mt-2 text-[20px] font-extrabold text-ink">{c.name}</p>
      <p className="mt-0.5 text-[13px] leading-snug text-ink-soft">
        {[c.address, c.area || c.district].filter(Boolean).join(", ") || "No address given — call the customer"}
      </p>
      {c.landmark && (
        <span className="mt-2 inline-flex items-center gap-1 rounded-lg bg-surface-sunken px-2 py-1 text-[11.5px] font-bold text-ink-soft">
          <MapPin size={12} /> {c.landmark}
        </span>
      )}
      {c.notes && (
        <div className="mt-3 flex items-start gap-2.5 rounded-2xl bg-accent-light/60 p-3">
          <MessageSquareText size={16} className="mt-0.5 shrink-0 text-accent-tint" />
          <p className="text-[12.5px] leading-snug text-ink-soft">
            <b className="text-ink">Note:</b> {c.notes}
          </p>
        </div>
      )}
      <div className="mt-3.5">
        <CallNav phone={c.phone} place={[c.address, c.area || c.district, c.landmark, job.destinationCity]} callLabel="Call customer" navLabel="Navigate" />
      </div>
      {children}
    </Card>
  );
}

/* ── 1. collect the shops ───────────────────────────────────────────── */

function CollectView({ job, onChange, toast }: ViewProps) {
  const [busy, setBusy] = useState<string | null>(null);
  // Door outcomes: tick every item in the shop's bag before taking it.
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState<string | null>(null);
  const stops = job.stops.filter((s) => s.status !== "MOVED");
  const collected = stops.filter((s) => s.status === "COLLECTED").length;
  const left = stops.length - collected;
  const activeId = stops.find((s) => s.status !== "COLLECTED")?.id;

  async function act(fn: () => Promise<unknown>, key: string, msg: string) {
    setBusy(key);
    setErr(null);
    try {
      await fn();
      toast(msg);
      onChange();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Page bottom="bar">
        <TripHead job={job} step={0} tag={<Pill tone="violet">COLLECT SHOPS</Pill>} />

        {left > 0 ? (
          <Card>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[14px] font-extrabold text-ink">
                <span className="h-2 w-2 rounded-full bg-accent" /> Collection status
              </span>
              <Pill tone="brand">
                {collected} of {stops.length} collected
              </Pill>
            </div>
            <p className="mt-1.5 text-[12.5px] text-ink-muted">Collect every shop&apos;s bag before you set off.</p>
            <div className="mt-3">
              <Progress value={stops.length ? collected / stops.length : 0} />
            </div>
          </Card>
        ) : (
          <div className="rounded-[22px] bg-brand-mint p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white">
                <ShoppingBag size={19} />
              </div>
              <div>
                <p className="text-[16px] font-extrabold text-brand">All bags collected!</p>
                <p className="text-[12.5px] text-brand-tint">
                  You have {stops.length} of {stops.length} shop bag{stops.length === 1 ? "" : "s"}. Start the delivery.
                </p>
              </div>
            </div>
            <div className="mt-3">
              <Progress value={1} />
            </div>
          </div>
        )}

        <InlineError message={err} />

        {stops.map((s, i) => {
          const done = s.status === "COLLECTED";
          const active = s.id === activeId;
          const notReady = s.status === "WAITING";
          return (
            <div key={s.id} className={`overflow-hidden rounded-[22px] bg-white shadow-card ${active ? "ring-2 ring-violet/30" : ""}`}>
              {active && <div className="h-1.5 bg-violet" />}
              <div className="p-4">
                <div className="flex items-start gap-3">
                  {done ? (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#22A06B] text-white">
                      <Check size={18} strokeWidth={3} />
                    </span>
                  ) : (
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[14px] font-extrabold ${active ? "bg-violet text-white" : "bg-surface-sunken text-ink-muted"}`}>
                      {i + 1}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[16px] font-extrabold text-ink">{s.shop.name}</span>
                      {done ? <Pill tone="brand" dot>IN BAG</Pill> : notReady ? <Pill tone="accent">NOT READY</Pill> : active ? <Pill tone="violet">NEXT</Pill> : null}
                    </div>
                    <p className="text-[12px] text-ink-muted">{s.shop.location ?? "No address on file"}</p>
                  </div>
                  {done && (
                    <button
                      onClick={() => act(() => uncollectStop(job.id, s.id), s.id, `${s.shop.name} unticked`)}
                      disabled={busy !== null}
                      className="shrink-0 rounded-lg px-2 py-1 text-[12px] font-extrabold text-accent-tint"
                    >
                      Undo
                    </button>
                  )}
                </div>

                {done ? (
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-surface-sunken px-3 py-2.5 text-[12px] text-ink-soft">
                    <PackageCheck size={15} className="shrink-0 text-brand-tint" />
                    <span className="truncate">{itemsLine(s)}</span>
                    <span className="ml-auto shrink-0 font-bold text-brand-tint">{s.orderNumber}</span>
                  </div>
                ) : (
                  <>
                    <div className="mt-3">
                      <CallNav phone={s.shop.phone} place={[s.shop.name, s.shop.location]} callLabel="Call shop" navLabel="Open map" primary="call" size="sm" />
                    </div>
                    {!notReady && <p className="mt-3 text-[11.5px] font-bold text-ink-muted">Check each item in the bag and tick it — size, colour and number.</p>}
                    <div className="mt-2 flex flex-col gap-2">
                      {s.items.map((it) => {
                        const on = !!checks[it.id];
                        return (
                          <button
                            key={it.id}
                            type="button"
                            disabled={notReady}
                            onClick={() => setChecks((c) => ({ ...c, [it.id]: !c[it.id] }))}
                            aria-pressed={on}
                            className={`flex items-center gap-3 rounded-2xl border-2 p-2.5 text-left ${on ? "border-brand bg-brand-light/50" : "border-transparent bg-surface-sunken"}`}
                          >
                            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 ${on ? "border-brand bg-brand text-white" : "border-ink-faint/50 bg-white"}`}>
                              {on && <Check size={14} strokeWidth={3} />}
                            </span>
                            <ItemThumb item={it} size={48} />
                            <div className="min-w-0 flex-1">
                              <p className="break-words text-[13px] font-extrabold text-ink">{it.productName}</p>
                              <p className="break-words text-[11.5px] text-ink-muted">
                                Qty {it.quantity}
                                {it.variantLabel ? ` · ${it.variantLabel}` : ""}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <Button
                      onClick={() => act(() => collectStop(job.id, s.id, true), s.id, `${s.shop.name}'s bag is in your bag`)}
                      loading={busy === s.id}
                      disabled={notReady || s.items.some((it) => !checks[it.id]) || (busy !== null && busy !== s.id)}
                      icon={ShoppingBag}
                      className="mt-3 w-full"
                      variant={active ? "primary" : "secondary"}
                    >
                      {notReady
                        ? "Shop is not ready yet"
                        : s.items.some((it) => !checks[it.id])
                          ? `Tick every item (${s.items.filter((it) => !checks[it.id]).length} left)`
                          : "I have this shop's bag"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}

        <CustomerCard job={job} title="Then deliver to" />
      </Page>
      <BottomBar>
        {left > 0 ? (
          <Button disabled icon={Lock} variant="secondary" className="w-full">
            Collect {left} more shop{left === 1 ? "" : "s"} first
          </Button>
        ) : (
          <Button
            onClick={() => act(() => startJob(job.id), "start", "You're on the way — the customer is told")}
            loading={busy === "start"}
            iconRight={ArrowRight}
            className="w-full"
          >
            I have everything — start delivery
          </Button>
        )}
      </BottomBar>
    </>
  );
}

/* ── 2. on the way ──────────────────────────────────────────────────── */

const FAIL_ICONS: Record<string, React.ElementType> = {
  customer_unavailable: UserX,
  customer_phone_unreachable: PhoneOff,
  wrong_address: MapPin,
  customer_requested_later: CalendarClock,
  payment_issue: Wallet,
  other: MessageSquareText,
};

function MoneyBox({ job }: { job: JobDetail }) {
  const cash = job.money.amountToCollect;
  if (cash <= 0) {
    return (
      <div className="flex items-center gap-3 rounded-[22px] bg-brand-mint p-4">
        <CheckCircle2 size={24} className="shrink-0 text-brand" />
        <div>
          <p className="text-[15px] font-extrabold text-brand">Already paid — take no money</p>
          <p className="text-[12px] text-brand-tint">The customer paid online with Zaad or eDahab.</p>
        </div>
      </div>
    );
  }
  const live = job.stops.filter((s) => s.status === "COLLECTED");
  const products = live.reduce((t, s) => t + (stopCash(s) ? s.money.productTotal : 0), 0);
  const fee = live.reduce((t, s) => t + (stopCash(s) ? s.money.deliveryFee : 0), 0);
  return (
    <div className="rounded-[22px] bg-accent-light p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.1em] text-accent-deep">
          <Banknote size={15} /> Take from the customer
        </span>
        <span className="rounded-lg bg-accent-soft px-2 py-0.5 text-[10.5px] font-extrabold text-accent-deep">CASH</span>
      </div>
      <div className="mt-1 text-[34px] font-extrabold leading-tight text-accent-deep">{money(cash)}</div>
      <p className="text-[12px] text-accent-deep/80">
        Products {money(products)} + delivery fee {money(fee)}
      </p>
    </div>
  );
}

function BagList({ job, title = "In your bag" }: { job: JobDetail; title?: string }) {
  const [open, setOpen] = useState(true);
  const live = job.stops.filter((s) => s.status === "COLLECTED");
  const items = live.reduce((t, s) => t + s.itemCount, 0);
  return (
    <Card>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 text-left">
        <ShoppingBag size={17} className="text-ink-soft" />
        <span className="flex-1 text-[15px] font-extrabold text-ink">
          {title} ({live.length} shop{live.length === 1 ? "" : "s"}, {items} item{items === 1 ? "" : "s"})
        </span>
        {open ? <ChevronUp size={18} className="text-ink-muted" /> : <ChevronDown size={18} className="text-ink-muted" />}
      </button>
      {open && (
        <div className="mt-3 flex flex-col gap-2">
          {live.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-2xl bg-surface-sunken px-3.5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-extrabold text-ink">{s.shop.name}</p>
                <p className="truncate text-[11.5px] text-ink-muted">{itemsLine(s)}</p>
              </div>
              <Pill tone="brand">
                <Check size={11} strokeWidth={3} /> In bag
              </Pill>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function OnTheWayView({ job, onChange, toast }: ViewProps) {
  const [failOpen, setFailOpen] = useState(false);
  const max = job.proofRules?.maxAttempts ?? 2;
  return (
    <>
      <Page bottom="bar">
        <TripHead job={job} step={1} tag={<Pill tone="accent">TRY {Math.max(1, job.attemptCount)} OF {max}</Pill>} />
        <CustomerCard job={job} />
        <MoneyBox job={job} />
        <BagList job={job} />
      </Page>
      <BottomBar>
        <Button href={`/jobs/${job.id}/handover`} iconRight={ArrowRight} className="w-full">
          I&apos;m at the customer — hand over
        </Button>
        <div className="mt-1 grid grid-cols-2">
          <button onClick={() => setFailOpen(true)} className="flex min-h-[44px] items-center justify-center gap-1.5 text-[13px] font-extrabold text-ink-soft">
            <XCircle size={16} /> Couldn&apos;t deliver
          </button>
          <Link href={`/jobs/${job.id}/handover`} className="flex min-h-[44px] items-center justify-center gap-1.5 text-[13px] font-extrabold text-danger">
            <Ban size={16} /> Customer refused
          </Link>
        </div>
      </BottomBar>
      <FailSheet job={job} open={failOpen} onClose={() => setFailOpen(false)} onDone={onChange} toast={toast} />
    </>
  );
}

function FailSheet({ job, open, onClose, onDone, toast }: { job: JobDetail; open: boolean; onClose: () => void; onDone: () => void; toast: ViewProps["toast"] }) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const max = job.proofRules?.maxAttempts ?? 2;
  const thisTry = Math.max(1, job.attemptCount);
  const last = thisTry >= max;

  async function submit() {
    if (!reason) return setErr("Choose what happened");
    if (reason === "other" && !notes.trim()) return setErr("Write a short note for the office");
    setBusy(true);
    setErr(null);
    try {
      const r = await failJob(job.id, { reason, notes: notes.trim() || undefined });
      toast(r.mustReturn ? "No tries left — take everything back to the shops" : "Reported — everything stays with you", r.mustReturn ? "danger" : "brand");
      onClose();
      onDone();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="What happened?"
      subtitle={`Why couldn't you deliver trip ${job.jobNumber}?`}
      footer={
        <>
          <InlineError message={err} />
          <Button onClick={submit} loading={busy} disabled={!reason} icon={XCircle} className="mt-2 w-full">
            Report couldn&apos;t deliver
          </Button>
          <button onClick={onClose} className="mt-1 min-h-[44px] w-full text-[13px] font-bold text-ink-muted">
            Back to the trip
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        {JOB_FAILURE_REASONS.map((r) => (
          <ChoiceRow key={r.value} selected={reason === r.value} onClick={() => setReason(r.value)} icon={FAIL_ICONS[r.value]} title={r.label} sub={r.hint} />
        ))}
      </div>
      <label className="mt-4 block text-[12.5px] font-extrabold text-ink">
        Note for the office <span className="font-semibold text-ink-faint">{reason === "other" ? "(needed)" : "(optional)"}</span>
      </label>
      <textarea
        className={`${INPUT} mt-2 min-h-[84px] resize-none`}
        placeholder="e.g. Gate locked, guard says the customer is back at 4 PM"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className={`mt-3 flex items-start gap-2.5 rounded-2xl p-3.5 ${last ? "bg-danger-light" : "bg-surface-sunken"}`}>
        <Clock size={16} className={`mt-0.5 shrink-0 ${last ? "text-danger" : "text-ink-muted"}`} />
        <p className={`text-[12px] leading-snug ${last ? "font-bold text-danger" : "text-ink-soft"}`}>
          This is try {thisTry} of {max}.{" "}
          {last
            ? "It's the last one — after this you take everything back to the shops."
            : "Everything stays with you. You can try again later, or the office will give a new time."}
        </p>
      </div>
    </Sheet>
  );
}

/* ── 3. failed, can try again ───────────────────────────────────────── */

function FailedView({ job, onChange, onReturn, toast }: ViewProps & { onReturn: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const max = job.proofRules?.maxAttempts ?? 2;
  const live = job.stops.filter((s) => s.status === "COLLECTED");
  const total = live.reduce((t, s) => t + s.money.total, 0);

  async function retry() {
    setBusy(true);
    setErr(null);
    try {
      await startJob(job.id);
      toast("You're on the way again");
      onChange();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Page bottom="bar">
        <div className="rounded-[22px] bg-danger-light p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-danger text-white">
              <XCircle size={21} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-danger px-2 py-0.5 text-[10px] font-extrabold text-white">
                  TRY {job.attemptCount}/{max}
                </span>
                <span className="text-[11.5px] font-bold text-danger">{timeOf(job.timestamps.failedAt)}</span>
              </div>
              <p className="mt-1 text-[17px] font-extrabold text-danger-deep">{reasonLabel(job.lastFailureReason) || "Couldn't deliver"}</p>
              <p className="mt-0.5 text-[12.5px] leading-snug text-danger">Everything is still with you. Try again, or take it back to the shops.</p>
            </div>
          </div>
        </div>

        <Card>
          <Label>
            <span className="flex items-center gap-1.5">
              <CalendarClock size={13} /> From the office
            </span>
          </Label>
          {job.retryAt ? (
            <div className="mt-3 rounded-2xl bg-surface-sunken p-3.5">
              <p className="text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-brand-tint">New delivery time</p>
              <p className="mt-1 text-[20px] font-extrabold text-ink">{longDateTime(job.retryAt)}</p>
              <p className="mt-1 text-[12px] text-ink-muted">The office agreed this time with the customer. Keep the bags safe until then.</p>
            </div>
          ) : (
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">
              No new time yet. Call the customer again — if they are ready, press <b>Try again now</b>. The office may also set a new time; it will show here.
            </p>
          )}
        </Card>

        <CustomerCard job={job} title="The customer" />

        <Card>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[15px] font-extrabold text-ink">
              <ShoppingBag size={17} /> In your bag
            </span>
            <Pill tone="muted">
              {live.length} shop{live.length === 1 ? "" : "s"}
            </Pill>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {live.map((s, i) => (
              <div key={s.id} className="flex items-center gap-3 rounded-2xl bg-surface-sunken px-3.5 py-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-light text-[11px] font-extrabold text-brand">#{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-extrabold text-ink">{s.shop.name}</p>
                  <p className="truncate text-[11px] text-ink-muted">{s.orderNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-[14px] font-extrabold text-ink">{money(s.money.total)}</p>
                  <p className="text-[10px] font-bold text-ink-faint">{stopCash(s) ? "CASH" : "PAID"}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-line pt-3">
            <MoneyLine label="Value in your bag" value={total} bold />
          </div>
        </Card>
        <InlineError message={err} />
      </Page>
      <BottomBar>
        <Button onClick={retry} loading={busy} icon={RefreshCw} className="w-full">
          Try again now
        </Button>
        <div className="mt-1 grid grid-cols-2">
          <button onClick={onReturn} className="flex min-h-[44px] items-center justify-center gap-1.5 text-[13px] font-extrabold text-ink-soft">
            <Undo2 size={16} /> Return to shops
          </button>
          <Link href={`/jobs/${job.id}/handover`} className="flex min-h-[44px] items-center justify-center gap-1.5 text-[13px] font-extrabold text-danger">
            <Ban size={16} /> Customer refused
          </Link>
        </div>
      </BottomBar>
    </>
  );
}

/* ── 4. take everything back to the shops ───────────────────────────── */

function ReturnView(props: ViewProps & { onCancel?: () => void }) {
  return props.job.door ? <StoreView job={props.job} /> : <ShopReturnView {...props} />;
}

/** A trip refused on the door screen: the items go to the Bakhaar store. */
function StoreView({ job }: { job: JobDetail }) {
  const left = job.door?.goodsWithDriver ?? 0;
  return (
    <Page bottom="bar">
      <div className={`rounded-[22px] p-4 ${left > 0 ? "bg-danger text-white" : "bg-brand-mint text-brand"}`}>
        <div className="flex items-start gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${left > 0 ? "bg-white/20" : "bg-white"}`}>
            {left > 0 ? <Undo2 size={21} /> : <Check size={21} />}
          </div>
          <div>
            <p className="text-[17px] font-extrabold leading-snug">{left > 0 ? "Take the refused items to the Bakhaar store" : "The store has everything"}</p>
            <p className={`mt-1 text-[12.5px] leading-snug ${left > 0 ? "text-white/85" : "text-brand-tint"}`}>
              {left > 0
                ? `${left} item line${left === 1 ? "" : "s"} still with you. The store checks them and records them — not the shops.`
                : "Nothing left to bring from this trip."}
              {left > 0 && (job.door?.payWaiting ?? 0) > 0 ? ` Your ${money(job.door?.payWaiting ?? 0)} for this trip is added then.` : ""}
            </p>
          </div>
        </div>
      </div>
      <BottomBar>
        <Button href="/store" icon={ShoppingBag} className="w-full">My items for the store</Button>
      </BottomBar>
    </Page>
  );
}

function ShopReturnView({ job, onChange, onCancel, toast }: ViewProps & { onCancel?: () => void }) {
  const stops = job.stops.filter((s) => s.status !== "MOVED" && s.status !== "DELIVERED");
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const done = stops.filter((s) => ticked[s.id]).length;
  const all = stops.length > 0 && done === stops.length;
  const max = job.proofRules?.maxAttempts ?? 2;
  const refusal = job.refusal;

  async function finish() {
    setBusy(true);
    setErr(null);
    try {
      await returnJob(job.id, { notes: `Returned to ${stops.map((s) => s.shop.name).join(", ")}` });
      toast("Return recorded — thank you");
      onChange();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const title =
    job.status === "CANCELLED"
      ? "Refused — return everything to the shops"
      : job.mustReturn
        ? "No tries left — return everything to the shops"
        : "Return everything to the shops";
  const text =
    job.status === "CANCELLED"
      ? refusal?.fault === "shop"
        ? "The customer refused because of the shop. Take every bag back — the shops check them."
        : refusal?.feeCollected
          ? `The customer refused. You took the ${money(refusal.feeCollected)} delivery fee — hand it in with your cash.`
          : "The customer refused. Take every bag back so the shops can check them."
      : job.mustReturn
        ? `${job.attemptCount} of ${max} delivery tries failed. Every bag must go back to its shop.`
        : "Every bag goes back to its shop. The office will be told.";

  return (
    <>
      <Page bottom="bar">
        <div className="rounded-[22px] bg-danger p-4 text-white">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
              <Undo2 size={21} />
            </div>
            <div>
              <p className="text-[17px] font-extrabold leading-snug">{title}</p>
              <p className="mt-1 text-[12.5px] leading-snug text-white/85">{text}</p>
            </div>
          </div>
        </div>

        <Card className="flex items-center gap-3 py-3.5">
          <RotateCcw size={18} className="text-ink-soft" />
          <span className="flex-1 text-[13.5px] font-extrabold text-ink">Return progress</span>
          <Pill tone={all ? "brand" : "muted"}>
            {done} of {stops.length} shops returned
          </Pill>
        </Card>

        <Label right={<span className="text-[11px] font-bold text-ink-faint">Tick each shop when they have their bag</span>}>Shops</Label>
        {stops.map((s) => (
          <Card key={s.id} className={ticked[s.id] ? "ring-2 ring-brand/30" : ""}>
            <button onClick={() => setTicked((t) => ({ ...t, [s.id]: !t[s.id] }))} className="flex w-full items-start gap-3 text-left">
              <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 ${ticked[s.id] ? "border-brand bg-brand text-white" : "border-ink-faint/50"}`}>
                {ticked[s.id] && <Check size={14} strokeWidth={3} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[16px] font-extrabold text-ink">{s.shop.name}</span>
                  <Pill tone={ticked[s.id] ? "brand" : "accent"}>{ticked[s.id] ? "Returned" : "To return"}</Pill>
                </div>
                <p className="text-[12px] text-ink-muted">{s.shop.location ?? "No address on file"}</p>
              </div>
            </button>
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-surface-sunken px-3 py-2.5 text-[12px] text-ink-soft">
              <Store size={14} className="shrink-0" />
              <span className="truncate">{itemsLine(s)}</span>
              <span className="ml-auto shrink-0 text-[11px] font-bold text-ink-faint">{s.orderNumber}</span>
            </div>
            <div className="mt-3">
              <CallNav phone={s.shop.phone} place={[s.shop.name, s.shop.location]} callLabel="Call shop" size="sm" primary="call" />
            </div>
          </Card>
        ))}

        <div className="flex items-start gap-3 rounded-[22px] bg-accent-light/70 p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-accent-tint" />
          <p className="text-[12.5px] leading-snug text-accent-deep">
            Give each bag to the shop by hand and let them check it. Don&apos;t leave bags with anyone else.
          </p>
        </div>
        <InlineError message={err} />
      </Page>
      <BottomBar>
        <Button onClick={finish} loading={busy} disabled={!all} icon={CheckCircle2} className="w-full">
          {all ? "I returned everything" : `Tick ${stops.length - done} more shop${stops.length - done === 1 ? "" : "s"}`}
        </Button>
        {onCancel ? (
          <button onClick={onCancel} className="mt-1 min-h-[44px] w-full text-[13px] font-bold text-ink-muted">
            Back — I&apos;ll try again instead
          </button>
        ) : OFFICE_PHONE ? (
          <a href={telHref(OFFICE_PHONE)} className="mt-1 flex min-h-[44px] items-center justify-center gap-1.5 text-[13px] font-bold text-ink-muted">
            <Headphones size={15} /> A problem? Call the office
          </a>
        ) : (
          <div className="h-2" />
        )}
      </BottomBar>
    </>
  );
}

/* ── 5. finished ────────────────────────────────────────────────────── */

function DoneView({ job }: { job: JobDetail }) {
  const delivered = job.status === "DELIVERED";
  const refusedStops = job.stops.filter((s) => s.status === "REFUSED");
  const at = job.timestamps.deliveredAt ?? job.timestamps.returnedAt ?? job.timestamps.cancelledAt;
  return (
    <Page bottom="none">
      <Card className="flex flex-col items-center py-6 text-center">
        <div className={`flex h-16 w-16 items-center justify-center rounded-full ${delivered ? "bg-brand text-white" : "bg-surface-sunken text-ink-muted"}`}>
          {delivered ? <CheckCircle2 size={30} /> : <Undo2 size={28} />}
        </div>
        <p className="mt-3 text-[20px] font-extrabold text-ink">{delivered ? "Delivered" : job.status === "RETURNED" ? "Returned to the shops" : job.statusLabel}</p>
        <p className="text-[12.5px] text-ink-muted">
          {job.customer.name} · {dateTime(at)}
        </p>
      </Card>

      <Card>
        <Label className="mb-2">Summary</Label>
        <div className="flex flex-col gap-2">
          {job.refusal && (
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-ink-muted">Refused at the door</span>
              <span className="font-bold text-ink">{job.refusal.fault === "shop" ? "Shop's fault" : "Customer's choice"}</span>
            </div>
          )}
          {job.refusal && job.refusal.feeCollected > 0 && (
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-ink-muted">Delivery fee you took</span>
              <span className="font-bold text-ink">{money(job.refusal.feeCollected)}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-ink-muted">You earned</span>
            <span className="font-extrabold text-brand-tint">{(job.driverPay ?? 0) > 0 ? `+${money(job.driverPay)}` : "—"}</span>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-ink-muted">Shops</span>
            <span className="font-bold text-ink">{job.stops.filter((s) => s.status !== "MOVED").length}</span>
          </div>
        </div>
      </Card>

      {refusedStops.length > 0 && (
        <div className="flex items-start gap-3 rounded-[22px] bg-accent-light p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-accent-tint" />
          <p className="text-[12.5px] leading-snug text-accent-deep">
            Take back to the shop: <b>{refusedStops.map((s) => s.shop.name).join(", ")}</b>. The customer refused {refusedStops.length === 1 ? "it" : "them"}.
          </p>
        </div>
      )}

      <Card>
        <Label className="mb-2">Shops</Label>
        <div className="flex flex-col gap-2">
          {job.stops
            .filter((s) => s.status !== "MOVED")
            .map((s: JobStop) => (
              <div key={s.id} className="flex items-center gap-3 rounded-2xl bg-surface-sunken px-3.5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-extrabold text-ink">{s.shop.name}</p>
                  <p className="truncate text-[11.5px] text-ink-muted">{itemsLine(s)}</p>
                </div>
                <Pill tone={s.status === "DELIVERED" ? "brand" : s.status === "REFUSED" ? "danger" : "muted"}>{s.statusLabel}</Pill>
              </div>
            ))}
        </div>
      </Card>

      {job.history.length > 0 && (
        <Card>
          <Label className="mb-3">What happened</Label>
          <ol className="flex flex-col gap-3">
            {job.history.map((h) => (
              <li key={h.id} className="flex gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-ink">{h.toLabel}</p>
                  <p className="text-[11.5px] text-ink-muted">
                    {dateTime(h.at)}
                    {h.byName ? ` · ${h.byName}` : ""}
                  </p>
                  {h.notes && <p className="mt-0.5 text-[11.5px] text-ink-soft">{h.notes}</p>}
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <Button href="/jobs" variant="outline" className="w-full">
        Back to my trips
      </Button>
    </Page>
  );
}