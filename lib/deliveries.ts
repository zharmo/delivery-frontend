// lib/deliveries.ts
//
// Every call the delivery app makes, and the shapes the backend returns.
//
// Note there is no "setStatus" function here, on purpose: the backend has
// no endpoint that accepts a status. Each action below is a named thing the
// driver did, and the backend decides whether it's allowed.
//
// The driver's road is deliberately short:
//   ASSIGNED  →  ON THE WAY  →  DELIVERED / FAILED / RETURNED
// "On the way" means the driver has collected the parcel and is moving.
// There is no confirmation code — the driver never asks the customer for a
// number at the door.
"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, setToken, clearToken, ApiError } from "./api";

/* ── types ──────────────────────────────────────────────────────────── */

export interface DeliveryItem {
  id: string;
  productName: string;
  variantLabel: string | null;
  sku: string | null;
  imageUrl: string | null;
  imageGradient: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface DeliveryHistoryEntry {
  id: string;
  from: string | null;
  to: string;
  toLabel: string;
  byRole: string;
  byName: string | null;
  notes: string | null;
  at: string;
}

export interface Delivery {
  id: string;
  deliveryNumber: string;
  orderId: string;
  orderNumber: string;
  status: string;
  statusLabel: string;
  attemptCount: number;
  /** Shared by every order from the same basket — one trip, several shops. */
  checkoutGroupId: string;
  /** The basket's number — what the customer and the driver both quote. */
  groupNumber: string;
  customer: {
    name: string;
    phone: string;
    address: string | null;
    district: string | null;
    area: string | null;
    landmark: string | null;
    notes: string | null;
  };
  seller: {
    id: string;
    shopName: string;
    shopSlug: string;
    location: string | null;
    pickupAddress: string | null;
    /** The shop's own number. Null when none is on file — never invented. */
    phone: string | null;
  };
  payment: {
    method: string;
    status: string;
    orderTotal: number;
    /** What the driver collects at the door. Comes from the backend — never calculated here. */
    amountToCollect: number;
    isCod: boolean;
    /** True once the money is in, however it got there. */
    isPaid: boolean;
    commission: number;
    /** The goods alone. */
    productTotal: number;
    /** This order's share of the ONE fee charged for the whole basket. */
    deliveryFee: number;
  };
  driver: { id: string; name: string | null; phone: string | null; location: string | null } | null;
  timestamps: {
    assignedAt: string | null;
    onTheWayAt: string | null;
    deliveredAt: string | null;
    failedAt: string | null;
    returnedAt: string | null;
    cancelledAt: string | null;
  };
  orderStatus: string;
  createdAt: string;
  updatedAt: string;
  items?: DeliveryItem[];
  history?: DeliveryHistoryEntry[];
}

export interface DashboardData {
  today: {
    assigned: number;
    onTheWay: number;
    delivered: number;
    failed: number;
    returned: number;
    cancelled: number;
  };
  activeDelivery: Delivery | null;
  activeCount: number;
  recent: Delivery[];
}

export interface DriverProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  profileImage: string | null;
  status: string;
  vehicleType: string | null;
  vehicleNumber: string | null;
  assignedLocation: string | null;
  joinedAt: string;
  editableFields: string[];
}

/* ── status presentation ────────────────────────────────────────────── */

export const STATUS_STYLE: Record<string, { label: string; bg: string; fg: string }> = {
  UNASSIGNED: { label: "Waiting for a driver", bg: "#F0F1F6", fg: "#6B7280" },
  ASSIGNED: { label: "Assigned", bg: "#EEF0FA", fg: "#5B5FA0" },
  ON_THE_WAY: { label: "On the Way", bg: "#FFF1E0", fg: "#D9540F" },
  DELIVERED: { label: "Delivered", bg: "#EAF7EE", fg: "#2C6B44" },
  FAILED: { label: "Failed", bg: "#FDEAEA", fg: "#C4362A" },
  RETURNED: { label: "Returned", bg: "#F0F1F6", fg: "#6B7280" },
  CANCELLED: { label: "Cancelled", bg: "#FDEAEA", fg: "#C4362A" },
};

/**
 * Why a customer sent the parcel back at the door. These END the sale —
 * unlike a failure, which just postpones it. The first one is the cash
 * case the whole payment flow hangs on.
 */
export const CANCEL_REASONS = [
  { value: "customer_would_not_pay", label: "Customer would not pay" },
  { value: "customer_changed_mind", label: "Customer changed their mind" },
  { value: "wrong_item", label: "Wrong item" },
  { value: "item_damaged", label: "Item is damaged" },
  { value: "other", label: "Other" },
];

export function statusStyle(status: string) {
  return STATUS_STYLE[status] ?? { label: status, bg: "#F0F1F6", fg: "#6B7280" };
}

export const FAILURE_REASONS = [
  { value: "customer_unavailable", label: "Customer not available" },
  { value: "customer_phone_unreachable", label: "Phone unreachable" },
  { value: "wrong_address", label: "Wrong address" },
  { value: "customer_refused", label: "Customer refused the order" },
  { value: "customer_requested_later", label: "Customer asked for later delivery" },
  { value: "shop_not_ready", label: "Shop did not hand over the parcel" },
  { value: "payment_issue", label: "Payment problem" },
  { value: "other", label: "Other" },
];

/**
 * The one button that matters on any given delivery — what the driver
 * should do next. Mirrors the backend's state machine, so the app never
 * offers an action the server would refuse.
 */
export function nextAction(status: string): { label: string; href: (id: string) => string } | null {
  switch (status) {
    case "ASSIGNED":
      // One tap covers collecting and setting off.
      return { label: "I have it — I'm on the way", href: (id) => `/deliveries/${id}` };
    case "ON_THE_WAY":
      return { label: "Finish this delivery", href: (id) => `/deliveries/${id}/complete` };
    case "CANCELLED":
      return { label: "Take it back to the shop", href: (id) => `/deliveries/${id}` };
    case "FAILED":
      return { label: "Try again or return it", href: (id) => `/deliveries/${id}` };
    default:
      return null;
  }
}

/** Statuses that mean the driver is still working on it. */
export const ACTIVE_STATUSES = ["ASSIGNED", "ON_THE_WAY", "FAILED", "CANCELLED"];

/** Statuses that are finished — history, not work. */
export const CLOSED_STATUSES = ["DELIVERED", "RETURNED", "CANCELLED"];

/* ── auth ───────────────────────────────────────────────────────────── */

export interface Session {
  token: string;
  user: { id: string; name: string; email: string };
  driver: { id: string; status: string };
}

export async function login(email: string, password: string): Promise<Session> {
  const data = await apiFetch<Session>("/delivery/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setToken(data.token);
  try {
    window.localStorage.setItem("bakhaar_delivery_user", JSON.stringify(data.user));
  } catch {
    /* ignore */
  }
  return data;
}

export function logout() {
  clearToken();
  try {
    window.localStorage.removeItem("bakhaar_delivery_user");
  } catch {
    /* ignore */
  }
  window.location.href = "/login";
}

export function storedUser(): { id: string; name: string; email: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("bakhaar_delivery_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/* ── reads ──────────────────────────────────────────────────────────── */

export const getDashboard = () => apiFetch<DashboardData>("/delivery/dashboard");

export const getDeliveries = (status?: string) =>
  apiFetch<Delivery[]>(`/delivery/deliveries${status ? `?status=${status}` : ""}`);

export const getDelivery = (id: string) => apiFetch<Delivery>(`/delivery/deliveries/${id}`);

export const getHistory = () => apiFetch<Delivery[]>("/delivery/history");

export const getProfile = () => apiFetch<DriverProfile>("/delivery/profile");

/* ── actions ────────────────────────────────────────────────────────── */

const action = <T = { id: string; status: string; message: string }>(
  id: string,
  name: string,
  body?: unknown
) =>
  apiFetch<T>(`/delivery/deliveries/${id}/${name}`, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });

/** ASSIGNED → ON_THE_WAY. Collecting the parcel and setting off are one step. */
export const startDelivery = (id: string) => action(id, "start");

/** ON_THE_WAY → DELIVERED. No confirmation code; COD needs cash confirmed. */
export const completeDelivery = (id: string, body: { cashCollected?: boolean; note?: string }) =>
  action<{ id: string; status: string; collected: number; message: string }>(id, "deliver", body);

export const failDelivery = (id: string, body: { reason: string; notes?: string }) =>
  action(id, "fail", body);

/** ON_THE_WAY -> CANCELLED. The customer said no; no money is taken. */
export const cancelDelivery = (id: string, body: { reason: string; notes?: string }) =>
  action<{ id: string; status: string; wasPrepaid: boolean; message: string }>(id, "cancel", body);

export const returnDelivery = (id: string, body: { notes?: string }) => action(id, "return", body);

export const updateProfile = (body: { phone?: string; vehicleType?: string; vehicleNumber?: string }) =>
  apiFetch<DriverProfile>("/delivery/profile", { method: "PATCH", body: JSON.stringify(body) });

export const setAvailability = (status: "ACTIVE" | "OFFLINE") =>
  apiFetch<{ status: string }>("/delivery/availability", {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

/* ── a tiny data hook ───────────────────────────────────────────────── */

/**
 * Loads something, and gives back the three states every screen needs:
 * loading, error (with a retry) and data. Keeps each page from
 * reimplementing the same useEffect.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loader()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Something went wrong");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => run(), [run]);

  return { data, loading, error, reload: run };
}

/* ── trips: how the driver actually works ───────────────────────────── */

/**
 * One customer, one address, one basket number — and every shop the
 * driver must collect from on the way there.
 *
 * A customer who buys from three shops places ONE order that becomes
 * three order rows behind the scenes, so each shop keeps its own money.
 * The driver never sees that split: they see this.
 */
export interface TripShop {
  id: string;
  name: string;
  location: string | null;
  phone: string | null;
  address: string | null;
  orderNumbers: string[];
}

/** A shop on the DETAIL screen, where its items have been loaded too. */
export interface TripShopWithItems extends TripShop {
  itemCount: number;
  items: {
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
  }[];
}

/**
 * A trip in a LIST. The shops are named but their items are not loaded —
 * fetching every product for every job would be a lot of rows for a
 * screen that only needs to say "3 shops". getTrip() returns the detail.
 */
export interface Trip {
  groupId: string;
  groupNumber: string;
  customer: Delivery["customer"];
  stops: Delivery[];
  shops: TripShop[];
  shopCount: number;
  stopCount: number;
  dropLocation: string | null;
  /** The goods. */
  productTotal: number;
  /** The delivery fee — charged once for the basket, not once per shop. */
  deliveryFee: number;
  orderTotal: number;
  amountToCollect: number;
  status: string;
  statusLabel: string;
  createdAt: string;
  updatedAt: string;
}

/** One trip in full — every shop carries the items to collect from it. */
export interface TripDetail extends Omit<Trip, "shops"> {
  shops: TripShopWithItems[];
  /** Total pieces across every shop — what the driver counts into the bag. */
  totalItems: number;
}

/** Every journey this driver is carrying. */
export const getTrips = (status?: string) =>
  apiFetch<Trip[]>(`/delivery/trips${status ? `?status=${status}` : ""}`);

/** One journey in full: customer once, every shop, every product. */
export const getTrip = (groupId: string) => apiFetch<TripDetail>(`/delivery/trips/${groupId}`);