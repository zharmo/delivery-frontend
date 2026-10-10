// lib/jobs.ts
//
// The driver's side of a TRIP.
//
// A trip is one customer's whole basket. The customer bought from three
// shops; behind the scenes that is three orders, because each shop keeps
// its own money. The driver never sees that split. They see this: one
// customer, one address, one amount to collect — and a list of shops to
// call at on the way.
//
// Rules that live in here and are enforced by the backend as well:
//   1. Tick every shop before setting off. No bag left behind.
//   2. At the door, say what the customer actually took. Money follows
//      the goods — anything refused is cancelled and never paid for.
//   3. A whole basket refused at the door: if it's the customer's choice
//      on a cash order, they pay the delivery fee (the driver says if they
//      did). If it's the shop's fault, the customer pays nothing.
// There is no delivery code — the driver never asks the customer for one.
// Door outcomes (lib/door.ts): items are marked one by one; refused items go
// to the Bakhaar store, not straight back to the shops.
"use client";

import { apiFetch, API_BASE, ApiError, getCsrf } from "@/lib/api";

/* ── shapes ─────────────────────────────────────────────────────────── */

export interface JobItem {
  id: string;
  productName: string;
  variantLabel: string | null;
  sku: string | null;
  imageUrl: string | null;
  imageGradient: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
  orderNumber: string;
}

export interface JobStop {
  id: string;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  status: string;
  statusLabel: string;
  sortOrder: number;
  readyAt: string | null;
  collectedAt: string | null;
  refusedReason: string | null;
  itemCount: number;
  shop: {
    id: string;
    name: string;
    slug: string | null;
    location: string | null;
    /** The seller's real number, so the driver can ring ahead. */
    phone: string | null;
  };
  money: {
    productTotal: number;
    deliveryFee: number;
    total: number;
    commission: number;
    isCod: boolean;
    isPaid: boolean;
  };
  items: JobItem[];
}

export interface Job {
  id: string;
  /** The basket's number. The customer says this one too. */
  jobNumber: string;
  checkoutGroupId: string;
  status: string;
  statusLabel: string;
  attemptCount: number;
  customer: {
    name: string;
    phone: string;
    email: string | null;
    address: string | null;
    district: string | null;
    area: string | null;
    landmark: string | null;
    notes: string | null;
  };
  money: {
    productTotal: number;
    /** ONE fee for the whole trip, however many shops. */
    deliveryFee: number;
    orderTotal: number;
    /** What to take at the door. Refused shops are already out of this. */
    amountToCollect: number;
    commission: number;
    isCod: boolean;
    isPaid: boolean;
  };
  progress: {
    shopCount: number;
    readyCount: number;
    collectedCount: number;
    waitingCount: number;
    allShopsReady: boolean;
    /** Every bag is in hand — until this is true, you cannot set off. */
    allCollected: boolean;
    waitingSince: string | null;
    waitingHours: number | null;
  };
  driver: { id: string; name: string | null; phone: string | null; location: string | null } | null;
  dropLocation: string | null;
  timestamps: {
    readyAt: string | null;
    assignedAt: string | null;
    onTheWayAt: string | null;
    deliveredAt: string | null;
    failedAt: string | null;
    cancelledAt: string | null;
    returnedAt: string | null;
  };
  /** Goes to another city. */
  isIntercity?: boolean;
  destinationCity?: string | null;
  /** The shops on this trip (names only). */
  shopNames?: string[];
  /** Every delivery attempt used: take it back to the shops. */
  mustReturn?: boolean;
  /** A new delivery time the office agreed with the customer. */
  retryAt?: string | null;
  lastFailureReason?: string | null;
  /** What you earned on this trip (after delivery, or after a refusal). */
  driverPay?: number;
  /** Set when the customer refused the whole basket at the door. */
  refusal?: { fault: "customer" | "shop"; feeCollected: number; feeRefused: boolean } | null;
  /** Finished on the door screen: refused items still to take to the Bakhaar store. */
  door?: { goodsWithDriver: number; payWaiting: number } | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobDetail extends Job {
  /** What the door needs: a photo (if the office asks) and the attempt limit. */
  proofRules?: { photoRequired: boolean; maxAttempts: number };
  stops: JobStop[];
  totalItems: number;
  history: {
    id: string;
    from: string | null;
    to: string;
    toLabel: string;
    byRole: string | null;
    byName: string | null;
    notes: string | null;
    at: string;
  }[];
}

export interface JobDashboard {
  today: {
    assigned: number;
    onTheWay: number;
    delivered: number;
    failed: number;
    cancelled: number;
    returned: number;
  };
  jobs: Job[];
  activeJob: Job | null;
  activeCount: number;
}

/* ── labels ─────────────────────────────────────────────────────────── */

export const JOB_STATUS_STYLE: Record<string, { label: string; bg: string; fg: string }> = {
  WAITING_SHOPS: { label: "Shops still packing", bg: "#F0F1F6", fg: "#6B7280" },
  UNASSIGNED: { label: "Waiting for a driver", bg: "#F0F1F6", fg: "#6B7280" },
  ASSIGNED: { label: "Collect shops", bg: "#F1EDFD", fg: "#5638C4" },
  ON_THE_WAY: { label: "On the way", bg: "#FFF1E0", fg: "#D9540F" },
  DELIVERED: { label: "Delivered", bg: "#EAF7EE", fg: "#2C6B44" },
  FAILED: { label: "Failed", bg: "#FDEAEA", fg: "#C4362A" },
  CANCELLED: { label: "Refused", bg: "#FDEAEA", fg: "#C4362A" },
  RETURNED: { label: "Returned", bg: "#F0F1F6", fg: "#6B7280" },
};

export const STOP_STATUS_STYLE: Record<string, { label: string; bg: string; fg: string }> = {
  WAITING: { label: "Not ready", bg: "#FFF1E0", fg: "#D9540F" },
  READY: { label: "Ready to collect", bg: "#EAF7EE", fg: "#2C6B44" },
  COLLECTED: { label: "In your bag", bg: "#EEF0FA", fg: "#5B5FA0" },
  DELIVERED: { label: "Handed over", bg: "#EAF7EE", fg: "#2C6B44" },
  REFUSED: { label: "Refused", bg: "#FDEAEA", fg: "#C4362A" },
  MOVED: { label: "Moved to another trip", bg: "#F0F1F6", fg: "#6B7280" },
};

export function jobStyle(status: string) {
  return JOB_STATUS_STYLE[status] ?? { label: status, bg: "#F0F1F6", fg: "#6B7280" };
}

export function stopStyle(status: string) {
  return STOP_STATUS_STYLE[status] ?? { label: status, bg: "#F0F1F6", fg: "#6B7280" };
}

/** Why a trip couldn't be delivered this time. The backend accepts exactly these. */
export const JOB_FAILURE_REASONS: { value: string; label: string; hint: string }[] = [
  { value: "customer_unavailable", label: "Customer not there", hint: "Nobody at the address" },
  { value: "customer_phone_unreachable", label: "Phone not answering", hint: "Called, no answer or switched off" },
  { value: "wrong_address", label: "Wrong address", hint: "Can't find the place" },
  { value: "customer_requested_later", label: "Customer asked for later", hint: "Wants another day or time" },
  { value: "payment_issue", label: "Customer doesn't have the money", hint: "Will pay another time" },
  { value: "other", label: "Something else", hint: "Write a note for the office" },
];

/**
 * Why the customer refused the whole basket.
 * fault "customer" = their choice → they pay the delivery fee on a cash order.
 * fault "shop"     = the shop's mistake → the customer pays nothing.
 */
export const JOB_CANCEL_REASONS: { value: string; label: string; hint: string; fault: "customer" | "shop" }[] = [
  { value: "customer_would_not_pay", label: "Won't pay", hint: "Doesn't want to pay for it", fault: "customer" },
  { value: "customer_changed_mind", label: "Changed their mind", hint: "Doesn't want it any more", fault: "customer" },
  { value: "wrong_item", label: "Wrong item or size", hint: "Not what they ordered", fault: "shop" },
  { value: "item_damaged", label: "Item is damaged", hint: "Broken, torn or opened", fault: "shop" },
  { value: "not_as_described", label: "Not as described", hint: "Different from the photos", fault: "shop" },
  { value: "other", label: "Other reason", hint: "Write a note for the office", fault: "customer" },
];

export const reasonLabel = (value: string | null | undefined) =>
  JOB_FAILURE_REASONS.find((r) => r.value === value)?.label ??
  JOB_CANCEL_REASONS.find((r) => r.value === value)?.label ??
  (value ? value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) : "");

/** Trips still in the driver's hands (a cancelled trip still has to go back to the shops). */
export const LIVE_JOB_STATUSES = ["ASSIGNED", "ON_THE_WAY", "FAILED", "CANCELLED"];
export const CLOSED_JOB_STATUSES = ["DELIVERED", "RETURNED"];

/** Everything this driver must still do something with, most urgent first. */
export async function getLiveJobs() {
  const jobs = await getJobs(LIVE_JOB_STATUSES.join(","));
  const order: Record<string, number> = { ON_THE_WAY: 0, ASSIGNED: 1, FAILED: 2, CANCELLED: 3 };
  return jobs.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
}

/**
 * What the driver does next on this trip — the one line every card shows.
 * tone picks the colour: brand (go), accent (cash / waiting), danger (go back).
 */
export function nextStep(job: Job): { label: string; tone: "brand" | "accent" | "danger" | "violet" | "muted" } {
  switch (job.status) {
    case "ASSIGNED": {
      const left = job.progress.shopCount - job.progress.collectedCount;
      return left > 0
        ? { label: `Collect ${left} more shop${left === 1 ? "" : "s"}`, tone: "violet" }
        : { label: "Everything collected — set off", tone: "brand" };
    }
    case "ON_THE_WAY":
      return { label: "Go to the customer", tone: "brand" };
    case "FAILED":
      return job.mustReturn
        ? { label: "No tries left — return to shops", tone: "danger" }
        : { label: "Try again or return to shops", tone: "accent" };
    case "CANCELLED":
      return job.door
        ? { label: job.door.goodsWithDriver > 0 ? "Refused — take items to the Bakhaar store" : "Refused — recorded", tone: job.door.goodsWithDriver > 0 ? "danger" : "muted" }
        : { label: "Refused — return to shops", tone: "danger" };
    case "DELIVERED":
      return { label: "Delivered", tone: "brand" };
    case "RETURNED":
      return { label: "Returned to the shops", tone: "muted" };
    default:
      return { label: job.statusLabel, tone: "muted" };
  }
}

/** The day this trip finished, for "Done today". */
export const finishedAt = (job: Job) =>
  job.timestamps.deliveredAt ?? job.timestamps.returnedAt ?? job.timestamps.cancelledAt ?? job.updatedAt;

/* ── reads ──────────────────────────────────────────────────────────── */

export const getJobDashboard = () => apiFetch<JobDashboard>("/delivery/jobs/dashboard");

export const getJobs = (status?: string) =>
  apiFetch<Job[]>(`/delivery/jobs${status ? `?status=${encodeURIComponent(status)}` : ""}`);

export const getJob = (id: string) => apiFetch<JobDetail>(`/delivery/jobs/${id}`);

export const getJobHistory = () => apiFetch<Job[]>("/delivery/jobs/history");

/* ── actions ────────────────────────────────────────────────────────── */

interface ActionResult {
  id: string;
  status: string;
  message: string;
  [key: string]: unknown;
}

function post<T = ActionResult>(path: string, body?: unknown) {
  return apiFetch<T>(path, {
    method: "POST",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

/**
 * "I have this shop's bag." One tick per shop — after ticking every item in
 * it (itemsChecked), so a missing item can be traced later.
 */
export const collectStop = (jobId: string, stopId: string, itemsChecked = true) =>
  post(`/delivery/jobs/${jobId}/stops/${stopId}/collect`, { itemsChecked });

/** Undo a mis-tap. */
export const uncollectStop = (jobId: string, stopId: string) =>
  post(`/delivery/jobs/${jobId}/stops/${stopId}/uncollect`);

/** Set off. Refused by the backend until every shop is ticked. */
export const startJob = (jobId: string) => post(`/delivery/jobs/${jobId}/start`);

/**
 * The door.
 *
 * `acceptedStopIds` is what the customer actually took. Anything left out
 * is refused: not delivered, not paid, and still in the driver's hands to
 * take back. The cash figure is worked out by the backend from the
 * accepted orders — never sent from here.
 */
export const completeJob = (
  jobId: string,
  body: {
    acceptedStopIds?: string[];
    cashCollected?: boolean;
    refusedReason?: string;
    note?: string;
    /** From uploadProofPhoto(). */
    photoUrl?: string;
  }
) =>
  post<ActionResult & { collected: number; deliveredShops: number; refusedShops: number; driverPay?: number }>(
    `/delivery/jobs/${jobId}/deliver`,
    body
  );

/** Nobody answered. Everything stays with the driver; they can try again. */
export const failJob = (jobId: string, body: { reason: string; notes?: string }) =>
  post<ActionResult & { mustReturn?: boolean; attempts?: number; maxAttempts?: number }>(`/delivery/jobs/${jobId}/fail`, body);

/** A photo of the parcel at the door. Returns "/uploads/proofs/<file>". */
export async function uploadProofPhoto(file: File): Promise<string> {
  const form = new FormData();
  form.append("image", file);
  // The sign-in is an HttpOnly cookie; a change must also carry the CSRF number.
  const send = async (csrf: string | null) =>
    fetch(`${API_BASE}/delivery/ops/uploads/proof`, {
      method: "POST",
      credentials: "include",
      headers: csrf ? { "X-CSRF-Token": csrf } : {},
      body: form,
    });
  let res = await send(await getCsrf());
  if (res.status === 403 && res.headers.get("X-CSRF") === "failed") {
    const fresh = await getCsrf(true);
    if (fresh) res = await send(fresh);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) throw new ApiError(json.message ?? "Photo upload failed", res.status);
  return json.data.url as string;
}

/** Where an uploaded file can be shown from. */
export function fileUrl(path: string | null | undefined) {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${API_BASE.replace(/\/api\/v1\/?$/, "")}${path}`;
}

/**
 * The customer refused the whole basket. The sale is off.
 * feePaid: only for the customer's choice on a cash order — did they pay
 * the delivery fee? (true = the cash is in your hand, false = they refused.)
 */
export const cancelJob = (jobId: string, body: { reason: string; notes?: string; feePaid?: boolean; photoUrl?: string }) =>
  post<ActionResult & { fault: "customer" | "shop"; feeCollected: number; feeRefused: boolean; refundsQueued: number }>(
    `/delivery/jobs/${jobId}/cancel`,
    body
  );

/** The goods are back with the shops. */
export const returnJob = (jobId: string, body?: { notes?: string }) =>
  post(`/delivery/jobs/${jobId}/return`, body ?? {});