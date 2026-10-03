// components/trip.tsx — pieces shared by the trip screens.
"use client";

import { Check, Package } from "lucide-react";
import { fileUrl, type JobItem, type JobStop } from "@/lib/jobs";
import { money } from "@/lib/format";

/** Collect → Deliver → Done. */
export function Stepper({ current, labels = ["Collect", "Deliver", "Done"] }: { current: number; labels?: string[] }) {
  return (
    <div>
      <div className="flex items-center">
        {labels.map((l, i) => {
          const done = i < current;
          const on = i === current;
          return (
            <div key={l} className={`flex items-center ${i < labels.length - 1 ? "flex-1" : ""}`}>
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold ${
                  done ? "bg-[#22A06B] text-white" : on ? "bg-brand text-white ring-4 ring-brand-light" : "bg-line text-ink-faint"
                }`}
              >
                {done ? <Check size={17} strokeWidth={3} /> : i + 1}
              </div>
              {i < labels.length - 1 && <div className={`mx-1.5 h-1 flex-1 rounded-full ${i < current ? "bg-brand" : "bg-line"}`} />}
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between">
        {labels.map((l, i) => (
          <span key={l} className={`text-[11px] font-bold ${i === current ? "text-brand" : i < current ? "text-ink-soft" : "text-ink-faint"}`}>
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ItemThumb({ item, size = 52 }: { item: Pick<JobItem, "imageUrl" | "imageGradient" | "productName">; size?: number }) {
  const src = fileUrl(item.imageUrl);
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-sunken text-ink-faint"
      style={{ width: size, height: size, background: !src && item.imageGradient ? item.imageGradient : undefined }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={item.productName} className="h-full w-full object-cover" />
      ) : !item.imageGradient ? (
        <Package size={size * 0.4} />
      ) : null}
    </div>
  );
}

/** "2 items · Power bank, Fast cable" */
export function itemsLine(stop: JobStop) {
  const names = stop.items.map((i) => (i.quantity > 1 ? `${i.productName} ×${i.quantity}` : i.productName));
  return `${stop.itemCount} item${stop.itemCount === 1 ? "" : "s"}${names.length ? ` · ${names.join(", ")}` : ""}`;
}

/** The cash this shop's part adds at the door (0 when paid online). */
export const stopCash = (s: JobStop) => (s.money.isCod && !s.money.isPaid ? s.money.total : 0);
/** The delivery fee the customer still owes for this shop's part (cash orders only). */
export const stopFeeDue = (s: JobStop) => (s.money.isCod && !s.money.isPaid ? s.money.deliveryFee : 0);

/** One line in a money breakdown. */
export function MoneyLine({ label, value, strike, bold }: { label: React.ReactNode; value: number; strike?: boolean; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 text-[12.5px] ${strike ? "text-ink-faint line-through" : bold ? "font-extrabold text-ink" : "text-ink-soft"}`}>
      <span className="min-w-0 truncate">{label}</span>
      <span className="font-bold tabular-nums">{money(value)}</span>
    </div>
  );
}
