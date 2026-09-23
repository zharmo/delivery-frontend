// app/(app)/deliveries/[id]/page.tsx
//
// Everything about one delivery, and the single button for whatever comes
// next. The button is chosen from the delivery's status by nextAction(),
// which mirrors the backend's state machine — so the app never offers a
// move the server would refuse.
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  BadgeCheck, Banknote, Check, ChevronRight, Circle, Clock, MapPin, MessageSquare,
  Navigation, Package, Phone, ShoppingBag, Store, Truck, XCircle,
} from "lucide-react";
import {
  CLOSED_STATUSES, getDelivery, returnDelivery, startDelivery, useAsync,
} from "@/lib/deliveries";
import { API_BASE } from "@/lib/api";
import {
  Button, Card, ConfirmSheet, ErrorState, LoadingState, PageHeader, Row, StatusBadge,
  Toast, dateTime, money, timeOf,
} from "@/components/ui";

/** Product photos are paths served by the backend, not this app. */
function resolveImage(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${API_BASE.replace(/\/api\/v1$/, "")}${url}`;
}

/** Opens the address in whatever maps app the phone has. */
function mapsHref(parts: (string | null)[]) {
  const q = parts.filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q || "Hargeisa")}`;
}

export default function DeliveryDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data, loading, error, reload } = useAsync(() => getDelivery(params.id), [params.id]);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<null | "start" | "return">(null);
  const [toast, setToast] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  if (loading) return <LoadingState label="Loading delivery…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const finished = CLOSED_STATUSES.includes(data.status);

  async function run(fn: () => Promise<unknown>, successMessage: string) {
    setBusy(true);
    try {
      await fn();
      setConfirm(null);
      setToast({ tone: "success", message: successMessage });
      reload();
    } catch (err) {
      setConfirm(null);
      setToast({ tone: "error", message: err instanceof Error ? err.message : "That didn't work" });
    } finally {
      setBusy(false);
    }
  }

  // The timeline, built from what actually happened (the backend's history),
  // with the remaining steps shown greyed out ahead of it.
  const doneSteps = (data.history ?? []).map((h) => ({
    label: h.toLabel,
    at: h.at,
    who: h.byName ?? h.byRole,
    done: true,
  }));
  // Three steps, in the order the driver lives them.
  const upcoming: string[] = [];
  if (!finished) {
    const order = ["ASSIGNED", "ON_THE_WAY", "DELIVERED"];
    const labels: Record<string, string> = {
      ASSIGNED: "Assigned",
      ON_THE_WAY: "On the Way",
      DELIVERED: "Delivered",
    };
    // A failed delivery rejoins the road at "on the way" when it goes out again.
    const from = data.status === "FAILED" ? "ASSIGNED" : data.status;
    const idx = order.indexOf(from);
    if (idx >= 0) for (const s of order.slice(idx + 1)) upcoming.push(labels[s] ?? s);
  }

  return (
    <>
      <PageHeader
        title={data.orderNumber}
        subtitle={`${data.deliveryNumber} · created ${dateTime(data.createdAt)}`}
        back="/deliveries"
        right={<StatusBadge status={data.status} large />}
      />

      {/* ── Money first: it's what a driver double-checks at the door ── */}
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
          <div className="min-w-0 flex-1">
            {data.payment.amountToCollect > 0 ? (
              <>
                <div className="text-[11px] font-extrabold uppercase tracking-[0.05em] text-accent-tint">
                  Cash on Delivery
                </div>
                <div className="text-[24px] font-extrabold leading-tight text-ink">
                  {money(data.payment.amountToCollect)}
                </div>
                <div className="text-[11px] text-ink-muted">
                  Collect this amount from the customer — mark it paid when you have it
                </div>
              </>
            ) : (
              <>
                <div className="text-[11px] font-extrabold uppercase tracking-[0.05em] text-brand-tint">
                  Paid Online
                </div>
                <div className="text-[20px] font-extrabold leading-tight text-ink">Collect nothing</div>
                <div className="text-[11px] text-ink-muted">
                  Order total {money(data.payment.orderTotal)} already paid
                </div>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* ── Customer ── */}
      <Card title="Deliver To" icon={<MapPin className="h-4 w-4 text-brand" />} className="mb-3">
        <div className="text-[15px] font-bold text-ink">{data.customer.name}</div>
        <div className="mt-1.5 text-[13px] leading-[1.6] text-ink-soft">
          {data.customer.address || "No address given"}
          {data.customer.area && <div>Area: {data.customer.area}</div>}
          {data.customer.district && <div>District: {data.customer.district}</div>}
          {data.customer.landmark && (
            <div className="font-semibold text-brand">Landmark: {data.customer.landmark}</div>
          )}
        </div>
        {data.customer.notes && (
          <div className="mt-2 flex items-start gap-2 rounded-xl bg-surface-sunken p-2.5">
            <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" />
            <p className="text-[12px] leading-[1.5] text-ink-soft">{data.customer.notes}</p>
          </div>
        )}

        <div className="mt-3 flex gap-2.5">
          <a
            href={`tel:${data.customer.phone}`}
            className="flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand text-[13.5px] font-bold text-white"
          >
            <Phone className="h-4 w-4" />
            Call Customer
          </a>
          <a
            href={mapsHref([data.customer.landmark, data.customer.area, data.customer.address, "Hargeisa"])}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-line text-[13.5px] font-bold text-brand"
          >
            <Navigation className="h-4 w-4" />
            Navigate
          </a>
        </div>
      </Card>

      {/* One basket can span several shops. When it does, say so and
          offer the whole job — otherwise the driver only ever sees a
          third of what they are carrying. */}
      <div className="mb-3">
        <Link
          href={`/trips/${data.checkoutGroupId}`}
          className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-white p-3.5 active:bg-surface-sunken"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="rounded-md bg-brand px-1.5 py-0.5 text-[10.5px] font-extrabold text-white">
                {data.groupNumber}
              </span>
              <span className="text-[12.5px] font-bold text-ink">See the whole job</span>
            </div>
            <p className="mt-0.5 text-[11.5px] leading-[1.4] text-ink-muted">
              Every shop on this customer&apos;s order, and what to collect from each.
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
        </Link>
      </div>

      {/* ── Shop ── */}
      <Card title="Pick Up From" icon={<Store className="h-4 w-4 text-brand" />} className="mb-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[14px] font-bold text-ink">{data.seller.shopName}</span>
          <BadgeCheck className="h-3.5 w-3.5 text-brand-tint" />
        </div>
        <div className="mt-0.5 text-[12.5px] text-ink-soft">
          {data.seller.pickupAddress || data.seller.location || "Address not set"}
        </div>
        <div className="mt-3">
          <a
            href={mapsHref([data.seller.pickupAddress, data.seller.location, "Hargeisa"])}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border border-line text-[13.5px] font-bold text-brand"
          >
            <Navigation className="h-4 w-4" />
            Navigate to Shop
          </a>
        </div>
      </Card>

      {/* ── Parcel contents ── */}
      <Card title={`Items (${data.items?.length ?? 0})`} icon={<ShoppingBag className="h-4 w-4 text-brand" />} className="mb-3">
        <div className="flex flex-col gap-3">
          {(data.items ?? []).map((item) => {
            const photo = resolveImage(item.imageUrl);
            return (
              <div key={item.id} className="flex gap-3">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line"
                  style={photo ? undefined : { background: item.imageGradient ?? "#F0F1F6" }}
                >
                  {photo ? (
                    <img src={photo} alt={item.productName} className="h-full w-full object-cover" />
                  ) : (
                    <Package className="h-4 w-4 text-ink-faint" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold leading-tight text-ink">{item.productName}</div>
                  {item.variantLabel && (
                    <div className="mt-0.5 inline-block rounded-md bg-brand-light px-2 py-0.5 text-[10.5px] font-semibold text-brand">
                      {item.variantLabel}
                    </div>
                  )}
                  <div className="mt-0.5 text-[11px] text-ink-faint">Qty: {item.quantity}</div>
                </div>
                <div className="shrink-0 text-[13px] font-extrabold text-ink">{money(item.total)}</div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── Timeline ── */}
      <Card title="Progress" icon={<Clock className="h-4 w-4 text-brand" />} className="mb-3">
        <div className="flex flex-col">
          {doneSteps.map((s, i) => (
            <div key={`${s.label}-${i}`} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand">
                  <Check className="h-3 w-3 text-white" />
                </div>
                {(i < doneSteps.length - 1 || upcoming.length > 0) && (
                  <div className="w-[2px] flex-1 bg-brand" style={{ minHeight: 22 }} />
                )}
              </div>
              <div className="pb-3">
                <div className="text-[12.5px] font-bold text-ink">{s.label}</div>
                <div className="text-[11px] text-ink-faint">
                  {timeOf(s.at)} · {s.who}
                </div>
              </div>
            </div>
          ))}
          {upcoming.map((label, i) => (
            <div key={label} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-line">
                  <Circle className="h-2.5 w-2.5 text-ink-faint" />
                </div>
                {i < upcoming.length - 1 && <div className="w-[2px] flex-1 bg-line" style={{ minHeight: 22 }} />}
              </div>
              <div className="pb-3">
                <div className="text-[12.5px] font-bold text-ink-faint">{label}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Order summary ── */}
      <Card title="Order" className="mb-4">
        <Row label="Order" value={data.orderNumber} />
        <Row label="Delivery" value={data.deliveryNumber} />
        <Row
          label="Payment"
          value={data.payment.isCod ? "Cash on Delivery" : data.payment.method === "zaad" ? "Zaad" : "eDahab"}
        />
        <Row label="Order total" value={money(data.payment.orderTotal)} />
        {data.attemptCount > 1 && <Row label="Attempts" value={`${data.attemptCount}`} />}
      </Card>

      {/* ── The next action ──
          One step at a time. ASSIGNED means the parcel is still at the shop;
          pressing "on the way" is the driver saying they have it in hand. */}
      {data.status === "ASSIGNED" && (
        <div className="mb-3">
          <Button onClick={() => setConfirm("start")}>
            <Truck className="h-4 w-4" />
            I Have It — I&apos;m On The Way
          </Button>
          <p className="mt-2 text-center text-[11.5px] leading-[1.5] text-ink-faint">
            Press this once you have collected the parcel from {data.seller.shopName}.
          </p>
        </div>
      )}

      {data.status === "ON_THE_WAY" && (
        <>
          <div className="mb-3">
            <Button href={`/deliveries/${data.id}/complete`}>
              Finish This Delivery
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="mb-3">
            <Button tone="danger" href={`/deliveries/${data.id}/failed`}>
              <XCircle className="h-4 w-4" />
              Report a Problem
            </Button>
          </div>
        </>
      )}

      {/* Cancelled: the sale is off, but the driver still holds the goods. */}
      {data.status === "CANCELLED" && (
        <>
          <div className="mb-3 rounded-2xl border border-[#F3D3CF] bg-[#FDEAEA] p-3.5">
            <p className="text-[12.5px] font-bold text-[#C4362A]">This order was cancelled</p>
            <p className="mt-0.5 text-[11.5px] leading-[1.5] text-[#A6473C]">
              {data.payment.isPaid
                ? "It was already paid online — the office will deal with the refund."
                : "No money was collected."}{" "}
              You are still holding the parcel.
            </p>
          </div>
          <div className="mb-3">
            <Button tone="danger" onClick={() => setConfirm("return")}>
              Return Parcel To Shop
            </Button>
          </div>
        </>
      )}

      {/* A failed delivery: out again, or back to the shop. */}
      {data.status === "FAILED" && (
        <>
          <div className="mb-3 rounded-2xl border border-[#F3D3CF] bg-[#FDEAEA] p-3.5">
            <p className="text-[12.5px] font-bold text-[#C4362A]">This delivery failed</p>
            <p className="mt-0.5 text-[11.5px] leading-[1.5] text-[#A6473C]">
              Go out again when you can, or take the parcel back to the shop.
            </p>
          </div>
          <div className="mb-3">
            <Button onClick={() => setConfirm("start")}>
              <Truck className="h-4 w-4" />
              Try Again — I&apos;m On The Way
            </Button>
          </div>
          <div className="mb-3">
            <Button tone="danger" onClick={() => setConfirm("return")}>
              Return Parcel To Shop
            </Button>
          </div>
        </>
      )}

      {finished && (
        <div className="mb-3 rounded-2xl bg-surface-sunken p-4 text-center">
          <p className="text-[12.5px] font-semibold text-ink-muted">
            This delivery is {data.statusLabel.toLowerCase()} — nothing more to do.
          </p>
        </div>
      )}

      <ConfirmSheet
        open={confirm === "start"}
        title="Do you have the parcel?"
        body={
          <>
            Only press this once <strong>{data.seller.shopName}</strong> has handed you order{" "}
            <strong>{data.orderNumber}</strong>. {data.customer.name} will be told you are on the way.
          </>
        }
        confirmLabel="Yes, I have it"
        loading={busy}
        onConfirm={() => run(() => startDelivery(data.id), "You're on the way")}
        onCancel={() => setConfirm(null)}
      />

      <ConfirmSheet
        open={confirm === "return"}
        title="Confirm return to shop?"
        body="Only confirm this once you have physically handed the parcel back to the shop."
        confirmLabel="Yes, I returned it"
        tone="danger"
        loading={busy}
        onConfirm={() =>
          run(() => returnDelivery(data.id, {}), "Return recorded").then(() => router.push("/deliveries"))
        }
        onCancel={() => setConfirm(null)}
      />

      {toast && <Toast tone={toast.tone} message={toast.message} onClose={() => setToast(null)} />}
    </>
  );
}