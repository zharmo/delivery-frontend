// app/(app)/deliveries/[id]/failed/page.tsx
//
// Reporting that a delivery couldn't be completed.
//
// A reason is required — the backend rejects the request without one, so
// this screen has no way to submit a bare "failed". What happens next is
// not decided here: the delivery goes back to the driver's list marked
// FAILED, and from its own page the driver can go out again or return the
// parcel to the shop. The office sees the same delivery and can do either
// of those too.
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, ArrowLeft, Check, Phone } from "lucide-react";
import { FAILURE_REASONS, failDelivery, getDelivery, useAsync } from "@/lib/deliveries";
import {
  Button, Card, ConfirmSheet, ErrorState, LoadingState, PageHeader, Toast,
} from "@/components/ui";

export default function FailedDeliveryPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data, loading, error, reload } = useAsync(() => getDelivery(params.id), [params.id]);

  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  if (loading) return <LoadingState label="Loading…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  // Only a parcel that is actually on the road can fail.
  const canReport = data.status === "ON_THE_WAY";

  if (!canReport) {
    return (
      <>
        <PageHeader title="Report a Problem" back={`/deliveries/${params.id}`} />
        <Card>
          <p className="text-[13px] leading-[1.6] text-ink-soft">
            There&apos;s nothing to report on this delivery — it&apos;s {data.statusLabel.toLowerCase()}.
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
    if (!reason) {
      setFormError("Choose a reason so the office knows what happened.");
      return;
    }
    if (reason === "other" && !notes.trim()) {
      setFormError("Describe what happened when choosing 'Other'.");
      return;
    }
    setFormError(null);
    setConfirming(true);
  }

  async function submit() {
    setBusy(true);
    try {
      await failDelivery(params.id, { reason, notes: notes.trim() || undefined });
      setConfirming(false);
      setToast({ tone: "success", message: "Reported. You can try again or return it to the shop." });
      setTimeout(() => router.push("/deliveries"), 1200);
    } catch (err) {
      setConfirming(false);
      const message = err instanceof Error ? err.message : "Could not send the report";
      setFormError(message);
      setToast({ tone: "error", message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Delivery Problem"
        subtitle={data.orderNumber}
        back={`/deliveries/${params.id}`}
      />

      {/* Try the phone first — most "failures" are a missed call. */}
      {(
        <div className="mb-3 rounded-2xl bg-accent-light p-3.5">
          <p className="mb-2.5 text-[12.5px] leading-[1.6] text-accent-tint">
            Before reporting, try calling {data.customer.name.split(" ")[0]} once more — most
            problems are just a missed call.
          </p>
          <a
            href={`tel:${data.customer.phone}`}
            className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl bg-white text-[13.5px] font-bold text-accent-tint"
          >
            <Phone className="h-4 w-4" />
            Call {data.customer.phone}
          </a>
        </div>
      )}

      <Card title="Why did the delivery fail?" className="mb-3">
        <div className="flex flex-col gap-2">
          {FAILURE_REASONS.map((r) => {
            const selected = reason === r.value;
            return (
              <button
                key={r.value}
                onClick={() => {
                  setReason(r.value);
                  setFormError(null);
                }}
                className={`flex min-h-[52px] items-center gap-3 rounded-xl border-2 px-3.5 text-left transition-colors ${
                  selected ? "border-brand bg-brand-light" : "border-line bg-white"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    selected ? "border-brand bg-brand" : "border-line"
                  }`}
                >
                  {selected && <Check className="h-3 w-3 text-white" />}
                </span>
                <span className={`text-[13.5px] ${selected ? "font-bold text-brand" : "font-semibold text-ink-soft"}`}>
                  {r.label}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card title="Additional Notes" className="mb-3">
        <textarea
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setFormError(null);
          }}
          rows={4}
          placeholder={
            reason === "other"
              ? "Required — tell the office what happened"
              : "Optional — anything the office should know"
          }
          className="w-full resize-none rounded-xl border border-line bg-surface-sunken px-3.5 py-3 text-[14px] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
        />
      </Card>

      {formError && (
        <div className="mb-3 rounded-2xl bg-[#FDEAEA] p-3.5">
          <p className="text-[12.5px] font-semibold leading-[1.5] text-[#C4362A]">{formError}</p>
        </div>
      )}

      <Button tone="danger" onClick={open}>
        <AlertTriangle className="h-4 w-4" />
        Confirm Delivery Failed
      </Button>

      <div className="mt-2.5">
        <Button tone="ghost" href={`/deliveries/${params.id}`}>
          <ArrowLeft className="h-4 w-4" />
          Go Back
        </Button>
      </div>

      <p className="mt-4 text-center text-[11px] leading-[1.6] text-ink-faint">
        After reporting, this delivery stays on your list. From its page you can go out again or
        return the parcel to the shop.
      </p>

      <ConfirmSheet
        open={confirming}
        title="Report this delivery as failed?"
        body={
          <>
            Reason: <strong>{FAILURE_REASONS.find((r) => r.value === reason)?.label}</strong>
            <br />
            The office will see this straight away. You can then try again or return the parcel.
          </>
        }
        confirmLabel="Yes, send the report"
        tone="danger"
        loading={busy}
        onConfirm={submit}
        onCancel={() => setConfirming(false)}
      />

      {toast && <Toast tone={toast.tone} message={toast.message} onClose={() => setToast(null)} />}
    </>
  );
}
