// app/(app)/deliveries/[id]/complete/page.tsx
//
// The doorstep. This is the screen where the money is decided, and it is
// deliberately built as ONE question with two answers:
//
//   "Did the customer pay?"
//        YES → the order is DELIVERED and marked PAID. The marketplace's
//              commission becomes real and the shop's payout clock starts.
//        NO  → the order is CANCELLED and stays UNPAID. Nothing is owed
//              to anyone, and the driver still has the parcel to return.
//
// There is no confirmation code anywhere — the driver never asks the
// customer for a number.
//
// A prepaid order (Zaad / eDahab) has no question to ask: the money came
// in at checkout, so the screen just confirms the hand-over. The driver
// can still report a refusal, but the refund is the office's call, not
// something this screen pretends to do.
//
// Every figure shown comes from the backend. Nothing on this page can
// change what is owed.
"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle, Banknote, CheckCircle2, MessageSquare, Package, ShieldCheck, XCircle,
} from "lucide-react";
import {
  CANCEL_REASONS, cancelDelivery, completeDelivery, getDelivery, useAsync,
} from "@/lib/deliveries";
import {
  Button, Card, ConfirmSheet, ErrorState, LoadingState, PageHeader, Toast, money,
} from "@/components/ui";

type Answer = "paid" | "unpaid" | null;

export default function CompleteDeliveryPage({ params }: { params: { id: string } }) {
  const { data, loading, error, reload } = useAsync(() => getDelivery(params.id), [params.id]);

  const [answer, setAnswer] = useState<Answer>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<{ kind: "delivered"; collected: number } | { kind: "cancelled"; wasPrepaid: boolean } | null>(null);
  const [toast, setToast] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  if (loading) return <LoadingState label="Loading…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  // A cash order that hasn't been paid is the only case with money to take.
  const needsCash = data.payment.amountToCollect > 0;

  /* ── after it's done ── */
  if (done) {
    const delivered = done.kind === "delivered";
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
        <div
          className="mb-4 flex h-20 w-20 items-center justify-center rounded-full"
          style={{ background: delivered ? "#0E3B2A" : "#C4362A" }}
        >
          {delivered ? (
            <CheckCircle2 className="h-10 w-10 text-white" />
          ) : (
            <XCircle className="h-10 w-10 text-white" />
          )}
        </div>
        <h1 className="text-[24px] font-extrabold text-ink">
          {delivered ? "Delivery Successful" : "Order Cancelled"}
        </h1>
        <p className="mt-1 text-[14px] font-semibold text-ink-muted">{data.orderNumber}</p>

        {delivered && done.collected > 0 && (
          <div className="mt-4 rounded-2xl bg-accent-light px-5 py-3">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.05em] text-accent-tint">
              Cash Collected
            </div>
            <div className="text-[22px] font-extrabold text-ink">{money(done.collected)}</div>
          </div>
        )}

        {!delivered && (
          <div className="mt-4 max-w-[320px] rounded-2xl bg-[#FDEAEA] px-5 py-3.5">
            <p className="text-[12.5px] leading-[1.6] text-[#C4362A]">
              {done.wasPrepaid
                ? "This order was already paid online. The office has been told and will deal with the refund."
                : "No money was taken. The shop gets nothing for this order."}
            </p>
            <p className="mt-2 text-[12px] font-bold text-[#C4362A]">
              You still have the parcel — take it back to the shop.
            </p>
          </div>
        )}

        <p className="mt-4 max-w-[300px] text-[12px] leading-[1.6] text-ink-faint">
          The customer and the shop have both been updated.
        </p>

        <div className="mt-6 flex w-full max-w-[340px] flex-col gap-2.5">
          <Button href="/deliveries">Back to My Deliveries</Button>
          <Button tone="secondary" href={`/deliveries/${params.id}`}>
            View This Delivery
          </Button>
        </div>
      </div>
    );
  }

  /* ── wrong stage ── */
  if (data.status !== "ON_THE_WAY") {
    return (
      <>
        <PageHeader title="Finish Delivery" back={`/deliveries/${params.id}`} />
        <Card>
          <p className="text-[13px] leading-[1.6] text-ink-soft">
            {data.status === "DELIVERED"
              ? "This delivery is already completed."
              : `You can only finish a delivery once you are on the way with it. This one is ${data.statusLabel.toLowerCase()}.`}
          </p>
          <div className="mt-3">
            <Button tone="secondary" href={`/deliveries/${params.id}`}>
              Back to Delivery
            </Button>
          </div>
        </Card>
      </>
    );
  }

  function open() {
    setFormError(null);
    if (!answer) {
      setFormError(
        needsCash ? "Say whether the customer paid." : "Say whether the customer took the order."
      );
      return;
    }
    if (answer === "unpaid" && !cancelReason) {
      setFormError("Choose a reason so the office knows what happened.");
      return;
    }
    setConfirming(true);
  }

  async function submit() {
    setBusy(true);
    setFormError(null);
    try {
      if (answer === "paid") {
        const result = await completeDelivery(params.id, {
          cashCollected: needsCash ? true : undefined,
          note: note.trim() || undefined,
        });
        setDone({ kind: "delivered", collected: result.collected });
      } else {
        const result = await cancelDelivery(params.id, {
          reason: cancelReason,
          notes: note.trim() || undefined,
        });
        setDone({ kind: "cancelled", wasPrepaid: result.wasPrepaid });
      }
      setConfirming(false);
    } catch (err) {
      setConfirming(false);
      const message = err instanceof Error ? err.message : "That didn't work";
      setFormError(message);
      setToast({ tone: "error", message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Finish Delivery" subtitle={data.orderNumber} back={`/deliveries/${params.id}`} />

      {/* ── Who and what ── */}
      <Card className="mb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-light">
            <Package className="h-5 w-5 text-brand" />
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-bold text-ink">{data.customer.name}</div>
            <div className="text-[12px] text-ink-muted">
              {(data.items ?? []).reduce((s, i) => s + i.quantity, 0)} item(s) · {data.seller.shopName}
            </div>
          </div>
        </div>
      </Card>

      {/* ── The money ── */}
      {needsCash ? (
        <Card className="mb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-light">
              <Banknote className="h-5 w-5 text-accent-tint" />
            </div>
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.05em] text-accent-tint">
                Cash to Collect
              </div>
              <div className="text-[26px] font-extrabold leading-tight text-ink">
                {money(data.payment.amountToCollect)}
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="mb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-light">
              <ShieldCheck className="h-5 w-5 text-brand" />
            </div>
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.05em] text-brand-tint">
                Already Paid
              </div>
              <div className="text-[15px] font-bold leading-tight text-ink">Collect no money</div>
              <div className="text-[11.5px] text-ink-muted">
                {money(data.payment.orderTotal)} was paid online before the order came to you.
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ── The one question ── */}
      <Card
        title={needsCash ? "Did the customer pay?" : "Did the customer take the order?"}
        className="mb-3"
      >
        <div className="flex flex-col gap-2.5">
          <button
            onClick={() => {
              setAnswer("paid");
              setFormError(null);
            }}
            className={`flex min-h-[64px] items-center gap-3 rounded-xl border-2 px-4 text-left transition-colors ${
              answer === "paid" ? "border-brand bg-brand-light" : "border-line bg-white"
            }`}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                answer === "paid" ? "border-brand bg-brand" : "border-line"
              }`}
            >
              {answer === "paid" && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
            </span>
            <span>
              <span className={`block text-[14px] font-bold ${answer === "paid" ? "text-brand" : "text-ink"}`}>
                {needsCash ? `Yes — I have ${money(data.payment.amountToCollect)}` : "Yes — handed over"}
              </span>
              <span className="block text-[11.5px] leading-[1.4] text-ink-muted">
                Marks the order delivered{needsCash ? " and paid" : ""}.
              </span>
            </span>
          </button>

          <button
            onClick={() => {
              setAnswer("unpaid");
              setFormError(null);
            }}
            className={`flex min-h-[64px] items-center gap-3 rounded-xl border-2 px-4 text-left transition-colors ${
              answer === "unpaid" ? "border-[#C4362A] bg-[#FDEAEA]" : "border-line bg-white"
            }`}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                answer === "unpaid" ? "border-[#C4362A] bg-[#C4362A]" : "border-line"
              }`}
            >
              {answer === "unpaid" && <XCircle className="h-3.5 w-3.5 text-white" />}
            </span>
            <span>
              <span
                className={`block text-[14px] font-bold ${answer === "unpaid" ? "text-[#C4362A]" : "text-ink"}`}
              >
                {needsCash ? "No — they would not pay" : "No — they refused it"}
              </span>
              <span className="block text-[11.5px] leading-[1.4] text-ink-muted">
                Cancels the order. {needsCash ? "Nothing is collected." : "The office handles any refund."}
              </span>
            </span>
          </button>
        </div>

        {/* Only a refusal needs a reason. */}
        {answer === "unpaid" && (
          <div className="mt-3 border-t border-line-soft pt-3">
            <p className="mb-2 text-[12px] font-bold text-ink">Why?</p>
            <div className="flex flex-col gap-1.5">
              {CANCEL_REASONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => {
                    setCancelReason(r.value);
                    setFormError(null);
                  }}
                  className={`min-h-[44px] rounded-lg border px-3 text-left text-[13px] font-semibold ${
                    cancelReason === r.value
                      ? "border-[#C4362A] bg-[#FDEAEA] text-[#C4362A]"
                      : "border-line bg-white text-ink-soft"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* ── Optional note ── */}
      <Card
        title="Add a note (optional)"
        icon={<MessageSquare className="h-4 w-4 text-brand" />}
        className="mb-3"
      >
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="e.g. Handed to the customer's brother at the gate"
          className="w-full resize-none rounded-xl border border-line bg-surface-sunken p-3 text-[13px] leading-[1.5] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
        />
      </Card>

      {formError && (
        <div className="mb-3 rounded-2xl bg-[#FDEAEA] p-3.5">
          <p className="text-[12.5px] font-semibold leading-[1.5] text-[#C4362A]">{formError}</p>
        </div>
      )}

      <Button onClick={open} tone={answer === "unpaid" ? "danger" : "primary"} disabled={busy}>
        {answer === "unpaid" ? (
          <>
            <XCircle className="h-4 w-4" />
            Cancel This Order
          </>
        ) : (
          <>
            <ShieldCheck className="h-4 w-4" />
            Mark as Delivered
          </>
        )}
      </Button>

      <p className="mt-3 text-center text-[11px] leading-[1.6] text-ink-faint">
        Nobody home instead?{" "}
        <Link href={`/deliveries/${params.id}/failed`} className="font-bold text-[#C4362A] underline">
          Report a problem
        </Link>{" "}
        — that keeps the parcel with you so you can try again.
      </p>

      <ConfirmSheet
        open={confirming}
        title={answer === "unpaid" ? "Cancel this order?" : "Mark this delivered?"}
        body={
          answer === "unpaid" ? (
            <>
              <strong>{data.orderNumber}</strong> will be cancelled and{" "}
              {data.payment.isPaid ? (
                <>
                  the office told about the refund — it was already paid online.
                </>
              ) : (
                <>no money will be recorded for it.</>
              )}
              <br />
              You will still be holding the parcel, so take it back to {data.seller.shopName}.
            </>
          ) : needsCash ? (
            <>
              You are confirming you have{" "}
              <strong>{money(data.payment.amountToCollect)}</strong> in cash from{" "}
              {data.customer.name}. This cannot be undone from the app.
            </>
          ) : (
            <>
              <strong>{data.orderNumber}</strong> will be marked delivered to {data.customer.name}.
            </>
          )
        }
        confirmLabel={answer === "unpaid" ? "Yes, cancel it" : "Yes, I'm sure"}
        tone={answer === "unpaid" ? "danger" : "primary"}
        loading={busy}
        onConfirm={submit}
        onCancel={() => setConfirming(false)}
      />

      {toast && <Toast tone={toast.tone} message={toast.message} onClose={() => setToast(null)} />}
    </>
  );
}
