// app/(app)/deliveries/[id]/out-for-delivery/page.tsx
//
// The road to the customer. Big call and navigate buttons, the cash amount
// in plain sight, and one button to say the run has started — which is what
// flips the customer's order to "Out for delivery".
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Banknote, MapPin, MessageSquare, Navigation, Phone, Truck, XCircle,
} from "lucide-react";
import { getDelivery, startDelivery, useAsync } from "@/lib/deliveries";
import {
  Button, Card, ConfirmSheet, ErrorState, LoadingState, PageHeader, StatusBadge, Toast, money,
} from "@/components/ui";

export default function OutForDeliveryPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data, loading, error, reload } = useAsync(() => getDelivery(params.id), [params.id]);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [toast, setToast] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  if (loading) return <LoadingState label="Loading delivery…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const canStart = ["PICKED_UP", "REDELIVERY_PENDING"].includes(data.status);
  const onTheWay = data.status === "OUT_FOR_DELIVERY";

  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [data.customer.landmark, data.customer.area, data.customer.address, "Hargeisa"].filter(Boolean).join(", ")
  )}`;

  async function start() {
    setBusy(true);
    try {
      await startDelivery(params.id);
      setConfirming(false);
      setToast({ tone: "success", message: "Delivery started — the customer has been updated" });
      reload();
    } catch (err) {
      setConfirming(false);
      setToast({ tone: "error", message: err instanceof Error ? err.message : "That didn't work" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Out for Delivery"
        subtitle={data.orderNumber}
        back={`/deliveries/${params.id}`}
        right={<StatusBadge status={data.status} />}
      />

      {/* ── Customer, big ── */}
      <Card className="mb-3">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.05em] text-ink-faint">
          Deliver To
        </div>
        <div className="mt-1 text-[19px] font-extrabold leading-tight text-ink">{data.customer.name}</div>

        <div className="mt-2 flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
          <div className="text-[13.5px] leading-[1.6] text-ink-soft">
            {data.customer.address || "No address given"}
            {data.customer.area && <div>Area: {data.customer.area}</div>}
            {data.customer.district && <div>District: {data.customer.district}</div>}
            {data.customer.landmark && (
              <div className="font-bold text-brand">Landmark: {data.customer.landmark}</div>
            )}
          </div>
        </div>

        {data.customer.notes && (
          <div className="mt-2.5 flex items-start gap-2 rounded-xl bg-surface-sunken p-3">
            <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" />
            <p className="text-[12px] leading-[1.55] text-ink-soft">{data.customer.notes}</p>
          </div>
        )}
      </Card>

      {/* ── Cash ── */}
      <Card className="mb-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
            style={{ background: data.payment.amountToCollect > 0 ? "#FFF1E0" : "#EAF7EE" }}
          >
            <Banknote
              className="h-5 w-5"
              style={{ color: data.payment.amountToCollect > 0 ? "#D9540F" : "#2C6B44" }}
            />
          </div>
          <div>
            <div
              className="text-[11px] font-extrabold uppercase tracking-[0.05em]"
              style={{ color: data.payment.amountToCollect > 0 ? "#D9540F" : "#2C6B44" }}
            >
              {data.payment.amountToCollect > 0 ? "Collect Cash" : "Already Paid"}
            </div>
            <div className="text-[24px] font-extrabold leading-tight text-ink">
              {data.payment.amountToCollect > 0 ? money(data.payment.amountToCollect) : money(0)}
            </div>
          </div>
        </div>
      </Card>

      {/* ── The two things a rider does on the road ── */}
      <div className="mb-3 flex gap-2.5">
        <a
          href={`tel:${data.customer.phone}`}
          className="flex min-h-[64px] flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl bg-brand text-white"
        >
          <Phone className="h-5 w-5" />
          <span className="text-[12.5px] font-bold">Call Customer</span>
        </a>
        <a
          href={mapsHref}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-[64px] flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl border border-line bg-white text-brand"
        >
          <Navigation className="h-5 w-5" />
          <span className="text-[12.5px] font-bold">Navigate</span>
        </a>
      </div>

      {/* ── Actions ── */}
      {canStart && (
        <Button onClick={() => setConfirming(true)} loading={busy}>
          <Truck className="h-4 w-4" />
          Start Delivery
        </Button>
      )}

      {onTheWay && (
        <>
          <div className="mb-3 rounded-2xl bg-brand-light p-3.5 text-center">
            <p className="text-[12.5px] font-semibold leading-[1.6] text-brand-tint">
              The customer knows their order is on the way. When you reach them, ask for their
              delivery code.
            </p>
          </div>
          <Button href={`/deliveries/${params.id}/complete`}>I&apos;ve Arrived — Complete Delivery</Button>
          <div className="mt-2.5">
            <Button tone="danger" href={`/deliveries/${params.id}/failed`}>
              <XCircle className="h-4 w-4" />
              Delivery Problem
            </Button>
          </div>
        </>
      )}

      {!canStart && !onTheWay && (
        <div className="rounded-2xl bg-surface-sunken p-4 text-center">
          <p className="text-[12.5px] font-semibold text-ink-muted">
            Collect the parcel from the shop first.
          </p>
          <div className="mt-3">
            <Button tone="secondary" href={`/deliveries/${params.id}/pickup`}>
              Go to Pickup
            </Button>
          </div>
        </div>
      )}

      <ConfirmSheet
        open={confirming}
        title="Start the delivery?"
        body={
          <>
            {data.customer.name} will be told their order is on the way. Only start once you&apos;re
            actually heading there.
          </>
        }
        confirmLabel="Yes, I'm on my way"
        loading={busy}
        onConfirm={start}
        onCancel={() => setConfirming(false)}
      />

      {toast && <Toast tone={toast.tone} message={toast.message} onClose={() => setToast(null)} />}
    </>
  );
}
