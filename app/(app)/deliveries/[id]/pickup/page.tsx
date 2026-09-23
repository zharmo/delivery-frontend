// app/(app)/deliveries/[id]/pickup/page.tsx
//
// Collecting the parcel from the shop. Two taps, in order:
//   "I've Arrived"  → PICKUP_PENDING
//   "Confirm Pickup" → PICKED_UP
//
// Which button shows depends on the delivery's real status, so a rider who
// reloads mid-way sees exactly where they left off.
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, MapPin, Navigation, Package, Phone, Store } from "lucide-react";
import { arriveAtPickup, confirmPickup, getDelivery, useAsync } from "@/lib/deliveries";
import {
  Button, Card, ConfirmSheet, ErrorState, LoadingState, PageHeader, Row, StatusBadge, Toast, money,
} from "@/components/ui";

export default function PickupPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data, loading, error, reload } = useAsync(() => getDelivery(params.id), [params.id]);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [toast, setToast] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  if (loading) return <LoadingState label="Loading pickup details…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const itemCount = (data.items ?? []).reduce((sum, i) => sum + i.quantity, 0);
  const canArrive = data.status === "ACCEPTED";
  const canConfirm = data.status === "PICKUP_PENDING";
  const alreadyPicked = ["PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED"].includes(data.status);

  async function act(fn: () => Promise<unknown>, message: string, goDetail = false) {
    setBusy(true);
    try {
      await fn();
      setConfirming(false);
      setToast({ tone: "success", message });
      if (goDetail) router.push(`/deliveries/${params.id}`);
      else reload();
    } catch (err) {
      setConfirming(false);
      setToast({ tone: "error", message: err instanceof Error ? err.message : "That didn't work" });
    } finally {
      setBusy(false);
    }
  }

  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [data.seller.pickupAddress, data.seller.location, "Hargeisa"].filter(Boolean).join(", ")
  )}`;

  return (
    <>
      <PageHeader
        title="Pickup"
        subtitle={data.orderNumber}
        back={`/deliveries/${params.id}`}
        right={<StatusBadge status={data.status} />}
      />

      {/* ── Where to go ── */}
      <Card title="Shop" icon={<Store className="h-4 w-4 text-brand" />} className="mb-3">
        <div className="text-[16px] font-extrabold text-ink">{data.seller.shopName}</div>
        <div className="mt-1 flex items-start gap-1.5 text-[13px] text-ink-soft">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" />
          <span>{data.seller.pickupAddress || data.seller.location || "Address not set"}</span>
        </div>

        <div className="mt-3">
          <a
            href={mapsHref}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border border-line text-[13.5px] font-bold text-brand"
          >
            <Navigation className="h-4 w-4" />
            Navigate to Shop
          </a>
        </div>
      </Card>

      {/* ── What to collect ── */}
      <Card title="What to Collect" icon={<Package className="h-4 w-4 text-brand" />} className="mb-3">
        <Row label="Order" value={data.orderNumber} />
        <Row label="Items" value={`${itemCount} item${itemCount === 1 ? "" : "s"}`} />
        <Row label="Packages" value={`${data.items?.length ?? 0} line${(data.items?.length ?? 0) === 1 ? "" : "s"}`} />

        <div className="mt-2 flex flex-col gap-2 border-t border-line-soft pt-2.5">
          {(data.items ?? []).map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[12.5px] font-bold text-ink">{item.productName}</div>
                {item.variantLabel && (
                  <div className="text-[11px] text-brand">{item.variantLabel}</div>
                )}
              </div>
              <span className="shrink-0 text-[12.5px] font-bold text-ink-muted">×{item.quantity}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Reminder of what happens at the far end, so a COD parcel isn't a surprise later */}
      {data.payment.amountToCollect > 0 && (
        <div className="mb-3 rounded-2xl bg-accent-light p-3.5">
          <p className="text-[12px] leading-[1.6] text-accent-tint">
            <strong>Cash order.</strong> You&apos;ll collect{" "}
            <strong>{money(data.payment.amountToCollect)}</strong> from the customer at the door.
          </p>
        </div>
      )}

      {/* ── Actions ── */}
      {alreadyPicked ? (
        <>
          <div className="mb-3 flex items-center justify-center gap-2 rounded-2xl bg-brand-light p-4">
            <Check className="h-4 w-4 text-brand-tint" />
            <span className="text-[13px] font-bold text-brand-tint">Already picked up</span>
          </div>
          <Button href={`/deliveries/${params.id}/out-for-delivery`}>Go to Delivery</Button>
        </>
      ) : canArrive ? (
        <Button onClick={() => act(() => arriveAtPickup(params.id), "Arrival recorded")} loading={busy}>
          <MapPin className="h-4 w-4" />
          I&apos;ve Arrived at the Shop
        </Button>
      ) : canConfirm ? (
        <>
          <Button onClick={() => setConfirming(true)}>
            <Check className="h-4 w-4" />
            Confirm Pickup
          </Button>
          <div className="mt-2.5">
            <Button tone="danger" href={`/deliveries/${params.id}/failed`}>
              Can&apos;t Collect This Order
            </Button>
          </div>
        </>
      ) : (
        <div className="rounded-2xl bg-surface-sunken p-4 text-center">
          <p className="text-[12.5px] font-semibold text-ink-muted">
            Accept this delivery first, from the delivery page.
          </p>
        </div>
      )}

      {data.seller.location && (
        <div className="mt-3">
          <a
            href={`tel:${data.customer.phone}`}
            className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-2xl border border-line bg-white text-[13.5px] font-bold text-brand"
          >
            <Phone className="h-4 w-4" />
            Call the Customer
          </a>
        </div>
      )}

      <ConfirmSheet
        open={confirming}
        title="Confirm you have the parcel?"
        body={
          <>
            Check you have all {itemCount} item{itemCount === 1 ? "" : "s"} for order{" "}
            <strong>{data.orderNumber}</strong> before confirming.
          </>
        }
        confirmLabel="Yes, I have it"
        loading={busy}
        onConfirm={() => act(() => confirmPickup(params.id), "Pickup confirmed", true)}
        onCancel={() => setConfirming(false)}
      />

      {toast && <Toast tone={toast.tone} message={toast.message} onClose={() => setToast(null)} />}
    </>
  );
}
