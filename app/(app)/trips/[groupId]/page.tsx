// app/(app)/trips/[groupId]/page.tsx
//
// THE JOB, as the driver actually does it.
//
// A customer who buys from three shops places ONE order — BKH-1007 — that
// becomes three order rows behind the scenes so each shop keeps its own
// money. The driver does not care about that split. They care about:
//
//   1. which shops do I collect from, and what do I take from each
//   2. who am I taking it to, and where
//   3. how much do I collect at the door
//
// So this screen shows the customer ONCE at the top, then every shop as a
// numbered pickup with its own phone number and its own list of items,
// then the money. Each shop's parcel is still its own delivery with its
// own status underneath, which is why every pickup carries its own
// status badge and its own link.
"use client";

import Link from "next/link";
import {
  Banknote, CheckCircle2, MapPin, MessageSquare, Navigation, Package,
  Phone, ShoppingBag, Store,
} from "lucide-react";
import { getTrip, useAsync } from "@/lib/deliveries";
import { API_BASE } from "@/lib/api";
import {
  Card, ErrorState, LoadingState, PageHeader, StatusBadge, money,
} from "@/components/ui";

/** Product photos are paths served by the backend, not this app. */
function resolveImage(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${API_BASE.replace(/\/api\/v1$/, "")}${url}`;
}

function mapsHref(parts: (string | null)[]) {
  const q = parts.filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q || "Hargeisa")}`;
}

export default function TripPage({ params }: { params: { groupId: string } }) {
  const { data, loading, error, reload } = useAsync(
    () => getTrip(params.groupId),
    [params.groupId]
  );

  if (loading) return <LoadingState label="Loading the job…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  return (
    <>
      <PageHeader
        title={data.groupNumber}
        subtitle={`${data.shopCount} shop${data.shopCount === 1 ? "" : "s"} · ${data.totalItems} item${
          data.totalItems === 1 ? "" : "s"
        } · one customer`}
        back="/dashboard"
        right={<StatusBadge status={data.status} large />}
      />

      {/* ── The money, told apart ── */}
      <Card className="mb-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
            style={{ background: data.amountToCollect > 0 ? "#FFF1E0" : "#EAF7EE" }}
          >
            <Banknote
              className="h-5 w-5"
              style={{ color: data.amountToCollect > 0 ? "#D9540F" : "#2C6B44" }}
            />
          </div>
          <div className="min-w-0 flex-1">
            {data.amountToCollect > 0 ? (
              <>
                <div className="text-[11px] font-extrabold uppercase tracking-[0.05em] text-accent-tint">
                  Collect at the door
                </div>
                <div className="text-[24px] font-extrabold leading-tight text-ink">
                  {money(data.amountToCollect)}
                </div>
              </>
            ) : (
              <>
                <div className="text-[11px] font-extrabold uppercase tracking-[0.05em] text-brand-tint">
                  Paid Online
                </div>
                <div className="text-[20px] font-extrabold leading-tight text-ink">Collect nothing</div>
              </>
            )}
          </div>
        </div>

        {/* Goods and delivery are different money — shown as two lines. */}
        <div className="mt-3 flex gap-2 border-t border-line-soft pt-3">
          <div className="flex-1 rounded-xl bg-surface-sunken p-2.5 text-center">
            <div className="text-[9.5px] font-bold uppercase tracking-wide text-ink-faint">
              Products
            </div>
            <div className="text-[14px] font-extrabold text-ink">{money(data.productTotal)}</div>
          </div>
          <div className="flex-1 rounded-xl bg-accent-light p-2.5 text-center">
            <div className="text-[9.5px] font-bold uppercase tracking-wide text-accent-tint">
              Delivery
            </div>
            <div className="text-[14px] font-extrabold text-ink">{money(data.deliveryFee)}</div>
          </div>
        </div>
      </Card>

      {/* ── The customer, ONCE ── */}
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

      {/* ── Every pickup, in order ── */}
      <div className="mb-2 flex items-center gap-1.5 px-1">
        <ShoppingBag className="h-4 w-4 text-brand" />
        <h2 className="text-[13.5px] font-extrabold text-ink">
          Collect from {data.shopCount} shop{data.shopCount === 1 ? "" : "s"}
        </h2>
      </div>

      {data.shops.map((shop, i) => {
        // The delivery row behind this shop's parcel — its own status.
        const stop = data.stops.find((s) => s.seller.id === shop.id);
        return (
          <Card key={shop.id} className="mb-3">
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-[12px] font-extrabold text-white">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14.5px] font-bold text-ink">{shop.name}</span>
                  {stop && <StatusBadge status={stop.status} />}
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-[12px] text-ink-soft">
                  <Store className="h-3 w-3 shrink-0 text-ink-faint" />
                  {shop.address || shop.location || "Address not set"}
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-ink-faint">
                  {shop.orderNumbers.join(", ")} · {shop.itemCount} item
                  {shop.itemCount === 1 ? "" : "s"}
                </div>
              </div>
            </div>

            {/* what to take from THIS shop */}
            <div className="mt-3 flex flex-col gap-2.5 border-t border-line-soft pt-3">
              {shop.items.map((item) => {
                const photo = resolveImage(item.imageUrl);
                return (
                  <div key={item.id} className="flex gap-2.5">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line"
                      style={photo ? undefined : { background: item.imageGradient ?? "#F0F1F6" }}
                    >
                      {photo ? (
                        <img src={photo} alt={item.productName} className="h-full w-full object-cover" />
                      ) : (
                        <Package className="h-4 w-4 text-ink-faint" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-bold leading-tight text-ink">
                        {item.productName}
                      </div>
                      {item.variantLabel && (
                        <div className="mt-0.5 inline-block rounded-md bg-brand-light px-1.5 py-0.5 text-[10px] font-semibold text-brand">
                          {item.variantLabel}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[13px] font-extrabold text-ink">×{item.quantity}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ring the shop, find the shop */}
            <div className="mt-3 flex gap-2.5">
              {shop.phone ? (
                <a
                  href={`tel:${shop.phone}`}
                  className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-line text-[12.5px] font-bold text-brand"
                >
                  <Phone className="h-3.5 w-3.5" />
                  Call Shop
                </a>
              ) : (
                <span className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-surface-sunken text-[11.5px] text-ink-faint">
                  No shop number on file
                </span>
              )}
              <a
                href={mapsHref([shop.address, shop.location, "Hargeisa"])}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-line text-[12.5px] font-bold text-brand"
              >
                <Navigation className="h-3.5 w-3.5" />
                Navigate
              </a>
              {stop && (
                <Link
                  href={`/deliveries/${stop.id}`}
                  className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-brand text-[12.5px] font-bold text-white"
                >
                  Open
                </Link>
              )}
            </div>
          </Card>
        );
      })}

      {/* Each parcel moves on its own — say so, so nobody expects one
          button to finish the whole basket. */}
      <div className="mb-3 rounded-2xl bg-surface-sunken p-3.5">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <p className="text-[11.5px] leading-[1.6] text-ink-soft">
            Collect everything above, then open each shop&apos;s parcel to mark it on the way and
            delivered. They are separate orders for separate shops, so each one is finished on its
            own — even though you make one journey.
          </p>
        </div>
      </div>
    </>
  );
}