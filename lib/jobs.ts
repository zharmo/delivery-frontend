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
// Two rules live in here and are enforced by the backend as well:
//   1. Tick every shop before setting off. No bag left behind.
//   2. At the door, say what the customer actually took. Money follows
//      the goods — anything refused is cancelled and never paid for.
"use client";

import { apiFetch } from "@/lib/api";

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
  createdAt: string;
  updatedAt: string;
}

export interface JobDetail extends Job {
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
  ASSIGNED: { label: "Collect the shops", bg: "#EEF0FA", fg: "#5B5FA0" },
  ON_THE_WAY: { label: "On the Way", bg: "#FFF1E0", fg: "#D9540F" },
  DELIVERED: { label: "Delivered", bg: "#EAF7EE", fg: "#2C6B44" },
  FAILED: { label: "Failed", bg: "#FDEAEA", fg: "#C4362A" },
  CANCELLED: { label: "Cancelled", bg: "#FDEAEA", fg: "#C4362A" },
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

/** The backend accepts exactly these values — kept in step by hand. */
export const JOB_FAILURE_REASONS = [
  { value: "customer_unavailable", label: "Customer not available" },
  { value: "customer_phone_unreachable", label: "Phone unreachable" },
  { value: "wrong_address", label: "Wrong address" },
  { value: "customer_refused", label: "Customer refused to take it" },
  { value: "customer_requested_later", label: "Customer asked for another time" },
  { value: "payment_issue", label: "Problem with payment" },
  { value: "other", label: "Other" },
];

export const JOB_CANCEL_REASONS = [
  { value: "customer_would_not_pay", label: "Customer would not pay" },
  { value: "customer_changed_mind", label: "Customer changed their mind" },
  { value: "wrong_item", label: "Wrong item" },
  { value: "item_damaged", label: "Item is damaged" },
  { value: "other", label: "Other" },
];

/** Trips still in the driver's hands, versus trips that are finished. */
export const LIVE_JOB_STATUSES = ["ASSIGNED", "ON_THE_WAY", "FAILED"];
export const CLOSED_JOB_STATUSES = ["DELIVERED", "CANCELLED", "RETURNED"];

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

/** "I have this shop's bag." One tick per shop. */
export const collectStop = (jobId: string, stopId: string) =>
  post(`/delivery/jobs/${jobId}/stops/${stopId}/collect`);

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
  body: { acceptedStopIds?: string[]; cashCollected?: boolean; refusedReason?: string; note?: string }
) =>
  post<ActionResult & { collected: number; deliveredShops: number; refusedShops: number }>(
    `/delivery/jobs/${jobId}/deliver`,
    body
  );

/** Nobody answered. Everything stays with the driver; they can try again. */
export const failJob = (jobId: string, body: { reason: string; notes?: string }) =>
  post(`/delivery/jobs/${jobId}/fail`, body);

/** The customer refused the whole basket. The sale is off. */
export const cancelJob = (jobId: string, body: { reason: string; notes?: string }) =>
  post(`/delivery/jobs/${jobId}/cancel`, body);

/** The goods are back with the shops. */
export const returnJob = (jobId: string, body?: { notes?: string }) =>
  post(`/delivery/jobs/${jobId}/return`, body ?? {});