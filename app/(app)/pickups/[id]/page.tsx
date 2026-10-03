// app/(app)/pickups/[id]/page.tsx — one return pickup.
//
//   Step 1  go to the customer, check the item matches the return → "I have the item"
//   Step 2  take it to the shop → "I gave it to the shop"
//   Done    what you earned, and what's left
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle, ArrowRight, Check, CheckCircle2, ClipboardCheck, Clock, Lock, MapPin, Phone, Store, Truck, Wallet, XCircle,
} from "lucide-react";
import { errorText, useAsync } from "@/lib/driver";
import { fileUrl } from "@/lib/jobs";
import { getEarnings, getPickup, getPickups, handedToShop, pickedUp, pickupFailed, PICKUP_FAIL_REASONS, type PickupDetail } from "@/lib/pickups";
import { dateTime, money, telHref, timeOf } from "@/lib/format";
import {
  BackBar, BottomBar, Button, CallNav, Card, CheckRow, ChoiceRow, ErrorState, FullLoader, InlineError, Page, Pill, Sheet, useToast,
} from "@/components/ui";

export default function PickupPage() {
  const { id } = useParams<{ id: string }>();
  const { data: p, loading, error, reload, refresh } = useAsync(() => getPickup(id), [id]);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [failOpen, setFailOpen] = useState(false);
  const toast = useToast();

  if (loading && !p) return <FullLoader label="Opening the pickup…" />;
  if (error && !p)
    return (
      <>
        <BackBar title="Return pickup" href="/pickups" />
        <Page bottom="none">
          <ErrorState message={error} onRetry={reload} />
        </Page>
      </>
    );
  if (!p) return null;
  if (p.status === "DELIVERED") return <Completed p={p} />;

  const step = p.status === "PICKED_UP" ? 2 : 1;

  async function act(fn: () => Promise<unknown>, msg: string) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      toast.show(msg);
      refresh();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {toast.node}
      <BackBar title={p.returnNumber} kicker="Return pickup" href="/pickups" badge={<Pill tone="violet" dot>RETURN</Pill>} />
      <Page bottom="bar">
        {/* progress */}
        <Card>
          <div className="flex items-center">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[14px] font-extrabold ${step === 1 ? "bg-violet text-white ring-4 ring-violet-light" : "bg-[#22A06B] text-white"}`}>
              {step === 1 ? "1" : <Check size={18} strokeWidth={3} />}
            </span>
            <div className="mx-2 h-1 flex-1 rounded-full bg-line">
              <div className={`h-full rounded-full bg-violet ${step === 2 ? "w-full" : "w-1/2"}`} />
            </div>
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[14px] font-extrabold ${step === 2 ? "bg-violet text-white ring-4 ring-violet-light" : "bg-line text-ink-faint"}`}>2</span>
          </div>
          <div className="mt-2 flex justify-between text-[11.5px] font-bold">
            <span className={step === 1 ? "text-violet-tint" : "text-ink-soft"}>Collect from customer</span>
            <span className={step === 2 ? "text-violet-tint" : "text-ink-faint"}>Give to shop</span>
          </div>
        </Card>

        {p.status === "CANCELLED" && (
          <div className="rounded-[22px] bg-surface-sunken p-4 text-[13px] font-bold text-ink-soft">The office cancelled this pickup. Nothing to do.</div>
        )}
        {p.status === "FAILED" && (
          <div className="flex items-start gap-3 rounded-[22px] bg-accent-light p-4">
            <Clock size={18} className="mt-0.5 shrink-0 text-accent-tint" />
            <div>
              <p className="text-[13.5px] font-extrabold text-accent-deep">
                {p.failureReason ?? "Couldn't collect"} · {timeOf(p.timestamps.failedAt)}
              </p>
              <p className="text-[12px] text-accent-deep/80">Call the customer and try again when they are ready.</p>
            </div>
          </div>
        )}

        {/* step 1: the customer */}
        <Card className={step === 1 ? "" : "opacity-80"}>
          <div className="flex items-center justify-between">
            <span className="rounded-lg bg-violet-light px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-violet-tint">Step 1: Customer</span>
            {step === 2 && <Pill tone="brand">Done</Pill>}
          </div>
          <p className="mt-3 text-[20px] font-extrabold text-ink">{p.customer.name}</p>
          {p.customer.phone && (
            <a href={telHref(p.customer.phone)} className="mt-0.5 flex items-center gap-1.5 text-[13px] font-bold text-ink-soft">
              <Phone size={14} /> {p.customer.phone}
            </a>
          )}
          <div className="mt-3 flex items-start gap-2.5 rounded-2xl bg-surface-sunken p-3.5">
            <MapPin size={17} className="mt-0.5 shrink-0 text-violet" />
            <div>
              <p className="text-[14px] font-extrabold text-ink">{[p.customer.address, p.customer.area].filter(Boolean).join(", ") || "No address given"}</p>
              {p.customer.landmark && <p className="text-[12px] text-ink-muted">Landmark: {p.customer.landmark}</p>}
              {p.customer.city && <p className="text-[12px] text-ink-muted">{p.customer.city}</p>}
            </div>
          </div>
          {step === 1 && (
            <div className="mt-3">
              <CallNav phone={p.customer.phone} place={[p.customer.address, p.customer.area, p.customer.landmark, p.customer.city]} callLabel="Call customer" primary="call" />
            </div>
          )}
          <div className="mt-3 rounded-2xl bg-danger-light/70 p-3.5">
            <p className="flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-danger">
              <AlertTriangle size={13} /> Return reason
            </p>
            <p className="mt-1 text-[16px] font-extrabold text-danger-deep">{p.reasonLabel}</p>
            {p.customerNote && <p className="mt-1 text-[12px] italic leading-snug text-ink-soft">“{p.customerNote}”</p>}
          </div>
        </Card>

        {/* check the item */}
        <Card>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-light text-violet">
              <ClipboardCheck size={19} />
            </span>
            <div>
              <p className="text-[16px] font-extrabold text-ink">Check the item before you take it</p>
              <p className="text-[12px] text-ink-muted">It must be the item in the return, with all its parts.</p>
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {p.items.map((it) => {
              const src = fileUrl(it.imageUrl);
              return (
                <div key={it.id} className="flex items-center gap-3 rounded-2xl bg-surface-sunken p-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white text-ink-faint">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {src ? <img src={src} alt={it.name} className="h-full w-full object-cover" /> : <Store size={22} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-md bg-white px-1.5 py-0.5 text-[10.5px] font-extrabold text-ink-soft">Qty {it.quantity}</span>
                      {it.variant && <span className="rounded-md bg-white px-1.5 py-0.5 text-[10.5px] font-bold text-ink-muted">{it.variant}</span>}
                    </div>
                    <p className="mt-1 truncate text-[14px] font-extrabold text-ink">{it.name}</p>
                    <p className="text-[11px] text-ink-muted">
                      {p.orderNumber} · {p.returnNumber}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          {step === 1 && p.status !== "CANCELLED" && (
            <div className="mt-3">
              <CheckRow
                checked={checked}
                onChange={setChecked}
                tone="violet"
                title="The item matches the return"
                sub={`Checked: it's the right item, the reason (“${p.reasonLabel}”) is true, and nothing is missing.`}
              />
            </div>
          )}
        </Card>

        {/* step 2: the shop */}
        <Card className={step === 2 ? "ring-2 ring-violet/30" : ""}>
          <div className="flex items-center justify-between">
            <span className="rounded-lg bg-surface-sunken px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-ink-soft">Step 2: Give to the shop</span>
            {step === 1 && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-ink-faint">
                <Lock size={12} /> Next
              </span>
            )}
          </div>
          <p className="mt-3 flex items-center gap-2 text-[18px] font-extrabold text-ink">
            <Store size={18} /> {p.shop.name}
          </p>
          <p className="text-[12.5px] text-ink-muted">{p.shop.location ?? "No address on file — call the shop"}</p>
          {step === 2 ? (
            <div className="mt-3">
              <CallNav phone={p.shop.phone} place={[p.shop.name, p.shop.location]} callLabel="Call shop" />
            </div>
          ) : (
            p.shop.phone && (
              <a href={telHref(p.shop.phone)} className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-extrabold text-violet-tint">
                <Phone size={14} /> Call shop
              </a>
            )
          )}
          {p.payOnDone !== undefined && (
            <div className="mt-3 flex items-center gap-2 rounded-2xl bg-brand-light px-3.5 py-3 text-[12.5px] font-bold text-brand-tint">
              <Wallet size={16} /> +{money(p.payOnDone)} for you when the shop has it
            </div>
          )}
        </Card>
        <InlineError message={err} />
      </Page>

      {p.status !== "CANCELLED" && (
        <BottomBar>
          {step === 1 ? (
            <>
              <Button
                onClick={() => act(() => pickedUp(p.id), "Collected — now take it to the shop")}
                loading={busy}
                disabled={!checked}
                variant="violet"
                iconRight={ArrowRight}
                className="w-full"
              >
                I have the item
              </Button>
              {p.status === "ASSIGNED" ? (
                <button onClick={() => setFailOpen(true)} className="mt-1 flex min-h-[44px] w-full items-center justify-center gap-1.5 text-[13px] font-extrabold text-danger">
                  <XCircle size={16} /> Couldn&apos;t collect it
                </button>
              ) : (
                <p className="mt-1.5 pb-1 text-center text-[11.5px] font-semibold text-ink-muted">{checked ? "Next: give it to the shop" : "Tick the check box first"}</p>
              )}
            </>
          ) : (
            <>
              <Button onClick={() => act(() => handedToShop(p.id), "Done — handed to the shop")} loading={busy} icon={CheckCircle2} className="w-full">
                I gave it to the shop
              </Button>
              <p className="mt-1.5 pb-1 text-center text-[11.5px] font-semibold text-ink-muted">Only press this when the shop has the item in their hands.</p>
            </>
          )}
        </BottomBar>
      )}
      <FailSheet open={failOpen} onClose={() => setFailOpen(false)} id={p.id} onDone={() => { toast.show("Reported — you can try again later"); refresh(); }} />
    </>
  );
}

function FailSheet({ open, onClose, id, onDone }: { open: boolean; onClose: () => void; id: string; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      await pickupFailed(id, reason);
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
      title="Couldn't collect it?"
      subtitle="Tell the office what happened. You can try again later."
      footer={
        <>
          <InlineError message={err} />
          <Button onClick={submit} loading={busy} disabled={!reason} variant="danger" className="mt-2 w-full">
            Report it
          </Button>
          <button onClick={onClose} className="mt-1 min-h-[44px] w-full text-[13px] font-bold text-ink-muted">
            Back
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        {PICKUP_FAIL_REASONS.map((r) => (
          <ChoiceRow key={r} selected={reason === r} onClick={() => setReason(r)} title={r} tone="danger" />
        ))}
      </div>
    </Sheet>
  );
}

/* ── done ───────────────────────────────────────────────────────────── */

function Completed({ p }: { p: PickupDetail }) {
  const { data } = useAsync(async () => {
    const [earnings, live] = await Promise.all([getEarnings(), getPickups()]);
    return { today: earnings.pay.today, left: live.filter((x) => x.id !== p.id && x.status !== "DELIVERED" && x.status !== "CANCELLED").length };
  }, [p.id]);
  return (
    <Page bottom="none" className="pt-8">
      <div className="flex flex-col items-center text-center">
        <div className="animate-pop relative flex h-24 w-24 items-center justify-center rounded-full bg-accent text-white shadow-card">
          <Check size={44} strokeWidth={3} />
        </div>
        <span className="mt-4 rounded-full bg-white px-3 py-1 text-[10.5px] font-extrabold tracking-[0.1em] text-ink-muted shadow-card">HANDED TO THE SHOP</span>
        <h1 className="mt-2 text-[26px] font-extrabold text-ink">Return completed!</h1>
        <p className="text-[13px] font-semibold text-ink-soft">
          {p.returnNumber} returned · {dateTime(p.timestamps.deliveredAt)}
        </p>
      </div>

      <div className="rounded-[24px] bg-brand p-4 text-white">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
            <Wallet size={20} />
          </span>
          <div>
            <p className="text-[22px] font-extrabold">+{money(p.driverPay)}</p>
            <p className="text-[12px] text-white/75">Return pickup pay added to your earnings</p>
          </div>
        </div>
        {data && (
          <div className="mt-3 flex items-center justify-between border-t border-white/15 pt-3 text-[12.5px]">
            <span className="text-white/75">Earned today</span>
            <span className="text-[17px] font-extrabold">{money(data.today)}</span>
          </div>
        )}
      </div>

      <Card>
        <p className="text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-ink-muted">Given to</p>
        <p className="mt-1 flex items-center gap-2 text-[18px] font-extrabold text-ink">
          <Store size={18} /> {p.shop.name}
        </p>
        {p.shop.location && <p className="text-[12.5px] text-ink-muted">{p.shop.location}</p>}
        <div className="mt-3 flex flex-col gap-2">
          {p.items.map((it) => (
            <div key={it.id} className="flex items-center gap-3 rounded-2xl bg-surface-sunken px-3.5 py-3">
              <Truck size={16} className="shrink-0 text-ink-muted" />
              <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-ink">{it.name}</span>
              <span className="text-[11.5px] text-ink-muted">×{it.quantity}</span>
            </div>
          ))}
        </div>
      </Card>

      {data && (
        <Card className="flex items-center gap-3">
          <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${data.left > 0 ? "bg-violet-light text-violet" : "bg-brand-light text-brand"}`}>
            {data.left > 0 ? <ArrowRight size={18} /> : <CheckCircle2 size={18} />}
          </span>
          <p className="flex-1 text-[13.5px] font-extrabold text-ink">
            {data.left > 0 ? `${data.left} more return pickup${data.left === 1 ? "" : "s"} to do` : "No more return pickups — all done"}
          </p>
        </Card>
      )}

      <Button href="/pickups" variant="accent" iconRight={ArrowRight} className="w-full">
        Back to pickups
      </Button>
      <Button href="/earnings" variant="secondary" icon={Wallet} className="w-full">
        View today&apos;s earnings
      </Button>
      <Link href="/dashboard" className="py-1 text-center text-[12.5px] font-bold text-ink-muted">
        Home
      </Link>
    </Page>
  );
}
