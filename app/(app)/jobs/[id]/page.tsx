// app/(app)/jobs/[id]/page.tsx
//
// One trip, from the driver's hands.
//
// The screen follows the job in the order it actually happens:
//
//   1. COLLECT   tick each shop as you pick its bag up. The "I'm on my
//                way" button stays locked until every shop is ticked —
//                that is the guard against setting off having forgotten
//                one of this customer's bags. The backend refuses it too,
//                so a stale screen cannot get round it.
//
//   2. TRAVEL    one customer, one address, one amount. The customer's
//                details are written once, because there is one customer
//                — whatever the number of shops behind the trip.
//
//   3. THE DOOR  say what the customer actually took. Anything they
//                refuse is cancelled: not delivered, NOT PAID, and still
//                in your hands to take back. The cash figure is worked
//                out by the backend from what was accepted, so it can
//                never be more than the customer actually owes.
"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Ban, Banknote, Check, CheckCircle2, ChevronDown, ChevronUp,
  MapPin, Navigation, Phone, RotateCcw, Store, Truck, XCircle,
} from "lucide-react";
import {
  getJob, collectStop, uncollectStop, startJob, completeJob, failJob, cancelJob, returnJob,
  jobStyle, stopStyle, JOB_FAILURE_REASONS, JOB_CANCEL_REASONS,
  type JobDetail,
} from "@/lib/jobs";
import { ApiError } from "@/lib/api";
import {
  Button, Card, ConfirmSheet, ErrorState, LoadingState, PageHeader, Row, Toast, dateTime, money,
} from "@/components/ui";

type Sheet = "none" | "deliver" | "fail" | "cancel" | "return";

export default function JobPage() {
  const params = useParams<{ id: string }>();
  const jobId = params?.id;

  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  const [sheet, setSheet] = useState<Sheet>("none");
  const [openShop, setOpenShop] = useState<string | null>(null);

  /** At the door: which shops the customer actually took. */
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [cashConfirmed, setCashConfirmed] = useState(false);
  const [refusedReason, setRefusedReason] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      const detail = await getJob(jobId);
      setJob(detail);
      // Default at the door: the customer took everything. The driver
      // only has to touch this when something is handed back.
      setAccepted(new Set(detail.stops.filter((s) => s.status === "COLLECTED").map((s) => s.id)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load this trip");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  function fail(err: unknown) {
    setToast({
      tone: "error",
      message: err instanceof ApiError ? err.message : "Something went wrong",
    });
  }

  async function run(fn: () => Promise<{ message?: string }>, closeSheet = true) {
    setBusy(true);
    try {
      const result = await fn();
      if (closeSheet) setSheet("none");
      if (result?.message) setToast({ tone: "success", message: result.message });
      await load();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingState label="Loading the trip…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!job) return null;

  const style = jobStyle(job.status);
  const collecting = job.status === "ASSIGNED";
  const travelling = job.status === "ON_THE_WAY";
  const failedNow = job.status === "FAILED";
  const finished = ["DELIVERED", "CANCELLED", "RETURNED"].includes(job.status);
  const left = job.progress.shopCount - job.progress.collectedCount;

  // What the customer owes for what they are actually taking. Shown so
  // the driver knows the figure BEFORE they knock; the backend works out
  // the real one from the same rule, so the two always agree.
  const carried = job.stops.filter((s) => s.status === "COLLECTED");
  const takingNow = carried.filter((s) => accepted.has(s.id));
  const cashDue = takingNow
    .filter((s) => s.money.isCod && !s.money.isPaid)
    .reduce((sum, s) => sum + s.money.total, 0);
  const refusedCount = carried.length - takingNow.length;

  return (
    <>
      <PageHeader
        title={job.jobNumber}
        subtitle={`${job.progress.shopCount} shop${job.progress.shopCount === 1 ? "" : "s"} · ${job.totalItems} item${job.totalItems === 1 ? "" : "s"} · one customer`}
        back="/jobs"
        right={
          <span
            className="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-extrabold"
            style={{ background: style.bg, color: style.fg }}
          >
            {style.label}
          </span>
        }
      />

      {/* ══ 1. THE SHOPS ══ */}
      <Card
        title={collecting ? `Collect from ${job.progress.shopCount} shop${job.progress.shopCount === 1 ? "" : "s"}` : "Shops on this trip"}
        icon={<Store className="h-4 w-4 text-brand" />}
        className="mb-3"
      >
        {collecting && (
          <p className="mb-3 rounded-xl bg-surface-sunken px-3 py-2 text-[12px] leading-[1.6] text-ink-muted">
            Tap each shop as you pick its bag up.{" "}
            {left > 0 ? (
              <strong className="text-accent">
                {left} left — you can&apos;t set off until they&apos;re all in.
              </strong>
            ) : (
              <strong className="text-[#2C6B44]">All in your bag. You&apos;re ready to go.</strong>
            )}
          </p>
        )}

        <div className="flex flex-col gap-2.5">
          {job.stops.map((stop, i) => {
            const sStyle = stopStyle(stop.status);
            const inBag = stop.status === "COLLECTED";
            const canTick = collecting && (stop.status === "READY" || inBag);
            const open = openShop === stop.id;

            return (
              <div
                key={stop.id}
                className="rounded-2xl border p-3"
                style={{ borderColor: inBag ? "#CBE5D4" : "#EEF0F5", background: inBag ? "#F7FCF9" : "#FFF" }}
              >
                <div className="flex items-start gap-2.5">
                  {/* the tick */}
                  {canTick ? (
                    <button
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => (inBag ? uncollectStop(job.id, stop.id) : collectStop(job.id, stop.id)),
                          false
                        )
                      }
                      aria-label={inBag ? `Undo ${stop.shop.name}` : `Collected from ${stop.shop.name}`}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 transition-colors disabled:opacity-50"
                      style={{
                        borderColor: inBag ? "#2C6B44" : "#D6DAE2",
                        background: inBag ? "#2C6B44" : "#FFF",
                      }}
                    >
                      {inBag ? (
                        <Check className="h-5 w-5 text-white" />
                      ) : (
                        <span className="text-[14px] font-extrabold text-ink-faint">{i + 1}</span>
                      )}
                    </button>
                  ) : (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-sunken text-[14px] font-extrabold text-ink-faint">
                      {i + 1}
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[13.5px] font-extrabold text-ink">{stop.shop.name}</span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[9.5px] font-extrabold"
                        style={{ background: sStyle.bg, color: sStyle.fg }}
                      >
                        {sStyle.label}
                      </span>
                    </div>
                    {stop.shop.location && (
                      <div className="mt-0.5 flex items-center gap-1 text-[12px] text-ink-muted">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {stop.shop.location}
                      </div>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      {stop.shop.phone ? (
                        <a
                          href={`tel:${stop.shop.phone}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-brand-light px-2 py-1 text-[12px] font-bold text-brand"
                        >
                          <Phone className="h-3 w-3" />
                          Call the shop
                        </a>
                      ) : (
                        <span className="text-[11px] text-ink-faint">No number on file</span>
                      )}
                      <button
                        onClick={() => setOpenShop(open ? null : stop.id)}
                        className="inline-flex items-center gap-1 text-[12px] font-bold text-ink-soft"
                      >
                        {stop.itemCount} item{stop.itemCount === 1 ? "" : "s"}
                        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>
                </div>

                {stop.refusedReason && (
                  <p className="mt-2 rounded-xl bg-[#FDEAEA] px-3 py-2 text-[11.5px] font-semibold text-[#C4362A]">
                    Refused at the door — {stop.refusedReason}
                  </p>
                )}

                {open && (
                  <div className="mt-2.5 flex flex-col divide-y divide-line-soft border-t border-line-soft pt-1">
                    {stop.items.length === 0 ? (
                      <p className="py-2 text-[12px] text-ink-faint">No items recorded.</p>
                    ) : (
                      stop.items.map((item) => (
                        <div key={item.id} className="flex items-center gap-2 py-2">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[12.5px] font-semibold text-ink">
                              {item.productName}
                            </div>
                            {item.variantLabel && (
                              <div className="text-[11px] text-ink-faint">{item.variantLabel}</div>
                            )}
                          </div>
                          <span className="shrink-0 text-[12px] font-bold text-ink-soft">
                            × {item.quantity}
                          </span>
                        </div>
                      ))
                    )}
                    <div className="pt-2 text-[11px] text-ink-faint">
                      Order {stop.orderNumber} · {money(stop.money.productTotal)} of goods
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* ══ 2. THE CUSTOMER — written once ══ */}
      <Card title="The customer" icon={<Navigation className="h-4 w-4 text-brand" />} className="mb-3">
        <div className="text-[15px] font-extrabold text-ink">{job.customer.name}</div>
        <div className="mt-1 flex items-start gap-1.5 text-[13px] text-ink-soft">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" />
          <span>
            {job.customer.address || "No address given"}
            {job.customer.landmark ? ` — ${job.customer.landmark}` : ""}
          </span>
        </div>
        {(job.customer.district || job.customer.area) && (
          <div className="mt-0.5 pl-5 text-[12px] text-ink-faint">
            {[job.customer.district, job.customer.area].filter(Boolean).join(" · ")}
          </div>
        )}
        {job.customer.notes && (
          <p className="mt-2 rounded-xl bg-surface-sunken px-3 py-2 text-[12.5px] leading-[1.6] text-ink-soft">
            “{job.customer.notes}”
          </p>
        )}
        <a
          href={`tel:${job.customer.phone}`}
          className="mt-3 flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-line bg-white text-[14px] font-bold text-brand active:bg-surface-sunken"
        >
          <Phone className="h-4 w-4" />
          Call {job.customer.phone}
        </a>
      </Card>

      {/* ══ THE MONEY ══ */}
      <Card title="The money" icon={<Banknote className="h-4 w-4 text-brand" />} className="mb-3">
        <Row label="Goods" value={money(job.money.productTotal)} />
        <Row
          label={job.progress.shopCount > 1 ? `Delivery (one fee, ${job.progress.shopCount} shops)` : "Delivery"}
          value={money(job.money.deliveryFee)}
        />
        <div className="mt-2 border-t border-line-soft pt-2">
          {job.money.amountToCollect > 0 ? (
            <div className="rounded-2xl bg-[#FFF6EC] p-3.5 text-center">
              <div className="text-[11px] font-extrabold uppercase tracking-wide text-accent">
                Collect at the door
              </div>
              <div className="mt-0.5 text-[30px] font-extrabold leading-none text-ink">
                {money(job.money.amountToCollect)}
              </div>
              <div className="mt-1 text-[11.5px] text-ink-muted">
                cash — goods plus the delivery fee
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-[#EAF7EE] p-3.5 text-center">
              <div className="text-[11px] font-extrabold uppercase tracking-wide text-[#2C6B44]">
                Already paid
              </div>
              <div className="mt-0.5 text-[13px] font-bold text-ink">
                Paid by Zaad / eDahab — take no money
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* ══ WHAT TO DO NEXT ══ */}
      {!finished && (
        <div className="flex flex-col gap-2.5 pb-2">
          {collecting && (
            <>
              <Button
                disabled={left > 0 || busy}
                loading={busy}
                onClick={() => run(() => startJob(job.id), false)}
              >
                <Truck className="h-4 w-4" />
                {left > 0 ? `Collect ${left} more shop${left === 1 ? "" : "s"} first` : "I have everything — on my way"}
              </Button>
              {left > 0 && (
                <p className="px-2 text-center text-[11.5px] leading-[1.6] text-ink-faint">
                  Setting off without a shop&apos;s bag means going back for it. Tick them all first.
                </p>
              )}
            </>
          )}

          {travelling && (
            <>
              <Button onClick={() => setSheet("deliver")}>
                <CheckCircle2 className="h-4 w-4" />
                I&apos;m at the customer
              </Button>
              <Button tone="secondary" onClick={() => setSheet("fail")}>
                <XCircle className="h-4 w-4" />
                Couldn&apos;t deliver
              </Button>
              <Button tone="danger" onClick={() => setSheet("cancel")}>
                <Ban className="h-4 w-4" />
                Customer refused everything
              </Button>
            </>
          )}

          {failedNow && (
            <>
              <Button onClick={() => run(() => startJob(job.id), false)} loading={busy}>
                <Truck className="h-4 w-4" />
                Try again
              </Button>
              <Button tone="danger" onClick={() => setSheet("return")}>
                <RotateCcw className="h-4 w-4" />
                Take it back to the shops
              </Button>
            </>
          )}
        </div>
      )}

      {finished && (
        <Card className="mb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: style.fg }} />
            <div>
              <div className="text-[13.5px] font-extrabold text-ink">{style.label}</div>
              <div className="text-[12px] text-ink-muted">
                {dateTime(
                  job.timestamps.deliveredAt ??
                    job.timestamps.cancelledAt ??
                    job.timestamps.returnedAt ??
                    job.updatedAt
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ══ 3. THE DOOR ══ */}
      {sheet === "deliver" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => !busy && setSheet("none")} />
          <div className="relative max-h-[90vh] w-full max-w-[480px] overflow-y-auto rounded-t-3xl bg-white p-5 pb-8">
            <h3 className="mb-1 text-[17px] font-extrabold text-ink">What did they take?</h3>
            <p className="mb-3 text-[12.5px] leading-[1.6] text-ink-muted">
              Untick anything the customer hands back. Whatever you untick is{" "}
              <strong className="text-[#C4362A]">cancelled and not paid for</strong>, and stays with
              you to take back to the shop.
            </p>

            <div className="flex flex-col gap-2">
              {carried.map((stop) => {
                const taking = accepted.has(stop.id);
                return (
                  <button
                    key={stop.id}
                    onClick={() =>
                      setAccepted((prev) => {
                        const next = new Set(prev);
                        if (next.has(stop.id)) next.delete(stop.id);
                        else next.add(stop.id);
                        return next;
                      })
                    }
                    className="flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition-colors"
                    style={{
                      borderColor: taking ? "#2C6B44" : "#F4C7C2",
                      background: taking ? "#F7FCF9" : "#FFF6F5",
                    }}
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: taking ? "#2C6B44" : "#FDEAEA" }}
                    >
                      {taking ? (
                        <Check className="h-[18px] w-[18px] text-white" />
                      ) : (
                        <XCircle className="h-[18px] w-[18px] text-[#C4362A]" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-extrabold text-ink">{stop.shop.name}</div>
                      <div className="text-[11.5px] text-ink-muted">
                        {stop.itemCount} item{stop.itemCount === 1 ? "" : "s"} ·{" "}
                        {money(stop.money.total)}
                        {stop.money.isPaid ? " · already paid" : ""}
                      </div>
                    </div>
                    <span
                      className="shrink-0 text-[11px] font-extrabold"
                      style={{ color: taking ? "#2C6B44" : "#C4362A" }}
                    >
                      {taking ? "TAKING" : "REFUSED"}
                    </span>
                  </button>
                );
              })}
            </div>

            {refusedCount > 0 && (
              <div className="mt-3">
                <label className="text-[12px] font-bold text-ink">
                  Why did they refuse {refusedCount === 1 ? "it" : "them"}?
                </label>
                <select
                  value={refusedReason}
                  onChange={(e) => setRefusedReason(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-3 text-[13px] text-ink"
                >
                  <option value="">Choose a reason…</option>
                  {JOB_CANCEL_REASONS.map((r) => (
                    <option key={r.value} value={r.label}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* The cash, worked out from what they are actually taking. */}
            <div className="mt-4 rounded-2xl p-4" style={{ background: cashDue > 0 ? "#FFF6EC" : "#EAF7EE" }}>
              {cashDue > 0 ? (
                <>
                  <div className="text-[11px] font-extrabold uppercase tracking-wide text-accent">
                    Take from the customer
                  </div>
                  <div className="text-[30px] font-extrabold leading-none text-ink">
                    {money(cashDue)}
                  </div>
                  {refusedCount > 0 && (
                    <div className="mt-1 text-[11.5px] font-semibold text-[#8A5A2B]">
                      Less than the full basket — they are not paying for what they refused.
                    </div>
                  )}
                  <button
                    onClick={() => setCashConfirmed((v) => !v)}
                    className="mt-3 flex w-full items-center gap-2.5 rounded-xl bg-white p-3 text-left"
                  >
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2"
                      style={{
                        borderColor: cashConfirmed ? "#2C6B44" : "#D6DAE2",
                        background: cashConfirmed ? "#2C6B44" : "#FFF",
                      }}
                    >
                      {cashConfirmed && <Check className="h-3.5 w-3.5 text-white" />}
                    </span>
                    <span className="text-[12.5px] font-bold text-ink">
                      I have the {money(cashDue)} in my hand
                    </span>
                  </button>
                </>
              ) : (
                <div className="text-center">
                  <div className="text-[11px] font-extrabold uppercase tracking-wide text-[#2C6B44]">
                    Nothing to collect
                  </div>
                  <div className="mt-0.5 text-[12.5px] font-semibold text-ink">
                    This part is already paid. Take no money.
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-2.5">
              <Button
                loading={busy}
                disabled={
                  busy ||
                  takingNow.length === 0 ||
                  (cashDue > 0 && !cashConfirmed) ||
                  (refusedCount > 0 && !refusedReason)
                }
                onClick={() =>
                  run(() =>
                    completeJob(job.id, {
                      acceptedStopIds: Array.from(accepted),
                      cashCollected: cashDue > 0 ? cashConfirmed : undefined,
                      refusedReason: refusedReason || undefined,
                    })
                  )
                }
              >
                <CheckCircle2 className="h-4 w-4" />
                {takingNow.length === carried.length
                  ? "Delivered — finish the trip"
                  : `Delivered ${takingNow.length} of ${carried.length} shops`}
              </Button>
              {takingNow.length === 0 && (
                <p className="px-2 text-center text-[11.5px] leading-[1.6] text-[#C4362A]">
                  They took nothing. Go back and use “Customer refused everything” instead.
                </p>
              )}
              <Button tone="ghost" onClick={() => setSheet("none")} disabled={busy}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Couldn't deliver ── */}
      <ConfirmSheet
        open={sheet === "fail"}
        title="Couldn't deliver"
        tone="danger"
        loading={busy}
        confirmLabel="Report it"
        onCancel={() => setSheet("none")}
        onConfirm={() => run(() => failJob(job.id, { reason, notes: notes || undefined }))}
        body={
          <div className="flex flex-col gap-2">
            <p>
              Everything stays with you and nothing is marked delivered. You can try again later.
            </p>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-xl border border-line bg-white px-3 py-3 text-[13px] text-ink"
            >
              <option value="">Choose a reason…</option>
              {JOB_FAILURE_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Anything the office should know (optional)"
              className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[13px] text-ink"
            />
          </div>
        }
      />

      {/* ── Customer refused everything ── */}
      <ConfirmSheet
        open={sheet === "cancel"}
        title="Customer refused everything"
        tone="danger"
        loading={busy}
        confirmLabel="Yes — the sale is off"
        onCancel={() => setSheet("none")}
        onConfirm={() => run(() => cancelJob(job.id, { reason, notes: notes || undefined }))}
        body={
          <div className="flex flex-col gap-2">
            <p className="font-semibold text-[#C4362A]">
              This ends the whole basket. Nothing is delivered, nothing is paid, and you take it all
              back to the shops.
            </p>
            <p>If they only refused part of it, go back and use “I&apos;m at the customer” instead.</p>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-xl border border-line bg-white px-3 py-3 text-[13px] text-ink"
            >
              <option value="">Choose a reason…</option>
              {JOB_CANCEL_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        }
      />

      {/* ── Returned ── */}
      <ConfirmSheet
        open={sheet === "return"}
        title="Back with the shops?"
        tone="danger"
        loading={busy}
        confirmLabel="Yes, I gave it back"
        onCancel={() => setSheet("none")}
        onConfirm={() => run(() => returnJob(job.id, { notes: notes || undefined }))}
        body="Only confirm this once the goods are physically back with the shops. The office sees this trip as closed afterwards."
      />

      {toast && (
        <Toast tone={toast.tone} message={toast.message} onClose={() => setToast(null)} />
      )}
    </>
  );
}