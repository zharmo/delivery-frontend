// lib/pickups.ts
//
// Return pickups and the driver's money.
//
// A RETURN PICKUP: a customer is sending an item back. The driver goes to
// the customer, collects it, and hands it to the shop. Each finished
// pickup adds a set amount to the driver's earnings.
//
// EARNINGS: the driver earns a share of each delivery fee (set by the
// office) plus the pickup pay. CASH: what the driver took at doors and
// still has to hand to the office.
"use client";

import { apiFetch } from "@/lib/api";

export interface Pickup {
  id: string;
  kind: "return_pickup";
  returnId: string;
  returnNumber: string;
  status: "UNASSIGNED" | "ASSIGNED" | "PICKED_UP" | "DELIVERED" | "FAILED" | "CANCELLED";
  returnStatus: string;
  reasonLabel: string;
  orderNumber: string;
  attempts: number;
  failureReason: string | null;
  driverPay: number;
  /** What you earn when this pickup is done. */
  payOnDone?: number;
  customer: { name: string; phone: string; address: string | null; area: string | null; landmark: string | null; city: string | null };
  shop: { name: string; location: string | null; phone: string | null };
  itemCount: number;
  timestamps: { createdAt: string; assignedAt: string | null; pickedUpAt: string | null; deliveredAt: string | null; failedAt: string | null };
}

export interface PickupDetail extends Pickup {
  /** What the customer wrote when they asked for the return. */
  customerNote?: string | null;
  items: { id: string; name: string; variant: string | null; imageUrl: string | null; quantity: number }[];
}

export const PICKUP_STYLE: Record<string, { label: string; bg: string; fg: string }> = {
  ASSIGNED: { label: "Go to customer", bg: "#F1EDFD", fg: "#5638C4" },
  PICKED_UP: { label: "Take to shop", bg: "#EEF0FA", fg: "#3F51B5" },
  FAILED: { label: "Try again", bg: "#FDEAEA", fg: "#C4362A" },
  DELIVERED: { label: "Done", bg: "#EAF7EE", fg: "#2C6B44" },
  CANCELLED: { label: "Cancelled", bg: "#F0F1F6", fg: "#6B7280" },
  UNASSIGNED: { label: "Waiting", bg: "#F0F1F6", fg: "#6B7280" },
};

export const PICKUP_FAIL_REASONS = [
  "Customer not available",
  "Phone not answering",
  "Wrong address",
  "Customer doesn't want to return it now",
  "Item not ready / missing parts",
  "Other",
];

export const getPickups = () => apiFetch<Pickup[]>("/delivery/returns");
export const getPickupHistory = () => apiFetch<Pickup[]>("/delivery/returns/history");
export const getPickup = (id: string) => apiFetch<PickupDetail>(`/delivery/returns/${id}`);

type Result = { id: string; status: string; message: string };
const post = (path: string, body?: unknown) =>
  apiFetch<Result>(path, { method: "POST", ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

/** "I have the item from the customer." */
export const pickedUp = (id: string) => post(`/delivery/returns/${id}/picked-up`);
/** "I gave it to the shop." */
export const handedToShop = (id: string) => post(`/delivery/returns/${id}/handed-over`);
/** Couldn't collect it this time. */
export const pickupFailed = (id: string, reason: string) => post(`/delivery/returns/${id}/fail`, { reason });

/* ── money ── */

export interface LedgerEntry {
  /** The handover / payment id (for receipts), or null. */
  ref: string | null;
  kind: "cash_collected" | "cash_handed" | "earned" | "paid";
  label: string;
  amount: number;
  at: string | null;
  note: string | null;
  /** Who at the office received the cash or sent the pay. */
  by: string | null;
}

export interface Earnings {
  payPercent: number;
  /** What one finished return pickup pays. */
  pickupPay?: number;
  id: string;
  name: string;
  cash: { collected: number; handed: number; toHandOver: number; lastHandoverAt: string | null; oldestUnhandedAt: string | null };
  pay: { earned: number; paid: number; owed: number; lastPaidAt: string | null; today: number; week: number; month: number };
  deliveredToday: number;
  ledger: LedgerEntry[];
}

export const getEarnings = () => apiFetch<Earnings>("/delivery/ops/earnings");

/** One cash handover — the driver's receipt. */
export interface Handover {
  id: string;
  amount: number;
  at: string;
  receivedBy: string | null;
  note: string | null;
  heldBefore: number;
  heldAfter: number;
  holdingNow: number | null;
}
export const getHandover = (id: string) => apiFetch<Handover>(`/delivery/ops/handovers/${id}`);

export { dateTime as when } from "@/lib/format";
