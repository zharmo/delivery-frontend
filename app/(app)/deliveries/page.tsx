// app/(app)/deliveries/page.tsx
//
// Every delivery assigned to the signed-in driver. The backend only ever
// returns their own — there is no "all deliveries" option here, because a
// driver has no business seeing another driver's work.
"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, MapPin, Package, Phone, Store } from "lucide-react";
import { getDeliveries, useAsync } from "@/lib/deliveries";
import {
  Card, EmptyState, ErrorState, PageHeader, SkeletonList, StatusBadge, dateTime, money,
} from "@/components/ui";

const TABS = [
  { key: "", label: "All" },
  { key: "ASSIGNED", label: "Assigned" },
  { key: "ON_THE_WAY", label: "On the Way" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "FAILED", label: "Failed" },
  { key: "CANCELLED", label: "Cancelled" },
  { key: "RETURNED", label: "Returned" },
];

export default function DeliveriesPage() {
  const [tab, setTab] = useState("");
  const { data, loading, error, reload } = useAsync(() => getDeliveries(tab || undefined), [tab]);

  return (
    <>
      <PageHeader title="My Deliveries" subtitle="Only the deliveries assigned to you" />

      {/* Filter pills — scrollable so they never overflow a narrow phone */}
      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {TABS.map((t) => (
          <button
            key={t.key || "all"}
            onClick={() => setTab(t.key)}
            className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2.5 text-[12.5px] font-bold transition-colors ${
              tab === t.key ? "bg-brand text-white" : "border border-line bg-white text-ink-soft"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <SkeletonList rows={3} />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && data && data.length === 0 && (
        <EmptyState
          title="No deliveries here"
          hint={
            tab
              ? "Nothing in this group right now. Try another tab."
              : "Nothing assigned to you yet. The office will send work your way."
          }
          icon={<Package className="h-7 w-7 text-ink-faint" />}
        />
      )}

      {!loading && !error && data && data.length > 0 && (
        <div className="flex flex-col gap-3">
          {data.map((d) => (
            <Link key={d.id} href={`/deliveries/${d.id}`}>
              <Card className="active:bg-surface-sunken">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[14px] font-extrabold text-ink">{d.orderNumber}</div>
                    <div className="text-[10.5px] text-ink-faint">{d.deliveryNumber}</div>
                  </div>
                  <StatusBadge status={d.status} />
                </div>

                {/* Pickup → drop-off, the two places the driver needs */}
                <div className="flex flex-col gap-1.5 border-t border-line-soft pt-2.5">
                  <div className="flex items-start gap-2 text-[12px]">
                    <Store className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" />
                    <span className="text-ink-soft">
                      <span className="font-semibold">{d.seller.shopName}</span>
                      {d.seller.location ? ` · ${d.seller.location}` : ""}
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-[12px]">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" />
                    <span className="text-ink-soft">
                      <span className="font-semibold">{d.customer.name}</span>
                      {d.customer.area ? ` · ${d.customer.area}` : ""}
                    </span>
                  </div>
                </div>

                <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-line-soft pt-2.5">
                  <div className="min-w-0">
                    {d.payment.amountToCollect > 0 ? (
                      <>
                        <span className="text-[10px] font-bold text-accent-tint">COLLECT CASH</span>
                        <div className="text-[15px] font-extrabold text-ink">
                          {money(d.payment.amountToCollect)}
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="text-[10px] font-bold text-brand-tint">ALREADY PAID</span>
                        <div className="text-[13px] font-bold text-ink-muted">Collect nothing</div>
                      </>
                    )}
                    <div className="text-[10.5px] text-ink-faint">{dateTime(d.createdAt)}</div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <a
                      href={`tel:${d.customer.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Call ${d.customer.name}`}
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-line"
                    >
                      <Phone className="h-4 w-4 text-brand" />
                    </a>
                    <ChevronRight className="h-4 w-4 text-ink-faint" />
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
